@echo off
echo ============================================
echo  RE-ENABLE WINDOWS FIREWALL
echo ============================================
echo.

echo Enabling firewall on all profiles...
netsh advfirewall set allprofiles state on

if %errorlevel% == 0 (
    echo   ✓ Firewall RE-ENABLED
) else (
    echo   ✗ FAILED - Must run as Administrator!
    pause
    exit /b 1
)

echo.
echo ============================================
echo  FIREWALL IS NOW ON (Safe)
echo ============================================
echo.
pause
