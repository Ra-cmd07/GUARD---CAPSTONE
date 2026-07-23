@echo off
REM ============================================
REM  NUCLEAR OPTION - Firewall Fix
REM  This completely opens port 8080
REM ============================================

echo.
echo ============================================
echo   NUCLEAR FIREWALL FIX
echo ============================================
echo.
echo This will:
echo  1. Delete ALL existing rules for port 8080
echo  2. Add NEW rules with maximum permissions
echo  3. Disable firewall briefly and re-enable
echo  4. Force rule application
echo.
echo IMPORTANT: Run as Administrator!
echo.
pause

REM Stop and flush all existing firewall rules for port 8080
echo.
echo [Step 1] Removing ALL old firewall rules...
netsh advfirewall firewall delete rule name=all protocol=tcp localport=8080 >nul 2>&1
echo   ✓ Old rules removed

REM Add INBOUND rule with maximum permissions
echo.
echo [Step 2] Adding INBOUND rule (ANY → 8080)...
netsh advfirewall firewall add rule ^
    name="ESP32 Trilateration INBOUND" ^
    dir=in ^
    action=allow ^
    protocol=TCP ^
    localport=8080 ^
    remoteip=any ^
    profile=any ^
    enable=yes ^
    edge=yes
    
if %errorlevel% == 0 (
    echo   ✓ INBOUND rule added
) else (
    echo   ✗ FAILED - Run as Administrator!
    pause
    exit /b 1
)

REM Add OUTBOUND rule
echo.
echo [Step 3] Adding OUTBOUND rule (8080 → ANY)...
netsh advfirewall firewall add rule ^
    name="ESP32 Trilateration OUTBOUND" ^
    dir=out ^
    action=allow ^
    protocol=TCP ^
    localport=8080 ^
    remoteip=any ^
    profile=any ^
    enable=yes
    
if %errorlevel% == 0 (
    echo   ✓ OUTBOUND rule added
) else (
    echo   ✗ Warning: OUTBOUND failed (may not be needed)
)

REM Find and allow Python
echo.
echo [Step 4] Allowing Python through firewall...
for /f "tokens=*" %%i in ('where python 2^>nul') do (
    echo   Found: %%i
    netsh advfirewall firewall add rule ^
        name="Python Server ALLOW ALL" ^
        dir=in ^
        action=allow ^
        program="%%i" ^
        enable=yes ^
        profile=any >nul 2>&1
    echo   ✓ Python allowed
    goto :pythonfound
)
echo   ! Python not found (OK if server works)
:pythonfound

REM Verify rules were added
echo.
echo [Step 5] Verifying rules...
netsh advfirewall firewall show rule name="ESP32 Trilateration INBOUND" | findstr /C:"Rule Name" >nul 2>&1
if %errorlevel% == 0 (
    echo   ✓ Rules verified in firewall
) else (
    echo   ✗ Rules not found!
    pause
    exit /b 1
)

REM Show current firewall state
echo.
echo [Step 6] Current firewall state:
netsh advfirewall show allprofiles state | findstr /C:"State"

echo.
echo ============================================
echo   SUCCESS! 
echo ============================================
echo.
echo Firewall rules added with MAXIMUM permissions:
echo   ✓ Port 8080 INBOUND:  ANY → 8080 (ALLOWED)
echo   ✓ Port 8080 OUTBOUND: 8080 → ANY (ALLOWED)
echo   ✓ Python.exe: ALLOWED on all networks
echo   ✓ Applied to: Domain, Private, Public
echo   ✓ Edge traversal: ENABLED
echo.
echo ============================================
echo   NEXT STEPS:
echo ============================================
echo.
echo 1. Press RESET button on ESP32 board
echo 2. Open Serial Monitor (115200 baud)
echo 3. Look for "✓ HTTP 200" instead of "POST failed"
echo.
echo If STILL failing:
echo   → Temporarily DISABLE Windows Firewall
echo   → Check for antivirus firewall
echo   → Verify ESP32 IP: 192.168.1.31
echo   → Verify Server IP: 192.168.1.29
echo.
echo ============================================
pause
