<#
.SYNOPSIS
    Sets up the Python virtual environment (.venv) for Crossfire backend and configures VS Code auto-detection.

.DESCRIPTION
    1. Detects Python (verifies 3.11+)
    2. Creates .venv in backend directory if not present
    3. Upgrades pip and installs dev / production dependencies
    4. Creates/updates .vscode/settings.json for seamless VS Code auto-detection
    5. Ensures .gitignore ignores .venv and cache artifacts
#>

[CmdletBinding()]
param (
    [switch]$Recreate = $false
)

$ErrorActionPreference = "Stop"

# Paths
$BackendDir = $PSScriptRoot
$WorkspaceRootDir = (Resolve-Path "$BackendDir\..").Path
$VenvDir = Join-Path $BackendDir ".venv"
$VenvPython = Join-Path $VenvDir "Scripts\python.exe"
$VenvActivate = Join-Path $VenvDir "Scripts\Activate.ps1"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Crossfire Backend: venv Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Backend Directory: $BackendDir"
Write-Host "Target venv Path:  $VenvDir"
Write-Host ""

# 1. Locate and check Python executable
$PythonCmd = $null
if (Get-Command python -ErrorAction SilentlyContinue) {
    $PythonCmd = "python"
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    $PythonCmd = "py"
} else {
    Write-Error "Python was not found on PATH. Please install Python 3.11+."
    exit 1
}

$PyVersionOutput = & $PythonCmd --version 2>&1
Write-Host "[OK] Found Python: $PyVersionOutput" -ForegroundColor Green

# Check version >= 3.11
$VersionCheck = & $PythonCmd -c "import sys; print(1 if sys.version_info >= (3, 11) else 0)" 2>&1
if ($VersionCheck -ne "1") {
    Write-Warning "Crossfire requires Python 3.11+. Detected: $PyVersionOutput"
}

# 2. Recreate if requested
if ($Recreate -and (Test-Path $VenvDir)) {
    Write-Host "[INFO] Removing existing virtual environment..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $VenvDir
}

# 3. Create virtual environment if not present
if (-not (Test-Path $VenvPython)) {
    Write-Host "[INFO] Creating virtual environment at '$VenvDir'..." -ForegroundColor Yellow
    & $PythonCmd -m venv $VenvDir
    if (-not (Test-Path $VenvPython)) {
        Write-Error "Failed to create virtual environment at $VenvDir"
        exit 1
    }
    Write-Host "[OK] Virtual environment created successfully." -ForegroundColor Green
} else {
    Write-Host "[OK] Virtual environment exists at '$VenvDir'." -ForegroundColor Green
}

# 4. Upgrade pip
Write-Host "[INFO] Upgrading pip..." -ForegroundColor Yellow
& $VenvPython -m pip install --upgrade pip --quiet
Write-Host "[OK] pip is up to date." -ForegroundColor Green

# 5. Install dependencies
$ReqProd = Join-Path $BackendDir "requirements.txt"
$ReqDev = Join-Path $BackendDir "requirements-dev.txt"

if (Test-Path $ReqProd) {
    Write-Host "[INFO] Installing dependencies from requirements.txt..." -ForegroundColor Yellow
    & $VenvPython -m pip install -r $ReqProd
    Write-Host "[OK] Production dependencies installed." -ForegroundColor Green
}

if (Test-Path $ReqDev) {
    Write-Host "[INFO] Installing dependencies from requirements-dev.txt..." -ForegroundColor Yellow
    & $VenvPython -m pip install -r $ReqDev
    Write-Host "[OK] Development dependencies installed." -ForegroundColor Green
}

# 6. Configure VS Code settings for automatic detection
Write-Host "[INFO] Configuring VS Code interpreter settings..." -ForegroundColor Yellow

function Update-VsCodeSettings {
    param (
        [string]$SettingsDir,
        [hashtable]$NewSettings
    )

    if (-not (Test-Path $SettingsDir)) {
        New-Item -ItemType Directory -Path $SettingsDir -Force | Out-Null
    }

    $SettingsFile = Join-Path $SettingsDir "settings.json"
    $CurrentSettings = @{}
    if (Test-Path $SettingsFile) {
        try {
            $Raw = Get-Content $SettingsFile -Raw
            if ($Raw.Trim()) {
                $CurrentSettings = $Raw | ConvertFrom-Json -AsHashtable
            }
        } catch {
            $CurrentSettings = @{}
        }
    }

    foreach ($key in $NewSettings.Keys) {
        $CurrentSettings[$key] = $NewSettings[$key]
    }

    $CurrentSettings | ConvertTo-Json -Depth 10 | Set-Content $SettingsFile -Encoding UTF8
    Write-Host "    [OK] Configured $SettingsFile" -ForegroundColor Green
}

# Workspace root settings (when opening crossfire/)
$RootVsCodeDir = Join-Path $WorkspaceRootDir ".vscode"
Update-VsCodeSettings -SettingsDir $RootVsCodeDir -NewSettings @{
    "python.defaultInterpreterPath" = '${workspaceFolder}/backend/.venv/Scripts/python.exe'
    "python.terminal.activateEnvironment" = $true
    "python.analysis.extraPaths" = @('${workspaceFolder}/backend')
}

# Backend folder settings (when opening backend/ directly)
$BackendVsCodeDir = Join-Path $BackendDir ".vscode"
Update-VsCodeSettings -SettingsDir $BackendVsCodeDir -NewSettings @{
    "python.defaultInterpreterPath" = '${workspaceFolder}/.venv/Scripts/python.exe'
    "python.terminal.activateEnvironment" = $true
    "python.analysis.extraPaths" = @('${workspaceFolder}')
}

# 7. Ensure .gitignore protects the venv
$GitIgnorePath = Join-Path $BackendDir ".gitignore"
$IgnoreEntries = @(".venv/", "__pycache__/", "*.py[cod]", "*`$py.class", ".env", ".pytest_cache/")
$ExistingContent = ""
if (Test-Path $GitIgnorePath) {
    $ExistingContent = Get-Content $GitIgnorePath -Raw
}

$NeedsUpdate = $false
foreach ($entry in $IgnoreEntries) {
    if ($ExistingContent -notmatch [regex]::Escape($entry)) {
        $ExistingContent += "`n$entry"
        $NeedsUpdate = $true
    }
}
if ($NeedsUpdate) {
    $ExistingContent.Trim() + "`n" | Set-Content $GitIgnorePath -Encoding UTF8
    Write-Host "[OK] Ensured .venv and python artifacts in backend/.gitignore" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Setup Complete! VS Code is ready." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "To activate in PowerShell, run:"
Write-Host "  $VenvActivate" -ForegroundColor Cyan
Write-Host "Or from repo root:"
Write-Host "  .\backend\.venv\Scripts\Activate.ps1" -ForegroundColor Cyan
