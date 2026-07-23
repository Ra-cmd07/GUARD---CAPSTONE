@echo off
echo ============================================
echo  Trilateration Server - Firewall Fix
echo ============================================
echo.
echo This will add a firewall rule to allow
echo ESP32 boards to connect to port 8080
echo.
pause

netsh advfirewall firewall add rule name="Python Trilateration Server" dir=in action=allow protocol=TCP localport=8080

echo.
echo ============================================
if %errorlevel% == 0 (
    echo ✓ Firewall rule added successfully!
    echo ESP32 boards can now connect to port 8080
) else (
    echo ✗ Failed to add firewall rule
    echo Make sure you ran this as Administrator
)
echo ============================================
echo.
pause
