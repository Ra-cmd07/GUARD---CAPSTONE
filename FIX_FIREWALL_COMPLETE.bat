@echo off
echo ============================================
echo  Complete Firewall Fix for Trilateration
echo ============================================
echo.
echo This will:
echo  1. Add inbound rule for port 8080
echo  2. Add outbound rule for port 8080
echo  3. Allow Python through firewall
echo  4. Apply to ALL network profiles
echo.
pause

echo.
echo [1/4] Adding inbound rule for port 8080...
netsh advfirewall firewall delete rule name="Trilateration Server Inbound" >nul 2>&1
netsh advfirewall firewall add rule name="Trilateration Server Inbound" dir=in action=allow protocol=TCP localport=8080 profile=any

echo [2/4] Adding outbound rule for port 8080...
netsh advfirewall firewall delete rule name="Trilateration Server Outbound" >nul 2>&1
netsh advfirewall firewall add rule name="Trilateration Server Outbound" dir=out action=allow protocol=TCP localport=8080 profile=any

echo [3/4] Finding Python executable...
where python >nul 2>&1
if %errorlevel% == 0 (
    for /f "tokens=*" %%i in ('where python') do (
        echo Found Python at: %%i
        echo Adding firewall rule for Python...
        netsh advfirewall firewall delete rule name="Python Trilateration" >nul 2>&1
        netsh advfirewall firewall add rule name="Python Trilateration" dir=in action=allow program="%%i" enable=yes profile=any
        goto :pythonfound
    )
)
:pythonfound

echo [4/4] Applying rules to all network profiles...
netsh advfirewall set allprofiles firewallpolicy blockinbound,allowoutbound

echo.
echo ============================================
if %errorlevel% == 0 (
    echo  SUCCESS! Firewall configured!
    echo.
    echo  What was done:
    echo   - Port 8080 inbound: ALLOWED
    echo   - Port 8080 outbound: ALLOWED
    echo   - Python.exe: ALLOWED
    echo   - Applied to: Domain, Private, Public
    echo.
    echo  Now try your ESP32 again!
) else (
    echo  FAILED! 
    echo  Make sure you ran as Administrator
)
echo ============================================
echo.
pause
