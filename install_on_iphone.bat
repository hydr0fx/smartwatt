@echo off
title SmartWatt - Auf iPhone installieren (Sideloadly)
cd /d "%~dp0"

echo ========================================================
echo       SmartWatt - Echte iOS-App auf iPhone installieren
echo ========================================================
echo.
echo 1. Schließe dein iPhone per USB-Kabel an diesen PC an.
echo 2. Falls gefragt: Am iPhone auf "Diesem Computer vertrauen" tippen.
echo 3. Sideloadly öffnet sich jetzt direkt mit der fertigen SmartWatt.ipa.
echo 4. Gib deine Apple-ID ein und klicke auf "Start".
echo.
echo Öffne Sideloadly mit SmartWatt.ipa...

if exist "%LOCALAPPDATA%\Sideloadly\sideloadly.exe" (
    start "" "%LOCALAPPDATA%\Sideloadly\sideloadly.exe" "%~dp0SmartWatt.ipa"
) else (
    start "" "%~dp0SideloadlySetup64.exe"
)

echo.
echo Fertig! Sobald der Ladebalken in Sideloadly 100%% erreicht hat,
echo findest du SmartWatt als echte native App auf deinem iPhone.
echo (Einmalig auf dem iPhone freischalten unter:
echo  Einstellungen -> Allgemein -> VPN & Geräteverwaltung -> Vertrauen)
echo.
pause
