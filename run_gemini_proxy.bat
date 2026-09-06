@echo off
title Gemini-Web2API Proxy (:8081)
echo ======================================================================
echo Starting Gemini-Web2API Proxy on http://localhost:8081/v1 ...
echo Leave this window open while running Crossfire.
echo Press Ctrl+C in this window to stop the proxy.
echo ======================================================================
cd /d "%~dp0tools\gemini-web2api"
if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment not found in tools\gemini-web2api\.venv!
    echo Please run setup first.
    pause
    exit /b 1
)
".venv\Scripts\python.exe" gemini_web2api.py
