@echo off
echo ============================================
echo  Connection Diagnostic Tool
echo ============================================
echo.

echo [1/5] Checking if server is running...
netstat -an | findstr :8080
if %errorlevel% == 0 (
    echo   ✓ Server is listening on port 8080
) else (
    echo   ✗ Server is NOT running on port 8080
    echo   → Start server: python trilateration_server_MULTI.py
    pause
    exit /b 1
)

echo.
echo [2/5] Checking firewall rules...
netsh advfirewall firewall show rule name="Trilateration Port 8080 IN" | findstr /C:"Rule Name" >nul 2>&1
if %errorlevel% == 0 (
    echo   ✓ Firewall rule exists
) else (
    echo   ✗ Firewall rule NOT found
    echo   → Run FIX_FIREWALL_ULTIMATE.bat as Administrator
)

echo.
echo [3/5] Checking computer IP address...
ipconfig | findstr /C:"IPv4"
echo   → ESP32 should connect to one of these IPs

echo.
echo [4/5] Testing if port 8080 is accessible...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8080/status' -UseBasicParsing -TimeoutSec 5; Write-Host '  ✓ Server responds: HTTP' $response.StatusCode } catch { Write-Host '  ✗ Server not responding:' $_.Exception.Message }"

echo.
echo [5/5] Checking Windows Firewall status...
netsh advfirewall show allprofiles state | findstr /C:"State"

echo.
echo ============================================
echo  Diagnosis Complete
echo ============================================
echo.
echo RECOMMENDED ACTIONS:
echo.
echo 1. Run FIX_FIREWALL_ULTIMATE.bat as Administrator
echo 2. OR temporarily disable Windows Firewall to test
echo 3. Reset ESP32 after firewall changes
echo.
echo To disable firewall temporarily:
echo   - Open Windows Security
echo   - Go to Firewall ^& network protection
echo   - Turn OFF Windows Defender Firewall
echo   - Reset ESP32 and test
echo   - Turn firewall back ON after testing
echo.
pause
