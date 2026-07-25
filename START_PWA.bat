@echo off
echo ========================================
echo AttendBox PWA - Quick Start
echo ========================================
echo.

echo Step 1: Checking if icons exist...
if not exist "public\icon-192x192.png" (
    echo Icons not found. Generating icons first...
    echo.
    call GENERATE_ICONS.bat
    echo.
)

echo Step 2: Checking if port 3000 is in use...
netstat -ano | findstr :3000 | findstr LISTENING >nul
if %errorlevel% equ 0 (
    echo Port 3000 is in use. Killing the process...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
        taskkill /F /PID %%a >nul 2>&1
    )
    timeout /t 2 /nobreak >nul
    echo Port 3000 is now free!
    echo.
)

echo Step 3: Starting development server...
echo.
echo Frontend will be available at:
echo   - Computer: http://localhost:3000
echo   - Phone:    http://192.168.1.29:3000
echo.
echo To add to phone home screen:
echo   1. Open http://192.168.1.29:3000 on your phone
echo   2. Tap browser menu (3 dots)
echo   3. Select "Add to Home screen"
echo.
echo Press Ctrl+C to stop the server
echo.
echo ========================================
echo.

npm run dev
