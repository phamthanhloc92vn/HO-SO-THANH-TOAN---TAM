@echo off
title Contract AI - Trungnam E&C
color 0B
echo.
echo  ==========================================
echo   CONTRACT AI - Trungnam E^&C
echo   Dang khoi dong ung dung...
echo  ==========================================
echo.

:: Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo  [LOI] Chua cai Node.js!
    echo  Vui long cai Node.js tu: https://nodejs.org
    pause
    exit /b 1
)

echo  [OK] Node.js da san sang
echo  [>>] Khoi dong server tai http://localhost:3000
echo.

:: Start server
node server.js

pause
