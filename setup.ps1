<#
.SYNOPSIS
    Automated environment and dependency setup script for Crossfire.
.DESCRIPTION
    1. Validates system prerequisites (Python 3.11+, Node.js 18+, npm).
    2. Initializes backend/.env from backend/.env.example if missing.
    3. Sets up Python virtual environment (.venv) and installs backend dependencies.
    4. Installs frontend npm dependencies.
    5. Configures VS Code workspace settings for seamless Python/Node development.
#>

[CmdletBinding()]
param (
    [switch]$RecreateVenv = $false,
    [switch]$CleanNpm = $false
)

$ErrorActionPreference = "Stop"

$WorkspaceRoot = $PSScriptRoot
$BackendDir = Join-Path $WorkspaceRoot "backend"
$FrontendDir = Join-Path $WorkspaceRoot "frontend"

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "             CROSSFIRE - Full-Stack Setup & Installation              " -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "Workspace Root : $WorkspaceRoot"
Write-Host ""

# -----------------------------------------------------------------------------
# 1. System Prerequisites Check
# -----------------------------------------------------------------------------
Write-Host "[1/5] Checking system prerequisites..." -ForegroundColor Yellow

# Check Python
$PythonCmd = $null
if (Get-Command python -ErrorAction SilentlyContinue) {
    $PythonCmd = "python"
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    $PythonCmd = "py"
} else {
    Write-Error "[ERROR] Python was not found on PATH. Please install Python 3.11+ from https://www.python.org/downloads/ (ensure 'Add python.exe to PATH' is checked)."
    exit 1
}

$PyVersionOutput = & $PythonCmd --version 2>&1
Write-Host "    [OK] Python detected: $PyVersionOutput" -ForegroundColor Green

# Check Python >= 3.11
$PyVersionCheck = & $PythonCmd -c "import sys; print(1 if sys.version_info >= (3, 11) else 0)" 2>&1
if ($PyVersionCheck.Trim() -ne "1") {
    Write-Warning "    [WARN] Crossfire recommends Python 3.11+. Detected: $PyVersionOutput"
}

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "[ERROR] Node.js was not found on PATH. Please install Node.js 18+ (LTS) from https://nodejs.org/"
    exit 1
}
$NodeVersion = & node --version 2>&1
Write-Host "    [OK] Node.js detected: $NodeVersion" -ForegroundColor Green

# Check npm
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "[ERROR] npm was not found on PATH. Please ensure Node.js is installed with npm."
    exit 1
}
$NpmVersion = & npm --version 2>&1
Write-Host "    [OK] npm detected: v$NpmVersion" -ForegroundColor Green

# -----------------------------------------------------------------------------
# 2. Environment Variables (.env) Setup
# -----------------------------------------------------------------------------
Write-Host ""
Write-Host "[2/5] Checking configuration (.env)..." -ForegroundColor Yellow

$BackendEnv = Join-Path $BackendDir ".env"
$BackendEnvExample = Join-Path $BackendDir ".env.example"

if (-not (Test-Path $BackendEnv)) {
    if (Test-Path $BackendEnvExample) {
        Copy-Item $BackendEnvExample $BackendEnv
        Write-Host "    [OK] Created backend/.env from template (configured for local Gemini Proxy & DuckDuckGo Lite out of the box)." -ForegroundColor Green
    } else {
        Write-Warning "    [WARN] backend/.env.example not found. Please create backend/.env manually."
    }
} else {
    Write-Host "    [OK] backend/.env already exists." -ForegroundColor Green
}

# -----------------------------------------------------------------------------
# 3. Backend Virtualenv and Python Dependencies
# -----------------------------------------------------------------------------
Write-Host ""
Write-Host "[3/5] Setting up Python virtual environment & backend dependencies..." -ForegroundColor Yellow

$BackendSetupScript = Join-Path $BackendDir "setup_venv.ps1"
if (Test-Path $BackendSetupScript) {
    if ($RecreateVenv) {
        & $BackendSetupScript -Recreate
    } else {
        & $BackendSetupScript
    }
} else {
    # Fallback if setup_venv.ps1 is somehow missing
    $VenvDir = Join-Path $BackendDir ".venv"
    $VenvPython = Join-Path $VenvDir "Scripts\python.exe"
    if (-not (Test-Path $VenvPython)) {
        Write-Host "    [INFO] Creating virtual environment at $VenvDir..." -ForegroundColor Yellow
        & $PythonCmd -m venv $VenvDir
    }
    Write-Host "    [INFO] Installing dependencies..." -ForegroundColor Yellow
    & $VenvPython -m pip install --upgrade pip --quiet
    $ReqProd = Join-Path $BackendDir "requirements.txt"
    $ReqDev = Join-Path $BackendDir "requirements-dev.txt"
    if (Test-Path $ReqProd) { & $VenvPython -m pip install -r $ReqProd }
    if (Test-Path $ReqDev) { & $VenvPython -m pip install -r $ReqDev }
    Write-Host "    [OK] Backend dependencies installed." -ForegroundColor Green
}

# -----------------------------------------------------------------------------
# 4. Frontend npm Dependencies
# -----------------------------------------------------------------------------
Write-Host ""
Write-Host "[4/5] Setting up frontend dependencies..." -ForegroundColor Yellow

$FrontendModules = Join-Path $FrontendDir "node_modules"
Push-Location $FrontendDir
try {
    if ($CleanNpm -and (Test-Path $FrontendModules)) {
        Write-Host "    [INFO] Removing existing frontend node_modules..." -ForegroundColor Yellow
        Remove-Item -Recurse -Force $FrontendModules
    }

    if (-not (Test-Path $FrontendModules) -or $CleanNpm) {
        Write-Host "    [INFO] Installing frontend npm packages (this may take a minute on first run)..." -ForegroundColor Yellow
        & npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to install frontend dependencies via npm."
            exit 1
        }
        Write-Host "    [OK] Frontend npm packages installed successfully." -ForegroundColor Green
    } else {
        Write-Host "    [OK] frontend/node_modules already exists. (Pass -CleanNpm to force reinstall)." -ForegroundColor Green
    }
} finally {
    Pop-Location
}

# -----------------------------------------------------------------------------
# 5. Gemini-Web2API Proxy Verification
# -----------------------------------------------------------------------------
Write-Host ""
Write-Host "[5/5] Checking Gemini-Web2API Proxy environment..." -ForegroundColor Yellow

$ProxyDirs = @(
    (Join-Path $WorkspaceRoot "tools\gemini-web2api"),
    (Join-Path $WorkspaceRoot "..\..\Tools\gemini-web2api"),
    (Join-Path $WorkspaceRoot "..\Tools\gemini-web2api")
)

$ResolvedProxyDir = $null
foreach ($dir in $ProxyDirs) {
    if (Test-Path $dir) {
        $ResolvedProxyDir = (Resolve-Path $dir).Path
        break
    }
}

if ($ResolvedProxyDir) {
    Write-Host "    [OK] Found Gemini-Web2API at: $ResolvedProxyDir" -ForegroundColor Green
} else {
    Write-Host "    [INFO] gemini-web2api not found in standard directories. If you use direct GEMINI_API_KEY, this can be ignored." -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "                     SETUP COMPLETE & VERIFIED!                       " -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "You are ready to launch Crossfire! Run the following command:"
Write-Host "  .\run_all.ps1" -ForegroundColor Cyan
Write-Host ""
