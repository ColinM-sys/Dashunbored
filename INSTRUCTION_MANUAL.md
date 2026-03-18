# AdminDashbored — Quick Start Guide

---

## Getting Started

**Login:** Navigate to `http://localhost:3001`. Default credentials: `admin` / `admin`.
**First steps:** Connect your data sources, set up your AI keys, and create an organization.

---

## Pages at a Glance

| Page | Access | What it does |
|------|--------|-------------|
| **Chat** | All users | AI conversations, file uploads, homepage widgets |
| **Calendar** | All users | Team calendar, Zoom scheduling, booking links |
| **Admin** | Admin only | Connectors, API keys, models, prompts, branding |
| **Booking** (`/book/username`) | Public | Anyone can book a meeting with you — no login needed |

---

## Chat Page

- **Start a conversation** — Type a message. The AI responds in real time via streaming.
- **Pick a model** — Use the dropdown to choose between Claude (Opus/Sonnet/Haiku) or local Ollama models.
- **Attach files** — Click `+` or drag-and-drop. Files go to your active knowledge base.
- **Search the web** — Click the search icon to open the web search panel (DuckDuckGo).
- **Knowledge bases** — Select one (or "All Sources") to give the AI context from your documents.
- **Edit & regenerate** — Click a user message to edit it, or click regenerate on an AI response.
- **Export** — Download any conversation as a markdown file.
- **Schedule meetings via AI** — Just tell the AI: *"Schedule a Zoom call with sarah@email.com Friday at 2pm"*. It shows a confirmation card — click Confirm and it creates the Zoom meeting, adds the calendar event, and sends the invite email automatically.

### Homepage Widgets (visible when no conversation is open)
- **Calendar slider** — Next 4 days with upcoming events
- **Images** — Recent images from connected services
- **Documents** — Recent documents with source info
- **Email preview** — Last few emails from your connected inbox

---

## Calendar Page

- **Create an Organization** — Click "+ Create Org" and share the join code with your team.
- **Join an Organization** — Click "Join Org" and enter the code (e.g. `XK7-92M4`).
- **Add events** — Click "+ Add Event" or double-click a day. Set title, time, color.
- **View events** — Click any day to see all events. Click an event to edit or delete it.
- **Navigate months** — Use `<` `>` arrows or click "Today" to jump back.
- **Connect Zoom** — In the sidebar under "Zoom Account", click "Connect Zoom" to link your personal Zoom. Meetings are created under your own account.
- **Share your booking link** — Copy your link (`/book/your-username`) from the sidebar. Anyone with the link can book time with you.
- **HubSpot link** — Optionally paste your HubSpot Meetings link as an alternative scheduling option.
- **Manage members** — Org owners/admins can change roles or remove members.

---

## Admin Dashboard (Admin users only)

### Data Connectors
Connect external services to make their data searchable by the AI.

| Category | Connectors |
|----------|-----------|
| **Cloud Storage** | Dropbox, Google Drive, SharePoint, AWS S3, Azure Blob |
| **Communication** | Email (Gmail/Outlook via IMAP), Slack, Microsoft Teams |
| **Business Systems** | Database (SQL), Salesforce, HubSpot, Web Scraper |
| **Local** | Local Files (always available) |

**To connect:** Click any connector → enter credentials → Save → Sync. Documents are automatically chunked, embedded, and added to a knowledge base.

### API Keys
- **Anthropic (Claude)** — Paste your API key from `console.anthropic.com`. Required for Claude models.
- **Zoom OAuth** — Enter Client ID and Client Secret from your Zoom Marketplace app. Employees then connect their own Zoom accounts individually from the Calendar page.

### Models
View all available AI models (local Ollama + cloud Claude). Shows parameter count, quantization, and file size.

### System Prompts
Set default behavior instructions for each model. Use "Default (all models)" for a global prompt.

### Analytics
Track usage: total conversations, messages, model breakdown, and recent activity.

### Branding
Customize the app name, accent color, and logo text for white-labeling.

---

## Connectors — How to Connect

### Email (Gmail)
1. Go to Admin > Data Connectors > Email
2. Select "Gmail" as provider
3. Enter your Gmail address
4. For password: use a Google App Password (not your regular password)
   - Go to myaccount.google.com > Security > 2-Step Verification > App Passwords
5. Save and Sync

### Email (Outlook)
1. Same as above but select "Outlook"
2. Use your Outlook email and password (or app password if 2FA enabled)

### Dropbox
1. Go to Admin > Data Connectors > Dropbox
2. Enter your Dropbox API access token
3. Optionally set a folder path to sync from
4. Save and Sync

### Google Drive
1. Enter your Google Drive API credentials (service account JSON or OAuth)
2. Set folder ID to sync specific folders
3. Save and Sync

### Web Scraper
1. Enter a URL to scrape
2. The scraper extracts text content and indexes it as a document

### Database
1. Enter connection string (e.g. `postgresql://user:pass@host/db`)
2. Specify table or query to extract data from

---

## Zoom Setup (One-Time Admin Setup)

1. Go to [marketplace.zoom.us/develop/create](https://marketplace.zoom.us/develop/create)
2. Create a new app → Select **"User-managed OAuth"** type
3. Set Redirect URL to: `http://localhost:3000/api/zoom/callback`
4. Copy the **Client ID** and **Client Secret**
5. In AdminDashbored: Admin > API Keys > Zoom Integration → paste and save
6. Each team member then clicks "Connect Zoom" on their Calendar page to link their own Zoom account

---

## Public Booking Page

Share `http://localhost:3001/book/your-username` with anyone.

They'll see:
- Your available time slots (Mon-Fri, 9am-5pm, excluding existing events)
- A date picker for the next 2 weeks
- A booking form (name, email, optional message)

When they book:
- A Zoom meeting is auto-created (if you have Zoom connected)
- A calendar event is added to your org's shared calendar
- An email invite is sent to both parties (if email connector is active)

---

## User Roles

| Role | Chat | Calendar | Admin | Manage Members |
|------|------|----------|-------|---------------|
| **Admin** | Yes | Yes | Yes | Yes (if org owner/admin) |
| **User** | Yes | Yes | No | Only if org owner/admin |

**Organization Roles:**
- **Owner** — Full control, cannot be removed
- **Admin** — Can edit events, manage members
- **Member** — Can view and create events

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Send message | `Enter` |
| New line in message | `Shift + Enter` |

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React 19, port 3001 |
| Backend | FastAPI (Python), port 3000 |
| Database | SQLite |
| Vector DB | ChromaDB |
| Embeddings | all-MiniLM-L6-v2 |
| AI | Claude (Anthropic API) + Ollama (local) |
| Auth | JWT (24-hour tokens) |
| Theme | Dark/Light mode toggle |

---

*AdminDashbored — AI-powered team dashboard with chat, knowledge bases, scheduling, and integrations.*
