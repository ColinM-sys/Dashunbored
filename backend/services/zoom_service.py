import json
import httpx
import base64
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode

from sqlalchemy.orm import Session
from database import AppSettings, ZoomToken


# ─── Helpers: Load global OAuth app credentials ───

def get_zoom_app_credentials(db: Session) -> dict:
    """Load the global Zoom OAuth app credentials (client_id, client_secret) from AppSettings."""
    stored = db.query(AppSettings).filter(AppSettings.key == "api_keys").first()
    if not stored or not stored.value:
        return {}
    try:
        keys = json.loads(stored.value)
        return {
            "client_id": keys.get("zoom_client_id", ""),
            "client_secret": keys.get("zoom_client_secret", ""),
        }
    except Exception:
        return {}


def get_zoom_redirect_uri() -> str:
    """Return the OAuth callback URL."""
    return "http://localhost:3000/api/zoom/callback"


# ─── OAuth Authorization Code Flow ───

def get_zoom_auth_url(db: Session, user_id: int) -> str:
    """Generate the Zoom OAuth authorization URL for a user to connect their account."""
    creds = get_zoom_app_credentials(db)
    if not creds.get("client_id"):
        raise ValueError("Zoom OAuth app not configured. Ask your admin to add Zoom credentials in Admin > API Keys.")

    params = {
        "response_type": "code",
        "client_id": creds["client_id"],
        "redirect_uri": get_zoom_redirect_uri(),
        "state": str(user_id),  # pass user_id through OAuth state
    }
    return f"https://zoom.us/oauth/authorize?{urlencode(params)}"


async def exchange_zoom_code(db: Session, code: str, user_id: int) -> dict:
    """Exchange an authorization code for access + refresh tokens and store them."""
    creds = get_zoom_app_credentials(db)
    if not creds.get("client_id") or not creds.get("client_secret"):
        raise ValueError("Zoom OAuth app credentials not configured")

    auth_str = base64.b64encode(
        f"{creds['client_id']}:{creds['client_secret']}".encode()
    ).decode()

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://zoom.us/oauth/token",
            headers={
                "Authorization": f"Basic {auth_str}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": get_zoom_redirect_uri(),
            },
        )
        if resp.status_code != 200:
            raise ValueError(f"Zoom token exchange failed: {resp.text}")

        data = resp.json()
        access_token = data["access_token"]
        refresh_token = data["refresh_token"]
        expires_in = data.get("expires_in", 3600)
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

        # Get the user's Zoom email
        zoom_email = ""
        try:
            me_resp = await client.get(
                "https://api.zoom.us/v2/users/me",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if me_resp.status_code == 200:
                zoom_email = me_resp.json().get("email", "")
        except Exception:
            pass

        # Store or update token in DB
        existing = db.query(ZoomToken).filter(ZoomToken.user_id == user_id).first()
        if existing:
            existing.access_token = access_token
            existing.refresh_token = refresh_token
            existing.token_expires_at = expires_at
            existing.zoom_email = zoom_email
        else:
            token = ZoomToken(
                user_id=user_id,
                access_token=access_token,
                refresh_token=refresh_token,
                token_expires_at=expires_at,
                zoom_email=zoom_email,
            )
            db.add(token)
        db.commit()

        return {"zoom_email": zoom_email, "expires_at": expires_at.isoformat()}


async def refresh_zoom_token(db: Session, user_id: int) -> str:
    """Refresh an expired access token using the refresh token."""
    token_record = db.query(ZoomToken).filter(ZoomToken.user_id == user_id).first()
    if not token_record:
        raise ValueError("No Zoom account connected. Connect Zoom from Calendar page.")

    creds = get_zoom_app_credentials(db)
    if not creds.get("client_id") or not creds.get("client_secret"):
        raise ValueError("Zoom OAuth app credentials not configured")

    auth_str = base64.b64encode(
        f"{creds['client_id']}:{creds['client_secret']}".encode()
    ).decode()

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://zoom.us/oauth/token",
            headers={
                "Authorization": f"Basic {auth_str}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={
                "grant_type": "refresh_token",
                "refresh_token": token_record.refresh_token,
            },
        )
        if resp.status_code != 200:
            # Refresh failed — user needs to re-authorize
            db.delete(token_record)
            db.commit()
            raise ValueError("Zoom session expired. Please reconnect your Zoom account.")

        data = resp.json()
        token_record.access_token = data["access_token"]
        token_record.refresh_token = data.get("refresh_token", token_record.refresh_token)
        expires_in = data.get("expires_in", 3600)
        token_record.token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
        db.commit()

        return token_record.access_token


async def get_user_zoom_token(db: Session, user_id: int) -> str:
    """Get a valid access token for a user, refreshing if expired."""
    token_record = db.query(ZoomToken).filter(ZoomToken.user_id == user_id).first()
    if not token_record:
        raise ValueError("No Zoom account connected. Connect Zoom from Calendar page.")

    # Check if token is expired (with 5 min buffer)
    if token_record.token_expires_at <= datetime.now(timezone.utc) + timedelta(minutes=5):
        return await refresh_zoom_token(db, user_id)

    return token_record.access_token


# ─── Meeting Creation (per-user) ───

async def create_zoom_meeting(
    db: Session,
    user_id: int,
    topic: str,
    start_time: datetime,
    duration_minutes: int = 60,
    invitee_emails: list = None,
) -> dict:
    """Create a Zoom meeting under the user's own Zoom account."""
    token = await get_user_zoom_token(db, user_id)

    meeting_data = {
        "topic": topic,
        "type": 2,  # Scheduled meeting
        "start_time": start_time.strftime("%Y-%m-%dT%H:%M:%S"),
        "duration": duration_minutes,
        "timezone": "UTC",
        "settings": {
            "join_before_host": True,
            "waiting_room": False,
            "meeting_invitees": [{"email": e} for e in (invitee_emails or [])],
        },
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.zoom.us/v2/users/me/meetings",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json=meeting_data,
        )
        if resp.status_code not in (200, 201):
            raise ValueError(f"Failed to create Zoom meeting: {resp.text}")

        data = resp.json()
        return {
            "id": str(data.get("id", "")),
            "join_url": data.get("join_url", ""),
            "start_url": data.get("start_url", ""),
            "password": data.get("password", ""),
        }


def get_user_zoom_status(db: Session, user_id: int) -> dict:
    """Check if a user has Zoom connected."""
    token_record = db.query(ZoomToken).filter(ZoomToken.user_id == user_id).first()
    if not token_record:
        return {"connected": False}
    return {
        "connected": True,
        "zoom_email": token_record.zoom_email,
        "expires_at": token_record.token_expires_at.isoformat() if token_record.token_expires_at else None,
    }


def disconnect_user_zoom(db: Session, user_id: int):
    """Remove a user's Zoom connection."""
    token_record = db.query(ZoomToken).filter(ZoomToken.user_id == user_id).first()
    if token_record:
        db.delete(token_record)
        db.commit()
