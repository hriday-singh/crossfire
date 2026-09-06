[CmdletBinding()]
param()

$Host.UI.RawUI.WindowTitle = "Gemini-Web2API Proxy (:8081)"
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " Starting Gemini-Web2API Proxy on http://localhost:8081/v1 ..." -ForegroundColor Green
Write-Host " Leave this window open while running Crossfire." -ForegroundColor Yellow
Write-Host " Press Ctrl+C in this window to stop the proxy." -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Cyan

$serviceDir = Join-Path $PSScriptRoot "tools\gemini-web2api"
Set-Location $serviceDir

$pythonExe = Join-Path $serviceDir ".venv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
    Write-Error "[ERROR] Virtual environment not found at $pythonExe!"
    exit 1
}

& $pythonExe gemini_web2api.py
