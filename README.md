# Dashunbored

> **Winner — NVIDIA GTC Hackathon 2026 (Shortest Hackathon)**

A unified creative operating system for designers, photographers, and digital artists. Real-time collaboration, AI-driven augmentation, and local model support — all in one dashboard. Built on **NVIDIA DGX Spark (GB10)** at GTC San Jose.

**[Watch Demo Video](https://github.com/ColinM-sys/Dashunbored/releases/tag/v1.0)**

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, port 3001 |
| Backend | FastAPI (Python), port 3002 |
| Database | SQLite |
| Vector DB | ChromaDB |
| Embeddings | all-MiniLM-L6-v2 (local) |
| AI (Cloud) | Claude via Anthropic API |
| AI (Local) | Ollama — qwen2.5:72b, llama3.2-vision:11b |
| Image Gen | ComfyUI + Stable Diffusion (port 8188) |

---

## Quick Start

### Running Locally

**1. Backend**
```bash
cd backend
pip install fastapi uvicorn anthropic pydantic-settings sqlalchemy chromadb sentence-transformers httpx python-multipart
mkdir -p ../data/chroma ../data/uploads ../data/images
uvicorn main:app --host 0.0.0.0 --port 3002 --reload
```

**2. Frontend**
```bash
cd frontend
npm install
npm start
```

Open `http://localhost:3001` — login with `admin` / `admin`.

---

### Running on NVIDIA DGX Spark (GB10)

**On the DGX Spark — install and run:**
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen2.5:72b
ollama pull llama3.2-vision:11b

# Install ComfyUI
git clone https://github.com/comfyanonymous/ComfyUI.git ~/ComfyUI
cd ~/ComfyUI && pip3 install -r requirements.txt --break-system-packages

# Start everything
cd ~/Dashunbored/backend
mkdir -p ../data/chroma ../data/uploads ../data/images
pip3 install fastapi uvicorn pydantic-settings sqlalchemy chromadb sentence-transformers httpx python-multipart --break-system-packages
uvicorn main:app --host 0.0.0.0 --port 3002 &

cd ~/Dashunbored/frontend
npm install && npm start &

python3 ~/ComfyUI/main.py --listen 0.0.0.0 --port 8188 --cpu &
```

Access from any device on your network: `http://SPARK_IP:3001`

---

## Pages & Features

### Chat
The main AI workspace. Supports streaming responses, file uploads, knowledge base selection, and conversation history.

- **Model selector** — switch between Claude models (cloud) or Ollama models (local, no API cost)
  - `qwen2.5:72b` — best for creative writing, briefs, style direction
  - `llama3.2-vision:11b` — upload photos for AI analysis
- **Knowledge bases** — select one or all sources to give the AI context from your connected tools
- **File upload** — drag and drop files into chat (images, PDFs, docs)
- **Edit & regenerate** — click any message to edit or regenerate
- **Export** — download any conversation as markdown
- **Web search** — built-in DuckDuckGo search panel

**Homepage widgets** (visible when no chat is open):
- Calendar — next 4 days of events
- Images — synced photos from connected services
- Documents — recent docs with source info
- APPS/API INPUTS — grouped by category (Creative Tools, Storage, Communication, Business)

### 🎨 Studio
Visual asset hub. See all synced content from connected creative tools in one place — Lightroom photos, Figma files, Frame.io clips, Behance boards.

### 🖼 Stable Diffusion
Local AI image generation powered by ComfyUI running on the GB10.

- Text-to-image with prompt and negative prompt
- Style presets: Photorealistic, Cinematic, Studio Portrait, Editorial, Golden Hour, B&W, Concept Art, Watercolor
- Size options: Square, Portrait, Landscape, Wide
- Adjustable steps and CFG scale
- Generated images saved to gallery
- No API cost — runs entirely on local hardware

### ✦ Agent
Creative AI agent that can autonomously complete multi-step tasks using your connected knowledge bases.

**Example tasks (no API key needed with Ollama):**
- Generate a mood board brief from your CC Library assets
- Write a photography brief from a Lightroom album
- Analyze a Figma file and summarize design decisions
- Draft creative direction from a client brief document

### 📅 Calendar
Shared team calendar with Zoom scheduling.

- Create organizations and invite team members with a join code
- Add/edit/delete events with color coding
- Connect personal Zoom — AI can schedule meetings from chat
- Public booking link: `/book/your-username`

### ✉️ Email
Email client for Gmail and Outlook.

- Read, compose, and manage email
- AI-assisted drafting from the chat interface
- Email signature builder

### ⚙️ Connectors (Admin)
Connect external data sources to make their content searchable by the AI.

**Creative Tools:**
| Connector | What it syncs |
|---|---|
| Adobe Creative Cloud | Lightroom albums, photo metadata, CC Library colors/styles/graphics |
| Figma | Design files, components, styles, review comments |
| Frame.io | Video projects, clip metadata, timecoded review comments |
| Behance | Portfolio projects and inspiration |
| Unsplash | Stock photography collections |
| Notion | Pages, databases, project briefs |

**Storage & Files:**
| Connector | What it syncs |
|---|---|
| Dropbox | Files and folders |
| Google Drive | Drive files |
| SharePoint | Microsoft 365 documents |
| AWS S3 | S3 bucket contents |
| Local Files | Always available — upload directly |

**Communication:**
| Connector | What it syncs |
|---|---|
| Email (Gmail/Outlook) | Inbox messages |
| Slack | Channels and DMs |

**Business:**
| Connector | What it syncs |
|---|---|
| HubSpot | CRM contacts and deals |
| Web Scraper | Any public URL |

**To connect:** Admin → Connectors → click a connector → enter credentials → Save → Sync.

---

## API Keys

Go to Admin → API Keys:

- **Anthropic (Claude)** — required for Claude models. Get from `console.anthropic.com`. Not needed if using Ollama local models.
- **Zoom** — Client ID + Secret from Zoom Marketplace. Enables AI-scheduled meetings.

> **Running without API keys:** Select `qwen2.5:72b` or `llama3.2-vision:11b` from the model dropdown. All chat, agent, and image scoring features work fully local at zero cost.

---

## Photo Scoring (llama3.2-vision)

Upload any photo in the Agent page to get an AI score on how well it will perform when posted:

- Overall score (0–100)
- Breakdown: composition, lighting, color, sharpness, subject clarity
- Specific improvement suggestions
- Platform-specific notes

Select `llama3.2-vision:11b` as your model for best results.

---

---

## Booking Page

Share `http://YOUR_IP:3001/book/your-username` publicly. Visitors see your availability and can book meetings — no login required.

---

## Default Login

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `admin` |

Change in Admin → Settings after first login.

---

## Local Model Setup (No API Cost)

```bash
# On the Spark
ollama pull qwen2.5:72b          # 47GB — best for creative tasks
ollama pull llama3.2-vision:11b  # 7.8GB — photo/image analysis
```

Configure Ollama to accept remote connections:
```bash
sudo mkdir -p /etc/systemd/system/ollama.service.d
echo -e "[Service]\nEnvironment=OLLAMA_HOST=0.0.0.0" | sudo tee /etc/systemd/system/ollama.service.d/override.conf
sudo systemctl daemon-reload && sudo systemctl restart ollama
```


---

## Author

Built by **Colin McDonough** — [LinkedIn](https://www.linkedin.com/in/colinmcdonoughmarketing) · [GitHub](https://github.com/ColinM-sys)
