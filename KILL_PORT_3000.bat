@echo off
echo ========================================
echo Killing Process on Port 3000
echo ========================================
echo.

echo Checking what's using port 3000...
netstat -ano | findstr :3000
echo.

echo Finding the process ID...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    set PID=%%a
    echo Found PID: %%a
    echo Killing process...
    taskkill /F /PID %%a
)

echo.
echo ========================================
echo Port 3000 should now be free!
echo You can now run: npm run dev
echo ========================================
pause
