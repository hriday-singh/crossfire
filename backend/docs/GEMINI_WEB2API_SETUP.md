# Gemini-Web2API Local Service Setup Guide

This guide details how backend developers should install, configure, and maintain the **`gemini-web2api`** bridge as an isolated, always-running background service.

---

## 1. Overview & Architecture

Crossfire's backend pipeline is configured **by default** to use an OpenAI-compatible interface running on `http://localhost:8081/v1`:

```
┌─────────────────────────┐          HTTP /v1           ┌─────────────────────────┐        Web / RPC        ┌───────────────────────┐
│    Crossfire Backend    │  ─────────────────────────> │     gemini-web2api      │  ─────────────────────> │     Google Gemini     │
│ (FastAPI / providers)   │   (OpenAI completions API)  │  (localhost:8081/v1)    │    (Zero-cost / free)   │  (Flash / Thinking)   │
└─────────────────────────┘                             └─────────────────────────┘                         └───────────────────────┘
```

* **Free tier access:** Anonymous access covers `gemini-3.6-flash`, `gemini-3.5-flash-thinking`, and `gemini-flash-lite` with **no API keys, subscriptions, or credit card required**.
* **Zero code changes:** `backend/config.py` and `backend/.env.example` already default to:
  * `LLM_PROVIDER=openai_compat`
  * `LLM_BASE_URL=http://localhost:8081/v1`
  * `LLM_MODEL=gemini-3.7-flash` (or `gemini-3.6-flash`, `gemini-3.5-flash-thinking`)

---

## 2. Recommended Directory Structure & `.gitignore`

Install `gemini-web2api` in a dedicated, isolated subfolder under `tools/gemini-web2api/` at the repository root.

```
crossfire/
├── .gitignore                    <-- Ignores tools/gemini-web2api/ and credentials
├── backend/
│   ├── config.py                 <-- Defaults to http://localhost:8081/v1
│   └── ...
└── tools/
    └── gemini-web2api/           <-- Isolated standalone clone (GIT-IGNORED)
        ├── .venv/                <-- Dedicated virtual environment
        ├── gemini_web2api.py
        └── cookie.txt (optional)
```

### Gitignore Rules

Ensure the following entries are present in your root `.gitignore`:

```gitignore
# ------------------------------------------------------------------------------
# Local Tooling & Web2API Services
# ------------------------------------------------------------------------------
tools/gemini-web2api/
gemini-web2api/
cookie.txt
```

*(This guarantees your team never accidentally commits the clone, virtualenv, or session cookies.)*

---

## 3. Installation Step-by-Step

Run these commands from the repository root:

### On Windows (PowerShell)

```powershell
# 1. Create tools directory and clone gemini-web2api into an isolated folder
mkdir tools -Force
git clone https://github.com/Sophomoresty/gemini-web2api.git tools/gemini-web2api

# 2. Navigate to the isolated service directory
Set-Location tools/gemini-web2api

# 3. Create a dedicated virtual environment
python -m venv .venv

# 4. Activate the virtual environment
.\.venv\Scripts\Activate.ps1

# 5. Install runtime dependencies
pip install --upgrade pip
pip install httpx

# 6. Test manual execution
python gemini_web2api.py
```

### On macOS / Linux (Bash)

```bash
# 1. Create tools directory and clone gemini-web2api into an isolated folder
mkdir -p tools
git clone https://github.com/Sophomoresty/gemini-web2api.git tools/gemini-web2api

# 2. Navigate to the isolated service directory
cd tools/gemini-web2api

# 3. Create a dedicated virtual environment
python3 -m venv .venv

# 4. Activate the virtual environment
source .venv/bin/activate

# 5. Install runtime dependencies
pip install --upgrade pip
pip install httpx

# 6. Test manual execution
python gemini_web2api.py
```

Press `Ctrl+C` once you verify it boots on `http://localhost:8081`. Now configure it to run persistently in the background.

---

## 4. Keeping it Always Running (Process Management)

Choose the setup matching your operating system or deployment preference:

### Option A: PM2 (Recommended for Cross-Platform Devs)

PM2 keeps the process running in the background, restarts it if it crashes, and restarts it automatically when your computer reboots.

1. **Install PM2 globally** (requires Node.js):
   ```bash
   npm install -g pm2
   ```

2. **Start the service**:
   * **Windows (PowerShell)**:
     ```powershell
     pm2 start tools/gemini-web2api/.venv/Scripts/python.exe --name "gemini-web2api" -- tools/gemini-web2api/gemini_web2api.py
     ```
   * **Linux / macOS**:
     ```bash
     pm2 start tools/gemini-web2api/.venv/bin/python --name "gemini-web2api" -- tools/gemini-web2api/gemini_web2api.py
     ```

3. **Save and enable auto-launch on reboot**:
   ```bash
   pm2 save
   pm2 startup
   ```

4. **Useful PM2 management commands**:
   ```bash
   pm2 status                 # Check status & uptime
   pm2 logs gemini-web2api    # View real-time request logs
   pm2 restart gemini-web2api # Restart service
   pm2 stop gemini-web2api    # Stop service
   ```

---

### Option B: Systemd Service (Linux / Ubuntu / WSL2)

If developing in Linux or running on a development server:

1. Create a service file:
   ```bash
   sudo nano /etc/systemd/system/gemini-web2api.service
   ```

2. Add the following unit configuration (update `<ABSOLUTE_PATH_TO_REPO>` and `<YOUR_USER>`):
   ```ini
   [Unit]
   Description=Gemini Web2API Local Proxy Service
   After=network.target

   [Service]
   Type=simple
   User=<YOUR_USER>
   WorkingDirectory=<ABSOLUTE_PATH_TO_REPO>/tools/gemini-web2api
   ExecStart=<ABSOLUTE_PATH_TO_REPO>/tools/gemini-web2api/.venv/bin/python gemini_web2api.py
   Restart=always
   RestartSec=3
   Environment=PYTHONUNBUFFERED=1

   [Install]
   WantedBy=multi-user.target
   ```

3. Enable and start:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now gemini-web2api
   sudo systemctl status gemini-web2api
   ```

---

### Option C: Windows Service via NSSM (Native Windows Background Daemon)

To run as a silent Windows Service that starts automatically on Windows boot without opening a terminal window:

1. Download [NSSM (Non-Sucking Service Manager)](https://nssm.cc/) or install via Scoop/Chocolatey:
   ```powershell
   scoop install nssm
   # or: choco install nssm
   ```

2. Install the service:
   ```powershell
   nssm install GeminiWeb2API "$PWD\tools\gemini-web2api\.venv\Scripts\python.exe" "$PWD\tools\gemini-web2api\gemini_web2api.py"
   nssm set GeminiWeb2API AppDirectory "$PWD\tools\gemini-web2api"
   nssm set GeminiWeb2API Start SERVICE_AUTO_START
   nssm start GeminiWeb2API
   ```

3. Verify:
   ```powershell
   nssm status GeminiWeb2API
   ```

---

### Option D: Docker Compose (Containerized)

If you prefer keeping your host clean with containers, create `tools/gemini-web2api/Dockerfile`:

```dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir httpx
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
RUN git clone https://github.com/Sophomoresty/gemini-web2api.git .
EXPOSE 8081
CMD ["python", "gemini_web2api.py"]
```

And add to your `docker-compose.yml`:
```yaml
services:
  gemini-web2api:
    build: ./tools/gemini-web2api
    container_name: gemini-web2api
    restart: always
    ports:
      - "8081:8081"
```

Start with:
```bash
docker compose up -d gemini-web2api
```

---

## 5. Verification & Health Check

Confirm the service is accepting completions locally:

### Using curl (PowerShell on Windows)

```powershell
curl.exe --% http://127.0.0.1:8081/v1/chat/completions -H "Content-Type: application/json" -d "{\"model\":\"gemini-3.5-flash\",\"messages\":[{\"role\":\"user\",\"content\":\"Ping\"}]}"
```

### Using curl (Bash on Linux / macOS)

```bash
curl http://127.0.0.1:8081/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gemini-3.5-flash","messages":[{"role":"user","content":"Ping"}]}'
```

Expected response shape:
```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Pong! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ]
}
```

---

## 6. Backend Integration in Crossfire

Backend developers do **not** need to modify application code.

1. Ensure your `backend/.env` mirrors `.env.example`:
   ```env
   LLM_PROVIDER=openai_compat
   LLM_BASE_URL=http://localhost:8081/v1
   LLM_MODEL=gemini-3.7-flash
   LLM_API_KEY=
   ```

2. Run tests to confirm provider connection:
   ```bash
   cd backend
   pytest tests/ -k "provider or openai_compat"
   ```

---

## 7. Optional: Using Gemini Pro with Cookies

Anonymous access routes all requests to free Flash/Thinking models. If you have a paid **Gemini Advanced** account and need true Pro model routing:

1. Sign in to [gemini.google.com](https://gemini.google.com) in your browser.
2. Open DevTools (F12) → **Application** → **Cookies** → `https://gemini.google.com`.
3. Copy the cookie values: `SID`, `HSID`, `SSID`, `APISID`, `SAPISID`, `__Secure-1PSID`.
4. Create `tools/gemini-web2api/cookie.txt` (already gitignored):
   ```text
   SID=...; HSID=...; SSID=...; APISID=...; SAPISID=...; __Secure-1PSID=...
   ```
5. Pass `--cookie-file cookie.txt` in your process manager start command.
