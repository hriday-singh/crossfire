#!/usr/bin/env bash
# Unified launcher for Crossfire on macOS/Linux (equivalent of run_all.ps1).
set -uo pipefail

BACKEND_PORT=8000
FRONTEND_PORT=5173
NO_BROWSER=false
LEAVE_OPEN=false
FORCE_SETUP=false

for arg in "$@"; do
    case "$arg" in
        --setup) FORCE_SETUP=true ;;
        --no-browser) NO_BROWSER=true ;;
        --leave-open) LEAVE_OPEN=true ;;
        --backend-port=*) BACKEND_PORT="${arg#*=}" ;;
        --frontend-port=*) FRONTEND_PORT="${arg#*=}" ;;
    esac
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
LOG_DIR="$ROOT_DIR/.run_logs"
mkdir -p "$LOG_DIR"

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
    if $LEAVE_OPEN; then return; fi
    echo ""
    echo "======================================================================"
    echo " Stopping all spawned Crossfire services..."
    echo "======================================================================"
    for pid in "$BACKEND_PID" "$FRONTEND_PID"; do
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            echo "  Stopping PID $pid..."
            kill -TERM "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null
        fi
    done
    echo "  [OK] All spawned services terminated."
}
trap cleanup EXIT INT TERM

port_open() {
    local port="$1"
    (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null && exec 3>&- || return 1
}

http_ok() {
    local url="$1"
    curl -fsS -o /dev/null -m 2 "$url" 2>/dev/null
}

wait_until_ready() {
    local name="$1" timeout="$2"; shift 2
    echo -n "    Waiting for $name to respond"
    local start
    start=$(date +%s)
    while [ $(( $(date +%s) - start )) -lt "$timeout" ]; do
        if "$@"; then
            echo " [READY]"
            return 0
        fi
        echo -n "."
        sleep 0.6
    done
    echo " [TIMEOUT]"
    return 1
}

echo ""
echo "======================================================================"
echo "              CROSSFIRE - Decision-Testing Engine Launcher            "
echo "======================================================================"
echo ""

# -----------------------------------------------------------------------
# Auto-setup verification
# -----------------------------------------------------------------------
BACKEND_VENV_PY="$BACKEND_DIR/.venv/bin/python"
BACKEND_UVICORN="$BACKEND_DIR/.venv/bin/uvicorn"
FRONTEND_MODULES="$FRONTEND_DIR/node_modules"
BACKEND_ENV="$BACKEND_DIR/.env"

NEEDS_SETUP=false
$FORCE_SETUP && NEEDS_SETUP=true
[ -f "$BACKEND_VENV_PY" ] && [ -f "$BACKEND_UVICORN" ] || NEEDS_SETUP=true
[ -d "$FRONTEND_MODULES" ] || NEEDS_SETUP=true
[ -f "$BACKEND_ENV" ] || NEEDS_SETUP=true

if $NEEDS_SETUP; then
    echo "[*] Setup required (missing or uninitialized virtual environment / dependencies). Running setup..."
    if [ -f "$ROOT_DIR/setup.sh" ]; then
        bash "$ROOT_DIR/setup.sh" || { echo "[ERROR] Setup failed." >&2; exit 1; }
    else
        echo "[ERROR] setup.sh not found in $ROOT_DIR." >&2
        exit 1
    fi
fi

echo "    [OK] Python virtual environment verified: $BACKEND_VENV_PY"

# -----------------------------------------------------------------------
# 1. Backend API
# -----------------------------------------------------------------------
echo ""
echo "[1/2] Crossfire Backend API (:$BACKEND_PORT)..."

if port_open "$BACKEND_PORT"; then
    echo "    [OK] Port $BACKEND_PORT is already active. Backend API is running."
else
    (
        cd "$BACKEND_DIR" || exit 1
        exec "$BACKEND_VENV_PY" -m uvicorn main:app --reload --host 127.0.0.1 --port "$BACKEND_PORT"
    ) > "$LOG_DIR/backend.log" 2>&1 &
    BACKEND_PID=$!
    echo "    [+] Spawned Backend API (PID $BACKEND_PID) — log: $LOG_DIR/backend.log"

    wait_until_ready "Backend API (/health)" 30 http_ok "http://127.0.0.1:$BACKEND_PORT/health" \
        || echo "    [WARN] Backend /health endpoint did not respond within 30 seconds. Check $LOG_DIR/backend.log"
fi

# -----------------------------------------------------------------------
# 2. Frontend UI
# -----------------------------------------------------------------------
echo ""
echo "[2/2] Crossfire Frontend UI (:$FRONTEND_PORT)..."

if port_open "$FRONTEND_PORT"; then
    echo "    [OK] Port $FRONTEND_PORT is already active. Frontend UI is running."
else
    (
        cd "$FRONTEND_DIR" || exit 1
        exec npm run dev -- --port "$FRONTEND_PORT"
    ) > "$LOG_DIR/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    echo "    [+] Spawned Frontend UI (PID $FRONTEND_PID) — log: $LOG_DIR/frontend.log"

    wait_until_ready "Frontend UI" 30 port_open "$FRONTEND_PORT" \
        || echo "    [WARN] Frontend did not report ready within 30 seconds. Check $LOG_DIR/frontend.log"
fi

# -----------------------------------------------------------------------
# 3. Open browser
# -----------------------------------------------------------------------
UI_URL="http://localhost:$FRONTEND_PORT"
if ! $NO_BROWSER; then
    sleep 1
    echo ""
    echo "[*] Opening $UI_URL in your default browser..."
    if command -v open >/dev/null 2>&1; then
        open "$UI_URL"
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$UI_URL" >/dev/null 2>&1
    fi
fi

echo ""
echo "======================================================================"
echo "                  ALL CROSSFIRE SERVICES ARE LIVE!                    "
echo "======================================================================"
echo ""
echo "  Frontend UI    : $UI_URL"
echo "  Backend API    : http://localhost:$BACKEND_PORT  (Docs: http://localhost:$BACKEND_PORT/docs)"
echo ""
echo "----------------------------------------------------------------------"
echo "  Controls:"
echo "    Press [Q]       : Stop all spawned services cleanly and exit."
echo "    Press [Ctrl+C]  : Terminate all services."
echo "======================================================================"
echo ""

if $LEAVE_OPEN; then
    echo "[INFO] --leave-open specified. Leaving services running in background and exiting launcher."
    trap - EXIT
    exit 0
fi

while true; do
    if read -r -t 0.5 -n 1 key 2>/dev/null; then
        [ "$key" = "q" ] || [ "$key" = "Q" ] && { echo ""; echo "Quit command received."; break; }
    fi
    for pid in "$BACKEND_PID" "$FRONTEND_PID"; do
        [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null && echo "[ALERT] Process PID $pid has stopped." && pid=""
    done
done
