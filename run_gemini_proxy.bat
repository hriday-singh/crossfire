@echo off
title Gemini-Web2API Proxy (:8081)
echo ======================================================================
echo Starting Gemini-Web2API Proxy on http://localhost:8081/v1 ...
echo Leave this window open while running Crossfire.
echo Press Ctrl+C in this window to stop the proxy.
echo ======================================================================
set "SERVICE_DIR=%~dp0tools\gemini-web2api"
if not exist "%SERVICE_DIR%" (
    if exist "%~dp0..\..\Tools\gemini-web2api" (
        set "SERVICE_DIR=%~dp0..\..\Tools\gemini-web2api"
    ) else if exist "%~dp0..\Tools\gemini-web2api" (
        set "SERVICE_DIR=%~dp0..\Tools\gemini-web2api"
    )
)

if not exist "%SERVICE_DIR%" (
    echo [ERROR] gemini-web2api directory not found!
    pause
    exit /b 1
)

cd /d "%SERVICE_DIR%"
if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" gemini_web2api.py --port 8081
) else (
    python gemini_web2api.py --port 8081
)
