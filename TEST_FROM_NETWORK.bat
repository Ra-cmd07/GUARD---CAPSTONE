@echo off
echo ============================================
echo  Test Server from Network Perspective
echo ============================================
echo.
echo This tests if port 8080 is accessible
echo from the network (like ESP32 sees it)
echo.

echo [Test 1] Checking localhost (127.0.0.1:8080)...
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8080/status' -UseBasicParsing -TimeoutSec 3; Write-Host '  ✓ Localhost works: HTTP' $r.StatusCode } catch { Write-Host '  ✗ Failed:' $_.Exception.Message }"

echo.
echo [Test 2] Checking LAN IP (192.168.1.29:8080)...
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://192.168.1.29:8080/status' -UseBasicParsing -TimeoutSec 3; Write-Host '  ✓ LAN IP works: HTTP' $r.StatusCode } catch { Write-Host '  ✗ Failed:' $_.Exception.Message }"

echo.
echo [Test 3] Checking from EXTERNAL perspective...
echo (Simulating how ESP32 sees it)
powershell -Command "$ip = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Wi-Fi').IPAddress; Write-Host '  Your IP:' $ip; try { $r = Invoke-WebRequest -Uri \"http://$ip:8080/status\" -UseBasicParsing -TimeoutSec 3; Write-Host '  ✓ External test works: HTTP' $r.StatusCode } catch { Write-Host '  ✗ External test FAILED:' $_.Exception.Message }"

echo.
echo [Test 4] Checking if port is listening...
netstat -an | findstr ":8080.*LISTENING"
if %errorlevel% == 0 (
    echo   ✓ Port 8080 is LISTENING
) else (
    echo   ✗ Port 8080 is NOT listening
    echo   → Start server: python trilateration_server_MULTI.py
)

echo.
echo [Test 5] Checking firewall rules...
netsh advfirewall firewall show rule name=all protocol=tcp localport=8080 | findstr /C:"Rule Name" | findstr /V "WSL"
if %errorlevel% == 0 (
    echo   ✓ Firewall rules exist for port 8080
) else (
    echo   ✗ NO firewall rules for port 8080
    echo   → Run FIX_FIREWALL_NUCLEAR.bat as Administrator
)

echo.
echo ============================================
echo  DIAGNOSIS:
echo ============================================
echo.
echo If Test 1 works but Test 2 fails:
echo   → Firewall is blocking external connections
echo   → Run FIX_FIREWALL_NUCLEAR.bat
echo.
echo If all tests work:
echo   → Problem is with ESP32 WiFi or network
echo   → Check ESP32 IP: Should be 192.168.1.XXX
echo   → Check SERVER_URL in ESP32 code
echo.
echo If no tests work:
echo   → Server is not running
echo   → Start: python trilateration_server_MULTI.py
echo.
pause
