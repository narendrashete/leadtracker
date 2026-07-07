@echo off
title Lead Tracker
color 0A

echo.
echo  =====================================================
echo    Lead Tracker - Starting...
echo  =====================================================
echo.

REM Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo  ERROR: Node.js is not installed.
    echo.
    echo  Please install Node.js from https://nodejs.org
    echo  Download the LTS version and run the installer.
    echo  Then run this file again.
    echo.
    pause
    exit /b 1
)

REM Check if node_modules exists, install if missing
if not exist "%~dp0backend\node_modules\" (
    echo  Setting up for first time... please wait.
    echo.
    cd /d "%~dp0backend"
    npm config set strict-ssl false >nul 2>&1
    npm install --omit=dev
    echo.
)

echo  Starting Lead Tracker...
echo.

cd /d "%~dp0backend"
start "Lead Tracker" /MIN cmd /c "node server.js"

echo  Waiting for server to start...
timeout /t 4 /nobreak >nul

echo.
echo  =====================================================
echo    Lead Tracker is running!
echo    Opening browser...
echo  =====================================================
echo.
echo  URL: http://localhost:3001
echo.
echo  - Keep this window open while using the app
echo  - Close this window to stop the app
echo.

start "" "http://localhost:3001"

REM Keep window open; closing it kills the server
:loop
timeout /t 60 /nobreak >nul 2>&1
tasklist /FI "WINDOWTITLE eq Lead Tracker" 2>nul | find "cmd.exe" >nul
if %errorlevel% equ 0 goto loop

echo  Server stopped. Press any key to exit.
pause >nul
