@echo off
title SmartWatt - Smarter Energie- & Stromkosten-Hub
cd /d "%~dp0"

echo ========================================================
echo       SmartWatt - Smarter Energie- & Stromkosten-Hub
echo ========================================================
echo.
echo Starte Server auf Port 8000...
echo Tipp: Du kannst die App auch auf deinem Smartphone aufrufen!
echo Verbinde dein Smartphone mit demselben WLAN und rufe die
echo IP-Adresse deines PCs auf Port 8000 auf (z.B. http://192.168.178.50:8000).
echo.

start "" "http://localhost:8000"

if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
) else (
    python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
)

pause
