@echo off
echo ================================================
echo    Restarting AttendBox Backend Server
echo ================================================
echo.

echo Step 1: Killing all Node.js processes...
taskkill /F /IM node.exe 2>nul
if %errorlevel% equ 0 (
    echo   [OK] Node processes killed
) else (
    echo   [INFO] No node processes found
)

echo.
echo Step 2: Waiting for port to be released...
timeout /t 3 /nobreak >nul
echo   [OK] Port should be free now

echo.
echo Step 3: Starting backend server...
echo   Running: npm run dev
echo.
echo ================================================
echo   Backend starting...
echo   Press Ctrl+C to stop the server
echo ================================================
echo.

npm run dev
