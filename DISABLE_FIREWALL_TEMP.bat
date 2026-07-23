@echo off
echo ============================================
echo  TEMPORARILY DISABLE WINDOWS FIREWALL
echo  (For Testing Only!)
echo ============================================
echo.
echo This will DISABLE Windows Firewall to test
echo if it's blocking the ESP32 connection.
echo.
echo IMPORTANT:
echo  - This is for TESTING only
echo  - Turn firewall back ON after testing
echo  - Only use this to confirm the problem
echo.
pause

echo.
echo [Step 1] Disabling firewall on all profiles...
netsh advfirewall set allprofiles state off

if %errorlevel% == 0 (
    echo   ✓ Firewall DISABLED
) else (
    echo   ✗ FAILED - Must run as Administrator!
    pause
    exit /b 1
)

echo.
echo ============================================
echo  FIREWALL IS NOW OFF
echo ============================================
echo.
echo NOW DO THIS:
echo  1. Press RESET button on ESP32
echo  2. Check Serial Monitor
echo  3. Look for "✓ HTTP 200" instead of "POST failed"
echo.
echo If it works now:
echo   → Firewall WAS the problem
echo   → Need to fix firewall rules (not just disable it)
echo.
echo If it STILL fails:
echo   → Problem is something else (antivirus, network, etc.)
echo.
echo TO RE-ENABLE FIREWALL:
echo   - Run ENABLE_FIREWALL.bat
echo   - OR manually: Windows Security → Turn ON firewall
echo.
echo ============================================
pause
