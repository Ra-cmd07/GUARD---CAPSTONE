@echo off
echo ============================================
echo  Check for Antivirus/Security Software
echo ============================================
echo.

echo [1] Checking Windows Defender status...
powershell -Command "Get-MpPreference | Select-Object -Property DisableRealtimeMonitoring, DisableIOAVProtection"

echo.
echo [2] Checking for third-party antivirus...
wmic /namespace:\\root\securitycenter2 path antivirusproduct get displayname,productstate

echo.
echo [3] Checking firewall state...
netsh advfirewall show allprofiles state

echo.
echo [4] Checking if port 8080 is blocked by anything...
netstat -an | findstr ":8080"

echo.
echo ============================================
echo  DIAGNOSIS:
echo ============================================
echo.
echo If you see antivirus software listed above:
echo   → Open that antivirus program
echo   → Go to Firewall settings
echo   → Add exception for Port 8080 and python.exe
echo.
echo Common antivirus firewalls:
echo   - Norton Internet Security
echo   - McAfee Total Protection  
echo   - Kaspersky Internet Security
echo   - Avast Premium Security
echo   - AVG Internet Security
echo   - Bitdefender Total Security
echo.
pause
