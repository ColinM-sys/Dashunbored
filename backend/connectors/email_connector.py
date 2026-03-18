import imaplib
import email
from email.header import decode_header
from email.utils import parsedate_to_datetime
from connectors.base import BaseConnector, ConnectorDocument, register_connector

# IMAP servers for common providers
IMAP_SERVERS = {
    "Gmail": "imap.gmail.com",
    "Outlook": "imap-mail.outlook.com",
}


def decode_str(s):
    """Decode email header strings."""
    if s is None:
        return ""
    decoded = decode_header(s)
    parts = []
    for part, charset in decoded:
        if isinstance(part, bytes):
            parts.append(part.decode(charset or "utf-8", errors="replace"))
        else:
            parts.append(part)
    return " ".join(parts)


def extract_email_body(msg):
    """Extract plain text body from an email message."""
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition", ""))
            if content_type == "text/plain" and "attachment" not in content_disposition:
                try:
                    charset = part.get_content_charset() or "utf-8"
                    body += part.get_payload(decode=True).decode(charset, errors="replace")
                except Exception:
                    pass
            elif content_type == "text/html" and not body and "attachment" not in content_disposition:
                try:
                    charset = part.get_content_charset() or "utf-8"
                    html = part.get_payload(decode=True).decode(charset, errors="replace")
                    # Strip HTML tags for plain text fallback
                    import re
                    body = re.sub(r"<[^>]+>", " ", html)
                    body = re.sub(r"\s+", " ", body).strip()
                except Exception:
                    pass
    else:
        content_type = msg.get_content_type()
        try:
            charset = msg.get_content_charset() or "utf-8"
            payload = msg.get_payload(decode=True)
            if payload:
                text = payload.decode(charset, errors="replace")
                if content_type == "text/html":
                    import re
                    text = re.sub(r"<[^>]+>", " ", text)
                    text = re.sub(r"\s+", " ", text).strip()
                body = text
        except Exception:
            pass
    return body.strip()


class EmailConnector(BaseConnector):
    connector_type = "email"
    display_name = "Email (Gmail / Outlook)"
    description = "Connect to Gmail or Outlook via IMAP and index email messages"
    icon = "mail"

    async def validate_connection(self, config: dict) -> bool:
        """Test IMAP connection with provided credentials."""
        provider = config.get("provider", "Gmail")
        email_addr = config.get("email", "")
        password = config.get("password", "")

        if not email_addr or not password:
            return False

        server = IMAP_SERVERS.get(provider)
        if not server:
            return False

        try:
            imap = imaplib.IMAP4_SSL(server)
            imap.login(email_addr, password)
            imap.logout()
            return True
        except Exception:
            return False

    async def fetch_documents(self, config: dict) -> list[ConnectorDocument]:
        """Fetch emails via IMAP and return as documents."""
        provider = config.get("provider", "Gmail")
        email_addr = config.get("email", "")
        password = config.get("password", "")
        folder = config.get("folder", "INBOX").strip() or "INBOX"
        max_emails = int(config.get("max_emails", 200))

        server = IMAP_SERVERS.get(provider)
        if not server:
            raise ValueError(f"Unknown provider: {provider}")

        imap = imaplib.IMAP4_SSL(server)
        imap.login(email_addr, password)

        # Select the folder
        status, data = imap.select(folder, readonly=True)
        if status != "OK":
            imap.logout()
            raise ValueError(f"Could not open folder: {folder}")

        # Search for all emails (most recent first)
        status, msg_ids = imap.search(None, "ALL")
        if status != "OK":
            imap.logout()
            return []

        id_list = msg_ids[0].split()
        # Take the most recent N emails
        id_list = id_list[-max_emails:]
        id_list.reverse()  # newest first

        documents = []
        for msg_id in id_list:
            try:
                status, msg_data = imap.fetch(msg_id, "(RFC822)")
                if status != "OK":
                    continue

                raw_email = msg_data[0][1]
                msg = email.message_from_bytes(raw_email)

                subject = decode_str(msg.get("Subject", "(No Subject)"))
                from_addr = decode_str(msg.get("From", "Unknown"))
                to_addr = decode_str(msg.get("To", ""))
                date_str = msg.get("Date", "")
                body = extract_email_body(msg)

                if not body.strip():
                    continue

                # Format the email as a readable document
                content = f"Subject: {subject}\nFrom: {from_addr}\nTo: {to_addr}\nDate: {date_str}\n\n{body}"

                # Create a clean filename from the subject
                safe_subject = "".join(c if c.isalnum() or c in " -_" else "" for c in subject)[:80]
                filename = f"email_{safe_subject.strip() or 'no_subject'}.txt"

                try:
                    parsed_date = parsedate_to_datetime(date_str).isoformat()
                except Exception:
                    parsed_date = ""

                documents.append(ConnectorDocument(
                    content=content,
                    filename=filename,
                    metadata={
                        "source": "email",
                        "provider": provider,
                        "subject": subject,
                        "from": from_addr,
                        "to": to_addr,
                        "date": parsed_date,
                        "folder": folder,
                    }
                ))
            except Exception:
                continue

        imap.logout()
        return documents

    def get_config_schema(self) -> dict:
        return {
            "provider": {
                "type": "select",
                "label": "Email Provider",
                "required": True,
                "options": ["Gmail", "Outlook"],
            },
            "email": {
                "type": "text",
                "label": "Email Address",
                "required": True,
                "placeholder": "you@gmail.com",
            },
            "password": {
                "type": "password",
                "label": "App Password",
                "required": True,
                "placeholder": "Gmail: App Password | Outlook: Account Password",
                "help": "Gmail: Use an App Password (Google Account → Security → App Passwords). Outlook: Use your account password with IMAP enabled.",
            },
            "folder": {
                "type": "text",
                "label": "Folder",
                "required": False,
                "default": "INBOX",
                "placeholder": "INBOX",
            },
            "max_emails": {
                "type": "text",
                "label": "Max Emails to Fetch",
                "required": False,
                "default": "200",
                "placeholder": "200",
            },
        }


register_connector(EmailConnector())
