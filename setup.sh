#!/usr/bin/env bash
# Setup & dependency installer for Crossfire (macOS/Linux equivalent of setup.ps1).
set -euo pipefail

RECREATE_VENV=false
CLEAN_NPM=false
for arg in "$@"; do
    case "$arg" in
        --recreate-venv) RECREATE_VENV=true ;;
        --clean-npm) CLEAN_NPM=true ;;
    esac
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

echo ""
echo "======================================================================"
echo "             CROSSFIRE - Full-Stack Setup & Installation              "
echo "======================================================================"
echo "Workspace Root : $ROOT_DIR"
echo ""

# 1. Prerequisites
echo "[1/4] Checking system prerequisites..."
PYTHON_CMD=""
for cand in python3 python; do
    if command -v "$cand" >/dev/null 2>&1; then PYTHON_CMD="$cand"; break; fi
done
if [ -z "$PYTHON_CMD" ]; then
    echo "[ERROR] Python was not found on PATH. Install Python 3.11+." >&2
    exit 1
fi
echo "    [OK] Python detected: $("$PYTHON_CMD" --version 2>&1)"
if [ "$("$PYTHON_CMD" -c 'import sys; print(1 if sys.version_info >= (3, 11) else 0)')" != "1" ]; then
    echo "    [WARN] Crossfire recommends Python 3.11+."
fi

if ! command -v node >/dev/null 2>&1; then
    echo "[ERROR] Node.js was not found on PATH. Install Node.js 18+ (LTS)." >&2
    exit 1
fi
echo "    [OK] Node.js detected: $(node --version)"

if ! command -v npm >/dev/null 2>&1; then
    echo "[ERROR] npm was not found on PATH." >&2
    exit 1
fi
echo "    [OK] npm detected: v$(npm --version)"

# 2. .env
echo ""
echo "[2/4] Checking configuration (.env)..."
if [ ! -f "$BACKEND_DIR/.env" ]; then
    if [ -f "$BACKEND_DIR/.env.example" ]; then
        cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
        echo "    [OK] Created backend/.env from template (Ollama & DuckDuckGo Lite defaults)."
    else
        echo "    [WARN] backend/.env.example not found. Create backend/.env manually."
    fi
else
    echo "    [OK] backend/.env already exists."
fi

# 3. Backend venv + deps
echo ""
echo "[3/4] Setting up Python virtual environment & backend dependencies..."
VENV_DIR="$BACKEND_DIR/.venv"
VENV_PY="$VENV_DIR/bin/python"

if $RECREATE_VENV && [ -d "$VENV_DIR" ]; then
    echo "    [INFO] Removing existing virtual environment..."
    rm -rf "$VENV_DIR"
fi

if [ ! -f "$VENV_PY" ]; then
    echo "    [INFO] Creating virtual environment at $VENV_DIR..."
    "$PYTHON_CMD" -m venv "$VENV_DIR"
else
    echo "    [OK] Virtual environment exists at $VENV_DIR."
fi

echo "    [INFO] Upgrading pip..."
"$VENV_PY" -m pip install --upgrade pip --quiet

[ -f "$BACKEND_DIR/requirements.txt" ] && "$VENV_PY" -m pip install -r "$BACKEND_DIR/requirements.txt"
[ -f "$BACKEND_DIR/requirements-dev.txt" ] && "$VENV_PY" -m pip install -r "$BACKEND_DIR/requirements-dev.txt"
echo "    [OK] Backend dependencies installed."

# 4. Frontend deps
echo ""
echo "[4/4] Setting up frontend dependencies..."
if $CLEAN_NPM && [ -d "$FRONTEND_DIR/node_modules" ]; then
    echo "    [INFO] Removing existing frontend node_modules..."
    rm -rf "$FRONTEND_DIR/node_modules"
fi

if [ ! -d "$FRONTEND_DIR/node_modules" ] || $CLEAN_NPM; then
    echo "    [INFO] Installing frontend npm packages (this may take a minute)..."
    (cd "$FRONTEND_DIR" && npm install)
    echo "    [OK] Frontend npm packages installed successfully."
else
    echo "    [OK] frontend/node_modules already exists. (Pass --clean-npm to force reinstall)."
fi

echo ""
echo "======================================================================"
echo "                     SETUP COMPLETE & VERIFIED!                       "
echo "======================================================================"
echo ""
echo "You are ready to launch Crossfire! Run:"
echo "  ./run_all.sh"
echo ""
