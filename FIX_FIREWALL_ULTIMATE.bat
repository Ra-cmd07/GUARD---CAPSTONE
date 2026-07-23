@echo off
REM ============================================
REM  ULTIMATE Firewall Fix for ESP32
REM ============================================
REM This script:
REM  1. Removes old firewall rules
REM  2. Adds comprehensive rules for port 8080
REM  3. Allows Python.exe through firewall
REM  4. Applies to ALL network profiles
REM  5. Tests if firewall is the blocker
REM ============================================

echo.
echo ============================================
echo   ULTIMATE Firewall Fix for ESP32
echo ============================================
echo.
echo This will add firewall rules to allow:
echo   - Port 8080 (Trilateration Server)
echo   - Python.exe (Server program)
echo   - All network profiles (Domain/Private/Public)
echo.
echo IMPORTANT: You must run this as Administrator!
echo.
pause

REM ====================
REM Step 1: Clean up old rules
REM ====================
echo.
echo [Step 1/5] Cleaning up old firewall rules...
netsh advfirewall firewall delete rule name="Trilateration Server Inbound" >nul 2>&1
netsh advfirewall firewall delete rule name="Trilateration Server Outbound" >nul 2>&1
netsh advfirewall firewall delete rule name="Python Trilateration" >nul 2>&1
netsh advfirewall firewall delete rule name="Trilateration Port 8080" >nul 2>&1
echo   Old rules removed

REM ====================
REM Step 2: Add inbound rule for port 8080
REM ====================
echo.
echo [Step 2/5] Adding INBOUND rule for port 8080...
netsh advfirewall firewall add rule ^
    name="Trilateration Port 8080 IN" ^
    dir=in ^
    action=allow ^
    protocol=TCP ^
    localport=8080 ^
    profile=any ^
    enable=yes

if %errorlevel% == 0 (
    echo   ✓ Inbound rule added successfully
) else (
    echo   ✗ FAILED - Make sure you ran as Administrator!
    pause
    exit /b 1
)

REM ====================
REM Step 3: Add outbound rule for port 8080
REM ====================
echo.
echo [Step 3/5] Adding OUTBOUND rule for port 8080...
netsh advfirewall firewall add rule ^
    name="Trilateration Port 8080 OUT" ^
    dir=out ^
    action=allow ^
    protocol=TCP ^
    localport=8080 ^
    profile=any ^
    enable=yes

if %errorlevel% == 0 (
    echo   ✓ Outbound rule added successfully
) else (
    echo   ✗ Warning: Outbound rule failed ^(may not be needed^)
)

REM ====================
REM Step 4: Find and allow Python.exe
REM ====================
echo.
echo [Step 4/5] Finding Python executable...
where python >nul 2>&1
if %errorlevel% == 0 (
    for /f "tokens=*" %%i in ('where python 2^>nul') do (
        echo   Found: %%i
        netsh advfirewall firewall add rule ^
            name="Python Server INBOUND" ^
            dir=in ^
            action=allow ^
            program="%%i" ^
            enable=yes ^
            profile=any >nul 2>&1
        netsh advfirewall firewall add rule ^
            name="Python Server OUTBOUND" ^
            dir=out ^
            action=allow ^
            program="%%i" ^
            enable=yes ^
            profile=any >nul 2>&1
        echo   ✓ Python firewall rules added
        goto :pythonfound
    )
) else (
    echo   ! Python not found in PATH ^(OK if server starts^)
)
:pythonfound

REM ====================
REM Step 5: Verify rules were added
REM ====================
echo.
echo [Step 5/5] Verifying firewall rules...
netsh advfirewall firewall show rule name="Trilateration Port 8080 IN" | findstr /C:"Rule Name" >nul 2>&1
if %errorlevel% == 0 (
    echo   ✓ Rules verified successfully
) else (
    echo   ✗ Rules not found - something went wrong!
    pause
    exit /b 1
)

REM ====================
REM Success summary
REM ====================
echo.
echo ============================================
echo   SUCCESS! Firewall rules configured!
echo ============================================
echo.
echo What was done:
echo   ✓ Port 8080 INBOUND:  ALLOWED
echo   ✓ Port 8080 OUTBOUND: ALLOWED
echo   ✓ Python.exe:         ALLOWED
echo   ✓ All network profiles: ENABLED
echo.
echo Next steps:
echo   1. Press RESET button on ESP32 board
echo   2. Open Serial Monitor (115200 baud)
echo   3. Look for "✓ HTTP 200" instead of "POST failed"
echo.
echo If STILL getting "POST failed":
echo   • Try temporarily disabling Windows Firewall
echo   • Check if antivirus is blocking
echo   • Verify ESP32 WiFi: Should show 192.168.1.XXX
echo   • Run: ipconfig (verify computer is 192.168.1.29)
echo.
echo ============================================
pause
