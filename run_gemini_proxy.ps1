[CmdletBinding()]
param()

$Host.UI.RawUI.WindowTitle = "Gemini-Web2API Proxy (:8081)"
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " Starting Gemini-Web2API Proxy on http://localhost:8081/v1 ..." -ForegroundColor Green
Write-Host " Leave this window open while running Crossfire." -ForegroundColor Yellow
Write-Host " Press Ctrl+C in this window to stop the proxy." -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Cyan

$serviceDir = Join-Path $PSScriptRoot "tools\gemini-web2api"
if (-not (Test-Path $serviceDir)) {
    $fallbackPaths = @(
        (Join-Path $PSScriptRoot "..\..\Tools\gemini-web2api"),
        (Join-Path $PSScriptRoot "..\Tools\gemini-web2api")
    )
    foreach ($p in $fallbackPaths) {
        if (Test-Path $p) {
            $serviceDir = (Resolve-Path $p).Path
            break
        }
    }
}

if (-not (Test-Path $serviceDir)) {
    Write-Error "[ERROR] gemini-web2api directory not found!"
    exit 1
}

Set-Location $serviceDir

$pythonExe = Join-Path $serviceDir ".venv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
    $sysPython = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($sysPython) {
        $pythonExe = $sysPython.Source
    } else {
        Write-Error "[ERROR] Python executable not found!"
        exit 1
    }
}

& $pythonExe gemini_web2api.py --port 8081
