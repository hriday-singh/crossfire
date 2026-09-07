<#
.SYNOPSIS
    Unified launcher for Crossfire. Runs all three services in the correct sequence.
.DESCRIPTION
    1. Validates and auto-installs dependencies if needed (calls setup.ps1).
    2. Starts Gemini-Web2API Proxy on port 8081 and waits for readiness.
    3. Starts Crossfire Backend API on port 8000 and waits for /health response.
    4. Starts Crossfire Frontend UI on port 5173 and waits for dev server.
    5. Opens the browser at http://localhost:5173.
    6. Keeps a control panel active; pressing 'Q' or Ctrl+C terminates all services cleanly.
#>

[CmdletBinding()]
param (
    [switch]$Setup = $false,
    [switch]$NoBrowser = $false,
    [switch]$SkipProxy = $false,
    [switch]$LeaveOpen = $false,
    [int]$BackendPort = 8000,
    [int]$ProxyPort = 8081,
    [int]$FrontendPort = 5173
)

$ErrorActionPreference = "Stop"

$WorkspaceRoot = $PSScriptRoot
$BackendDir = Join-Path $WorkspaceRoot "backend"
$FrontendDir = Join-Path $WorkspaceRoot "frontend"

# Track processes spawned by this launcher for clean teardown
$SpawnedProcesses = [System.Collections.Generic.List[System.Diagnostics.Process]]::new()
$ReportedExitedPids = [System.Collections.Generic.HashSet[int]]::new()

function Test-PortOpen {
    param (
        [string]$HostName = "localhost",
        [int]$Port,
        [int]$TimeoutMs = 400
    )
    try {
        $addresses = [System.Net.Dns]::GetHostAddresses($HostName)
    } catch {
        $addresses = @()
    }

    # If checking localhost or loopback, test both IPv4 (127.0.0.1) and IPv6 (::1)
    # Modern dev servers (e.g. Vite on Node.js) often bind to IPv6 loopback by default on Windows
    if ($HostName -in @("localhost", "127.0.0.1", "::1")) {
        $loopbacks = @([System.Net.IPAddress]::Loopback)
        if ([System.Net.Sockets.Socket]::OSSupportsIPv6) {
            $loopbacks += [System.Net.IPAddress]::IPv6Loopback
        }
        $addresses = @($addresses + $loopbacks) | Select-Object -Unique
    }

    $clients = [System.Collections.Generic.List[System.Net.Sockets.TcpClient]]::new()
    $waitHandles = [System.Collections.Generic.List[System.Threading.WaitHandle]]::new()
    $asyncResults = [System.Collections.Generic.List[System.IAsyncResult]]::new()

    try {
        foreach ($ip in $addresses) {
            try {
                $tcp = New-Object System.Net.Sockets.TcpClient($ip.AddressFamily)
                $clients.Add($tcp)
                $ar = $tcp.BeginConnect($ip, $Port, $null, $null)
                $asyncResults.Add($ar)
                $waitHandles.Add($ar.AsyncWaitHandle)
            } catch {}
        }

        if ($waitHandles.Count -eq 0) { return $false }

        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        while ($waitHandles.Count -gt 0 -and $stopwatch.ElapsedMilliseconds -lt $TimeoutMs) {
            $remaining = [Math]::Max(1, [int]($TimeoutMs - $stopwatch.ElapsedMilliseconds))
            $idx = [System.Threading.WaitHandle]::WaitAny($waitHandles.ToArray(), $remaining)
            if ($idx -ge 0 -and $idx -lt $waitHandles.Count) {
                $tcp = $clients[$idx]
                $ar = $asyncResults[$idx]
                try {
                    $tcp.EndConnect($ar)
                    if ($tcp.Connected) { return $true }
                } catch {
                    $waitHandles.RemoveAt($idx)
                    $clients.RemoveAt($idx)
                    $asyncResults.RemoveAt($idx)
                }
            } else {
                break
            }
        }
        return $false
    } finally {
        foreach ($c in $clients) {
            try { $c.Close(); $c.Dispose() } catch {}
        }
    }
}

function Test-HttpEndpoint {
    param (
        [string]$Url,
        [int]$TimeoutSec = 2
    )
    # Prefer 127.0.0.1 over localhost to prevent Windows IPv6 [::1] resolution hang/timeout
    $ResolvedUrl = $Url -replace '://localhost([:/])', '://127.0.0.1$1'
    try {
        $null = Invoke-RestMethod -Uri $ResolvedUrl -Method Get -TimeoutSec $TimeoutSec -ErrorAction Stop
        return $true
    } catch {
        if ($ResolvedUrl -ne $Url) {
            try {
                $null = Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec $TimeoutSec -ErrorAction Stop
                return $true
            } catch {
                return $false
            }
        }
        return $false
    }
}

function Wait-UntilReady {
    param (
        [string]$ServiceName,
        [scriptblock]$CheckBlock,
        [int]$TimeoutSeconds = 25
    )
    Write-Host "    Waiting for $ServiceName to respond" -NoNewline -ForegroundColor DarkGray
    $startTime = Get-Date
    while ((Get-Date) - $startTime -lt [TimeSpan]::FromSeconds($TimeoutSeconds)) {
        if (& $CheckBlock) {
            Write-Host " [READY]" -ForegroundColor Green
            return $true
        }
        Write-Host "." -NoNewline -ForegroundColor DarkGray
        Start-Sleep -Milliseconds 600
    }
    Write-Host " [TIMEOUT]" -ForegroundColor Red
    return $false
}

function Stop-AllSpawnedServices {
    if ($SpawnedProcesses.Count -eq 0) { return }
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Yellow
    Write-Host " Stopping all spawned Crossfire services..." -ForegroundColor Yellow
    Write-Host "======================================================================" -ForegroundColor Yellow
    
    foreach ($proc in $SpawnedProcesses) {
        if ($proc -and -not $proc.HasExited) {
            try {
                Write-Host "  Stopping PID $($proc.Id) ($($proc.ProcessName))..." -ForegroundColor DarkGray
                & taskkill.exe /PID $proc.Id /T /F 2>$null | Out-Null
            } catch {
                try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
            }
        }
    }
    Write-Host "  [OK] All spawned services terminated." -ForegroundColor Green
}

# Determine PowerShell executable to use for child windows
$ShellExe = if (Get-Command pwsh.exe -ErrorAction SilentlyContinue) { "pwsh.exe" } else { "powershell.exe" }

try {
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host "              CROSSFIRE - Decision-Testing Engine Launcher            " -ForegroundColor Cyan
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host ""

    # -------------------------------------------------------------------------
    # Auto-Setup Verification & Virtual Environment Initialization
    # -------------------------------------------------------------------------
    $BackendVenvPy = Join-Path $BackendDir ".venv\Scripts\python.exe"
    $BackendUvicorn = Join-Path $BackendDir ".venv\Scripts\uvicorn.exe"
    $BackendActivate = Join-Path $BackendDir ".venv\Scripts\Activate.ps1"
    $FrontendModules = Join-Path $FrontendDir "node_modules"
    $BackendEnv = Join-Path $BackendDir ".env"

    $VenvInitialized = (Test-Path $BackendVenvPy) -and (Test-Path $BackendActivate) -and (Test-Path $BackendUvicorn)
    $NeedsSetup = $Setup -or (-not $VenvInitialized) -or (-not (Test-Path $FrontendModules)) -or (-not (Test-Path $BackendEnv))

    if ($NeedsSetup) {
        Write-Host "[*] Setup required (missing or uninitialized virtual environment / dependencies). Running setup..." -ForegroundColor Yellow
        $SetupScript = Join-Path $WorkspaceRoot "setup.ps1"
        if (Test-Path $SetupScript) {
            & $SetupScript
            if ($LASTEXITCODE -ne 0) {
                Write-Error "[ERROR] Setup failed. Please check errors above."
                exit 1
            }
        } else {
            Write-Error "[ERROR] setup.ps1 not found in $WorkspaceRoot."
            exit 1
        }
    }

    # Explicitly wait for the virtual environment to be initialized and ready
    if (-not ((Test-Path $BackendVenvPy) -and (Test-Path $BackendUvicorn))) {
        $venvReady = Wait-UntilReady -ServiceName "Python Virtual Environment" -CheckBlock {
            (Test-Path $BackendVenvPy) -and (Test-Path $BackendUvicorn)
        } -TimeoutSeconds 45

        if (-not $venvReady) {
            Write-Error "[ERROR] Python virtual environment failed to initialize at $BackendDir\.venv. Run .\setup.ps1 manually."
            exit 1
        }
    }
    Write-Host "    [OK] Python virtual environment verified: $BackendVenvPy" -ForegroundColor Green

    # -------------------------------------------------------------------------
    # 1. Start Gemini-Web2API Proxy (:8081)
    # -------------------------------------------------------------------------
    if (-not $SkipProxy) {
        Write-Host ""
        Write-Host "[1/3] Gemini-Web2API Proxy (:8081)..." -ForegroundColor Yellow

        if (Test-PortOpen -Port $ProxyPort) {
            Write-Host "    [OK] Port $ProxyPort is already active. Proxy is running." -ForegroundColor Green
        } else {
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

            if (-not $ResolvedProxyDir) {
                Write-Warning "    [WARN] gemini-web2api directory not found. Skipping local proxy launch."
                Write-Warning "           If using direct GEMINI_API_KEY in backend/.env, this is fine."
            } else {
                $ProxyPython = Join-Path $ResolvedProxyDir ".venv\Scripts\python.exe"
                if (-not (Test-Path $ProxyPython)) {
                    $BackendVenvPy = Join-Path $BackendDir ".venv\Scripts\python.exe"
                    if (Test-Path $BackendVenvPy) {
                        $ProxyPython = $BackendVenvPy
                    } else {
                        $SysPy = Get-Command python.exe -ErrorAction SilentlyContinue
                        $ProxyPython = if ($SysPy) { $SysPy.Source } else { "python" }
                    }
                }

                $proxyCmd = "`$Host.UI.RawUI.WindowTitle = 'Crossfire - [1/3] Gemini Proxy (:$ProxyPort)'; Set-Location '$ResolvedProxyDir'; Write-Host 'Starting Gemini Proxy on :$ProxyPort...' -ForegroundColor Cyan; & '$ProxyPython' gemini_web2api.py --port $ProxyPort"
                
                $proxyProc = Start-Process $ShellExe -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $proxyCmd) -PassThru
                $SpawnedProcesses.Add($proxyProc)
                Write-Host "    [+] Spawned Gemini Proxy window (PID $($proxyProc.Id))" -ForegroundColor DarkCyan

                $ready = Wait-UntilReady -ServiceName "Gemini Proxy" -CheckBlock {
                    Test-PortOpen -Port $ProxyPort
                } -TimeoutSeconds 25

                if (-not $ready) {
                    Write-Warning "    [WARN] Gemini Proxy did not report ready within 25 seconds. Proceeding anyway..."
                }
            }
        }
    } else {
        Write-Host ""
        Write-Host "[1/3] Gemini Proxy: Skipped (-SkipProxy specified)" -ForegroundColor DarkGray
    }

    # -------------------------------------------------------------------------
    # 2. Start Crossfire Backend API (:8000)
    # -------------------------------------------------------------------------
    Write-Host ""
    Write-Host "[2/3] Crossfire Backend API (:$BackendPort)..." -ForegroundColor Yellow

    if (Test-PortOpen -Port $BackendPort) {
        Write-Host "    [OK] Port $BackendPort is already active. Backend API is running." -ForegroundColor Green
    } else {
        $BackendPython = Join-Path $BackendDir ".venv\Scripts\python.exe"
        if (-not (Test-Path $BackendPython)) {
            $SysPy = Get-Command python.exe -ErrorAction SilentlyContinue
            $BackendPython = if ($SysPy) { $SysPy.Source } else { "python" }
        }

        $backendCmd = "`$Host.UI.RawUI.WindowTitle = 'Crossfire - [2/3] Backend API (:$BackendPort)'; Set-Location '$BackendDir'; if (Test-Path '.\.venv\Scripts\Activate.ps1') { . '.\.venv\Scripts\Activate.ps1' }; Write-Host 'Starting Crossfire Backend API on :$BackendPort...' -ForegroundColor Cyan; & '$BackendPython' -m uvicorn main:app --reload --host 127.0.0.1 --port $BackendPort"
        
        $backendProc = Start-Process $ShellExe -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $backendCmd) -PassThru
        $SpawnedProcesses.Add($backendProc)
        Write-Host "    [+] Spawned Backend API window (PID $($backendProc.Id))" -ForegroundColor DarkCyan

        $backendReady = Wait-UntilReady -ServiceName "Backend API (/health)" -CheckBlock {
            (Test-PortOpen -Port $BackendPort) -and (Test-HttpEndpoint -Url "http://127.0.0.1:$BackendPort/health")
        } -TimeoutSeconds 30

        if (-not $backendReady) {
            Write-Warning "    [WARN] Backend /health endpoint did not respond within 30 seconds. Please inspect backend console window."
        }
    }

    # -------------------------------------------------------------------------
    # 3. Start Crossfire Frontend UI (:5173)
    # -------------------------------------------------------------------------
    Write-Host ""
    Write-Host "[3/3] Crossfire Frontend UI (:$FrontendPort)..." -ForegroundColor Yellow

    if (Test-PortOpen -Port $FrontendPort) {
        Write-Host "    [OK] Port $FrontendPort is already active. Frontend UI is running." -ForegroundColor Green
    } else {
        $frontendCmd = "`$Host.UI.RawUI.WindowTitle = 'Crossfire - [3/3] Frontend UI (:$FrontendPort)'; Set-Location '$FrontendDir'; Write-Host 'Starting Vite Frontend dev server on :$FrontendPort...' -ForegroundColor Cyan; npm run dev -- --port $FrontendPort"
        
        $frontendProc = Start-Process $ShellExe -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $frontendCmd) -PassThru
        $SpawnedProcesses.Add($frontendProc)
        Write-Host "    [+] Spawned Frontend UI window (PID $($frontendProc.Id))" -ForegroundColor DarkCyan

        $frontendReady = Wait-UntilReady -ServiceName "Frontend UI" -CheckBlock {
            Test-PortOpen -Port $FrontendPort
        } -TimeoutSeconds 30

        if (-not $frontendReady) {
            Write-Warning "    [WARN] Frontend did not report ready within 30 seconds. Please inspect frontend console window."
        }
    }

    # -------------------------------------------------------------------------
    # 4. Open Browser
    # -------------------------------------------------------------------------
    $UiUrl = "http://localhost:$FrontendPort"
    if (-not $NoBrowser) {
        Start-Sleep -Seconds 1
        Write-Host ""
        Write-Host "[*] Opening $UiUrl in your default browser..." -ForegroundColor Green
        Start-Process $UiUrl
    }

    # -------------------------------------------------------------------------
    # 5. Interactive Control Panel
    # -------------------------------------------------------------------------
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Green
    Write-Host "                  ALL CROSSFIRE SERVICES ARE LIVE!                    " -ForegroundColor Green
    Write-Host "======================================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Frontend UI    : $UiUrl" -ForegroundColor Cyan
    Write-Host "  Backend API    : http://localhost:$BackendPort  (Docs: http://localhost:$BackendPort/docs)" -ForegroundColor Cyan
    if (-not $SkipProxy) {
        Write-Host "  Gemini Proxy   : http://localhost:$ProxyPort/v1" -ForegroundColor Cyan
    }
    Write-Host ""
    Write-Host "----------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  Controls:" -ForegroundColor Yellow
    Write-Host "    Press [Q]       : Stop all three services cleanly and exit." -ForegroundColor White
    Write-Host "    Press [O]       : Re-open http://localhost:$FrontendPort in browser." -ForegroundColor White
    Write-Host "    Press [Ctrl+C]  : Terminate all services." -ForegroundColor White
    Write-Host "======================================================================" -ForegroundColor Green
    Write-Host ""

    if ($LeaveOpen) {
        Write-Host "[INFO] -LeaveOpen specified. Leaving all service windows open and exiting launcher." -ForegroundColor Yellow
        return
    }

    # Check if console supports reading keys (interactive mode)
    $isInteractive = $true
    try {
        [void][Console]::KeyAvailable
    } catch {
        $isInteractive = $false
    }

    # Monitor loop
    while ($true) {
        if ($isInteractive) {
            try {
                if ([Console]::KeyAvailable) {
                    $key = [Console]::ReadKey($true)
                    if ($key.Key -eq [ConsoleKey]::Q) {
                        Write-Host "`nQuit command received." -ForegroundColor Yellow
                        break
                    }
                    if ($key.Key -eq [ConsoleKey]::O) {
                        Write-Host "`nOpening $UiUrl..." -ForegroundColor Green
                        Start-Process $UiUrl
                    }
                }
            } catch {
                $isInteractive = $false
            }
        }

        # Check if any spawned child unexpectedly died
        foreach ($proc in $SpawnedProcesses) {
            if ($proc.HasExited) {
                if (-not $ReportedExitedPids.Contains($proc.Id)) {
                    Write-Warning "`n[ALERT] Process PID $($proc.Id) ($($proc.ProcessName)) has stopped."
                    [void]$ReportedExitedPids.Add($proc.Id)
                }
            }
        }

        Start-Sleep -Milliseconds 500
    }

} finally {
    if (-not $LeaveOpen) {
        Stop-AllSpawnedServices
    }
}
