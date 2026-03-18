import random
import string
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional

from fastapi.responses import RedirectResponse

from database import get_db, Organization, OrgMembership, CalendarEvent, User, ConnectorConfig, ZoomToken
from routers.auth import get_current_user

router = APIRouter(tags=["calendar"])


# ─── Pydantic Models ───

class OrgCreate(BaseModel):
    name: str
    description: str = ""


class OrgJoin(BaseModel):
    code: str


class MemberRoleUpdate(BaseModel):
    role: str  # "admin" or "member"


class EventCreate(BaseModel):
    title: str
    description: str = ""
    start_time: str  # ISO 8601
    end_time: str     # ISO 8601
    all_day: bool = False
    color: str = "#7c83ff"


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    all_day: Optional[bool] = None
    color: Optional[str] = None


class ScheduleRequest(BaseModel):
    title: str
    start_time: str
    end_time: str
    invitee_emails: List[str] = []
    create_zoom: bool = True


# ─── Helpers ───

def generate_join_code():
    """Generate a code like 'XK7-92M4'."""
    part1 = ''.join(random.choices(string.ascii_uppercase + string.digits, k=3))
    part2 = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"{part1}-{part2}"


def get_membership(user_id: int, org_id: int, db: Session) -> OrgMembership:
    """Verify user is a member of org."""
    mem = db.query(OrgMembership).filter(
        OrgMembership.user_id == user_id,
        OrgMembership.organization_id == org_id,
    ).first()
    if not mem:
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    return mem


def require_org_admin(user_id: int, org_id: int, db: Session) -> OrgMembership:
    """Verify user is owner or admin of org."""
    mem = get_membership(user_id, org_id, db)
    if mem.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin access required for this organization")
    return mem


def serialize_event(e: CalendarEvent) -> dict:
    return {
        "id": e.id,
        "organization_id": e.organization_id,
        "title": e.title,
        "description": e.description,
        "start_time": e.start_time.isoformat() if e.start_time else None,
        "end_time": e.end_time.isoformat() if e.end_time else None,
        "all_day": e.all_day,
        "color": e.color,
        "zoom_link": e.zoom_link,
        "invitees": e.invitees,
        "created_by": e.created_by,
        "creator_name": e.creator.username if e.creator else None,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


# ─── Organization Endpoints ───

@router.post("/api/orgs")
def create_org(data: OrgCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Generate unique join code
    for _ in range(10):
        code = generate_join_code()
        if not db.query(Organization).filter(Organization.join_code == code).first():
            break
    else:
        raise HTTPException(status_code=500, detail="Failed to generate unique code")

    org = Organization(
        name=data.name,
        description=data.description,
        join_code=code,
        owner_id=user.id,
    )
    db.add(org)
    db.commit()
    db.refresh(org)

    # Auto-add owner as member
    mem = OrgMembership(user_id=user.id, organization_id=org.id, role="owner")
    db.add(mem)
    db.commit()

    return {
        "id": org.id,
        "name": org.name,
        "join_code": org.join_code,
        "message": f"Organization '{org.name}' created",
    }


@router.get("/api/orgs")
def list_orgs(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    memberships = db.query(OrgMembership).filter(OrgMembership.user_id == user.id).all()
    orgs = []
    for mem in memberships:
        org = db.query(Organization).filter(Organization.id == mem.organization_id).first()
        if org:
            member_count = db.query(OrgMembership).filter(
                OrgMembership.organization_id == org.id
            ).count()
            orgs.append({
                "id": org.id,
                "name": org.name,
                "description": org.description,
                "join_code": org.join_code,
                "role": mem.role,
                "member_count": member_count,
                "created_at": org.created_at.isoformat() if org.created_at else None,
            })
    return {"organizations": orgs}


@router.post("/api/orgs/join")
def join_org(data: OrgJoin, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.join_code == data.code.upper().strip()).first()
    if not org:
        raise HTTPException(status_code=404, detail="Invalid organization code")

    existing = db.query(OrgMembership).filter(
        OrgMembership.user_id == user.id,
        OrgMembership.organization_id == org.id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already a member of this organization")

    mem = OrgMembership(user_id=user.id, organization_id=org.id, role="member")
    db.add(mem)
    db.commit()

    return {"message": f"Joined '{org.name}'", "org_id": org.id, "org_name": org.name}


@router.get("/api/orgs/{org_id}/members")
def list_members(org_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    get_membership(user.id, org_id, db)
    memberships = db.query(OrgMembership).filter(OrgMembership.organization_id == org_id).all()
    members = []
    for mem in memberships:
        u = db.query(User).filter(User.id == mem.user_id).first()
        if u:
            members.append({
                "user_id": u.id,
                "username": u.username,
                "role": mem.role,
                "joined_at": mem.joined_at.isoformat() if mem.joined_at else None,
            })
    return {"members": members}


@router.patch("/api/orgs/{org_id}/members/{member_user_id}")
def update_member_role(
    org_id: int,
    member_user_id: int,
    data: MemberRoleUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_org_admin(user.id, org_id, db)
    if data.role not in ("admin", "member"):
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'member'")

    mem = db.query(OrgMembership).filter(
        OrgMembership.user_id == member_user_id,
        OrgMembership.organization_id == org_id,
    ).first()
    if not mem:
        raise HTTPException(status_code=404, detail="Member not found")
    if mem.role == "owner":
        raise HTTPException(status_code=400, detail="Cannot change owner's role")

    mem.role = data.role
    db.commit()
    return {"message": f"Role updated to {data.role}"}


@router.delete("/api/orgs/{org_id}/members/{member_user_id}")
def remove_member(
    org_id: int,
    member_user_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_org_admin(user.id, org_id, db)
    mem = db.query(OrgMembership).filter(
        OrgMembership.user_id == member_user_id,
        OrgMembership.organization_id == org_id,
    ).first()
    if not mem:
        raise HTTPException(status_code=404, detail="Member not found")
    if mem.role == "owner":
        raise HTTPException(status_code=400, detail="Cannot remove the owner")

    db.delete(mem)
    db.commit()
    return {"message": "Member removed"}


@router.delete("/api/orgs/{org_id}/leave")
def leave_org(org_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    mem = get_membership(user.id, org_id, db)
    if mem.role == "owner":
        raise HTTPException(status_code=400, detail="Owner cannot leave. Transfer ownership first.")
    db.delete(mem)
    db.commit()
    return {"message": "Left organization"}


# ─── Calendar Event Endpoints ───

@router.get("/api/orgs/{org_id}/events")
def list_events(
    org_id: int,
    month: str = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_membership(user.id, org_id, db)
    query = db.query(CalendarEvent).filter(CalendarEvent.organization_id == org_id)

    if month:
        try:
            year, mon = month.split("-")
            start = datetime(int(year), int(mon), 1, tzinfo=timezone.utc)
            if int(mon) == 12:
                end = datetime(int(year) + 1, 1, 1, tzinfo=timezone.utc)
            else:
                end = datetime(int(year), int(mon) + 1, 1, tzinfo=timezone.utc)
            query = query.filter(CalendarEvent.start_time >= start, CalendarEvent.start_time < end)
        except (ValueError, IndexError):
            pass

    events = query.order_by(CalendarEvent.start_time).all()
    return {"events": [serialize_event(e) for e in events]}


@router.get("/api/orgs/{org_id}/events/week")
def week_events(org_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    get_membership(user.id, org_id, db)
    now = datetime.now(timezone.utc)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=7)

    events = db.query(CalendarEvent).filter(
        CalendarEvent.organization_id == org_id,
        CalendarEvent.start_time >= start,
        CalendarEvent.start_time < end,
    ).order_by(CalendarEvent.start_time).all()

    return {"events": [serialize_event(e) for e in events]}


@router.post("/api/orgs/{org_id}/events")
def create_event(
    org_id: int,
    data: EventCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_membership(user.id, org_id, db)

    event = CalendarEvent(
        organization_id=org_id,
        title=data.title,
        description=data.description,
        start_time=datetime.fromisoformat(data.start_time),
        end_time=datetime.fromisoformat(data.end_time),
        all_day=data.all_day,
        color=data.color,
        created_by=user.id,
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    return serialize_event(event)


@router.patch("/api/orgs/{org_id}/events/{event_id}")
def update_event(
    org_id: int,
    event_id: int,
    data: EventUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    mem = get_membership(user.id, org_id, db)
    event = db.query(CalendarEvent).filter(
        CalendarEvent.id == event_id,
        CalendarEvent.organization_id == org_id,
    ).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Only creator or admin can edit
    if event.created_by != user.id and mem.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only the creator or an admin can edit this event")

    if data.title is not None:
        event.title = data.title
    if data.description is not None:
        event.description = data.description
    if data.start_time is not None:
        event.start_time = datetime.fromisoformat(data.start_time)
    if data.end_time is not None:
        event.end_time = datetime.fromisoformat(data.end_time)
    if data.all_day is not None:
        event.all_day = data.all_day
    if data.color is not None:
        event.color = data.color

    db.commit()
    db.refresh(event)
    return serialize_event(event)


@router.delete("/api/orgs/{org_id}/events/{event_id}")
def delete_event(
    org_id: int,
    event_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    mem = get_membership(user.id, org_id, db)
    event = db.query(CalendarEvent).filter(
        CalendarEvent.id == event_id,
        CalendarEvent.organization_id == org_id,
    ).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event.created_by != user.id and mem.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only the creator or an admin can delete this event")

    db.delete(event)
    db.commit()
    return {"message": "Event deleted"}


# ─── SMTP + Zoom Scheduling ───

SMTP_SERVERS = {
    "Gmail": ("smtp.gmail.com", 587),
    "Outlook": ("smtp-mail.outlook.com", 587),
}


def get_email_credentials(db: Session) -> dict:
    """Load the first active email connector's SMTP credentials."""
    connector = db.query(ConnectorConfig).filter(
        ConnectorConfig.connector_type == "email",
        ConnectorConfig.is_active == True,
    ).first()
    if not connector:
        return {}
    try:
        config = json.loads(connector.config_json)
        return {
            "provider": config.get("provider", "Gmail"),
            "email": config.get("email", ""),
            "password": config.get("password", ""),
        }
    except Exception:
        return {}


def send_invite_email(
    smtp_creds: dict,
    to_emails: list,
    subject: str,
    meeting_title: str,
    start_time: str,
    end_time: str,
    zoom_link: str = "",
    organizer_name: str = "",
):
    """Send a meeting invite email via SMTP."""
    provider = smtp_creds.get("provider", "Gmail")
    from_email = smtp_creds["email"]
    password = smtp_creds["password"]

    server_host, server_port = SMTP_SERVERS.get(provider, ("smtp.gmail.com", 587))

    body = f"""You've been invited to a meeting!

📅 {meeting_title}
🕐 {start_time} — {end_time}
👤 Organized by: {organizer_name or from_email}
"""
    if zoom_link:
        body += f"\n🔗 Join Zoom: {zoom_link}\n"

    body += "\n— Sent via AdminDashboard Calendar"

    for to_email in to_emails:
        msg = MIMEMultipart()
        msg["From"] = from_email
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        try:
            server = smtplib.SMTP(server_host, server_port)
            server.starttls()
            server.login(from_email, password)
            server.send_message(msg)
            server.quit()
        except Exception as e:
            print(f"Failed to send invite to {to_email}: {e}")


@router.post("/api/orgs/{org_id}/events/schedule")
async def schedule_meeting(
    org_id: int,
    data: ScheduleRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a scheduled meeting: optionally creates Zoom, adds calendar event, sends email invites."""
    get_membership(user.id, org_id, db)

    zoom_link = ""
    zoom_meeting_id = ""

    # 1. Create Zoom meeting if requested (under the user's own Zoom account)
    if data.create_zoom:
        try:
            from services.zoom_service import create_zoom_meeting

            start_dt = datetime.fromisoformat(data.start_time)
            end_dt = datetime.fromisoformat(data.end_time)
            duration = max(int((end_dt - start_dt).total_seconds() / 60), 15)

            zoom = await create_zoom_meeting(
                db=db,
                user_id=user.id,
                topic=data.title,
                start_time=start_dt,
                duration_minutes=duration,
                invitee_emails=data.invitee_emails,
            )
            zoom_link = zoom.get("join_url", "")
            zoom_meeting_id = zoom.get("id", "")
        except Exception as e:
            # Zoom is optional — continue even if it fails
            print(f"Zoom creation failed: {e}")

    # 2. Create calendar event
    event = CalendarEvent(
        organization_id=org_id,
        title=data.title,
        description=f"Zoom: {zoom_link}" if zoom_link else "",
        start_time=datetime.fromisoformat(data.start_time),
        end_time=datetime.fromisoformat(data.end_time),
        color="#4285f4",
        zoom_link=zoom_link,
        zoom_meeting_id=zoom_meeting_id,
        invitees=",".join(data.invitee_emails),
        created_by=user.id,
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    # 3. Send email invites
    if data.invitee_emails:
        smtp_creds = get_email_credentials(db)
        if smtp_creds.get("email") and smtp_creds.get("password"):
            send_invite_email(
                smtp_creds=smtp_creds,
                to_emails=data.invitee_emails,
                subject=f"Meeting Invite: {data.title}",
                meeting_title=data.title,
                start_time=data.start_time,
                end_time=data.end_time,
                zoom_link=zoom_link,
                organizer_name=user.username,
            )

    return {
        **serialize_event(event),
        "zoom_join_url": zoom_link,
        "invites_sent": len(data.invitee_emails) if data.invitee_emails else 0,
    }


# ─── Public Availability + Booking ───

class BookingRequest(BaseModel):
    name: str
    email: str
    start_time: str  # ISO 8601
    end_time: str     # ISO 8601
    message: str = ""


@router.get("/api/availability/{username}")
def get_availability(username: str, db: Session = Depends(get_db)):
    """Public endpoint: return a user's available time slots for the next 14 days."""
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Find user's first org (for calendar events)
    membership = db.query(OrgMembership).filter(OrgMembership.user_id == user.id).first()
    org_name = ""
    org_id = None
    if membership:
        org = db.query(Organization).filter(Organization.id == membership.organization_id).first()
        if org:
            org_name = org.name
            org_id = org.id

    # Generate slots: 9am-5pm Mon-Fri, 1-hour blocks, next 14 days
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Get existing events to subtract
    end_range = today + timedelta(days=14)
    existing_events = []
    if org_id:
        existing_events = db.query(CalendarEvent).filter(
            CalendarEvent.organization_id == org_id,
            CalendarEvent.start_time >= today,
            CalendarEvent.start_time < end_range,
        ).all()

    busy_ranges = [(e.start_time, e.end_time) for e in existing_events]

    available_slots = []
    for day_offset in range(14):
        day = today + timedelta(days=day_offset)
        # Skip weekends
        if day.weekday() >= 5:
            continue
        # Skip past hours for today
        for hour in range(9, 17):  # 9am to 5pm
            slot_start = day.replace(hour=hour, minute=0, second=0, microsecond=0)
            slot_end = slot_start + timedelta(hours=1)

            # Skip if in the past
            if slot_start <= now:
                continue

            # Skip if overlaps with any existing event
            is_busy = any(
                slot_start < busy_end and slot_end > busy_start
                for busy_start, busy_end in busy_ranges
            )
            if is_busy:
                continue

            available_slots.append({
                "date": slot_start.strftime("%Y-%m-%d"),
                "start": slot_start.strftime("%H:%M"),
                "end": slot_end.strftime("%H:%M"),
                "start_time": slot_start.isoformat(),
                "end_time": slot_end.isoformat(),
            })

    return {
        "user": user.username,
        "org": org_name,
        "available_slots": available_slots,
    }


@router.post("/api/availability/{username}/book")
async def book_slot(username: str, data: BookingRequest, db: Session = Depends(get_db)):
    """Public endpoint: book a time slot with a user."""
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    membership = db.query(OrgMembership).filter(OrgMembership.user_id == user.id).first()
    if not membership:
        raise HTTPException(status_code=400, detail="User has no organization")

    org_id = membership.organization_id

    # Verify the slot is still free
    start_dt = datetime.fromisoformat(data.start_time)
    end_dt = datetime.fromisoformat(data.end_time)

    conflict = db.query(CalendarEvent).filter(
        CalendarEvent.organization_id == org_id,
        CalendarEvent.start_time < end_dt,
        CalendarEvent.end_time > start_dt,
    ).first()
    if conflict:
        raise HTTPException(status_code=409, detail="This time slot is no longer available")

    # Create Zoom meeting under the booked user's Zoom account
    zoom_link = ""
    zoom_meeting_id = ""
    try:
        from services.zoom_service import create_zoom_meeting
        duration = max(int((end_dt - start_dt).total_seconds() / 60), 15)
        zoom = await create_zoom_meeting(
            db=db,
            user_id=user.id,
            topic=f"Meeting with {data.name}",
            start_time=start_dt,
            duration_minutes=duration,
            invitee_emails=[data.email],
        )
        zoom_link = zoom.get("join_url", "")
        zoom_meeting_id = zoom.get("id", "")
    except Exception as e:
        print(f"Zoom creation failed for booking: {e}")

    # Create calendar event
    event = CalendarEvent(
        organization_id=org_id,
        title=f"Meeting with {data.name}",
        description=data.message or f"Booked by {data.name} ({data.email})",
        start_time=start_dt,
        end_time=end_dt,
        color="#34a853",
        zoom_link=zoom_link,
        zoom_meeting_id=zoom_meeting_id,
        invitees=data.email,
        created_by=user.id,
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    # Send email invites to both parties
    smtp_creds = get_email_credentials(db)
    if smtp_creds.get("email") and smtp_creds.get("password"):
        send_invite_email(
            smtp_creds=smtp_creds,
            to_emails=[data.email],
            subject=f"Meeting Confirmed: Meeting with {user.username}",
            meeting_title=f"Meeting with {user.username}",
            start_time=data.start_time,
            end_time=data.end_time,
            zoom_link=zoom_link,
            organizer_name=user.username,
        )

    return {
        "message": "Booking confirmed!",
        "event_title": event.title,
        "start_time": event.start_time.isoformat(),
        "end_time": event.end_time.isoformat(),
        "zoom_link": zoom_link,
    }


# ─── Zoom OAuth Endpoints (per-user) ───

@router.get("/api/zoom/connect")
def zoom_connect(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return the Zoom OAuth URL for the user to authorize their Zoom account."""
    from services.zoom_service import get_zoom_auth_url
    try:
        url = get_zoom_auth_url(db, user.id)
        return {"auth_url": url}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/zoom/callback")
async def zoom_callback(code: str = None, state: str = None, error: str = None, db: Session = Depends(get_db)):
    """Handle OAuth callback from Zoom after user authorizes."""
    if error:
        return RedirectResponse("http://localhost:3001/?zoom=error")

    if not code or not state:
        return RedirectResponse("http://localhost:3001/?zoom=error")

    try:
        user_id = int(state)
    except (ValueError, TypeError):
        return RedirectResponse("http://localhost:3001/?zoom=error")

    try:
        from services.zoom_service import exchange_zoom_code
        await exchange_zoom_code(db, code, user_id)
        return RedirectResponse("http://localhost:3001/?zoom=success")
    except Exception as e:
        print(f"Zoom OAuth callback error: {e}")
        return RedirectResponse("http://localhost:3001/?zoom=error")


@router.get("/api/zoom/status")
def zoom_status(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Check if the current user has Zoom connected."""
    from services.zoom_service import get_user_zoom_status
    return get_user_zoom_status(db, user.id)


@router.delete("/api/zoom/disconnect")
def zoom_disconnect(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Disconnect the current user's Zoom account."""
    from services.zoom_service import disconnect_user_zoom
    disconnect_user_zoom(db, user.id)
    return {"message": "Zoom disconnected"}


# ─── Per-User Settings ───

class UserSettingsUpdate(BaseModel):
    hubspot_meeting_link: Optional[str] = None


@router.get("/api/user/settings")
def get_user_settings(user: User = Depends(get_current_user)):
    """Get the current user's personal settings."""
    try:
        settings = json.loads(user.settings_json) if user.settings_json else {}
    except Exception:
        settings = {}
    return {
        "hubspot_meeting_link": settings.get("hubspot_meeting_link", ""),
    }


@router.put("/api/user/settings")
def update_user_settings(
    data: UserSettingsUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the current user's personal settings."""
    try:
        settings = json.loads(user.settings_json) if user.settings_json else {}
    except Exception:
        settings = {}

    if data.hubspot_meeting_link is not None:
        settings["hubspot_meeting_link"] = data.hubspot_meeting_link.strip()

    user.settings_json = json.dumps(settings)
    db.commit()
    return {"message": "Settings saved", **settings}
