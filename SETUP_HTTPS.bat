@echo off
echo ========================================
echo HTTPS Setup for Local Development
echo ========================================
echo.

echo This script will:
echo 1. Install mkcert (certificate tool)
echo 2. Create local SSL certificates
echo 3. Configure Vite for HTTPS
echo.
pause

echo.
echo Step 1: Installing mkcert...
echo ========================================
echo.

REM Check if Chocolatey is installed
where choco >nul 2>&1
if %errorlevel% neq 0 (
    echo Chocolatey not found. Installing Chocolatey first...
    echo.
    echo Please run this command in PowerShell as Administrator:
    echo.
    echo Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    echo.
    echo After installing Chocolatey, run this script again.
    pause
    exit /b
)

echo Installing mkcert via Chocolatey...
choco install mkcert -y

echo.
echo Step 2: Creating local Certificate Authority...
echo ========================================
mkcert -install

echo.
echo Step 3: Generating SSL certificates...
echo ========================================
echo.

REM Create certs directory
if not exist "certs" mkdir certs

REM Generate certificates for localhost and local IP
mkcert -cert-file certs/localhost.pem -key-file certs/localhost-key.pem localhost 192.168.1.29 127.0.0.1 ::1

echo.
echo ========================================
echo ✅ Certificates created successfully!
echo ========================================
echo.
echo Files created:
echo   - certs/localhost.pem (certificate)
echo   - certs/localhost-key.pem (private key)
echo.
echo Next steps:
echo 1. Run CONFIGURE_VITE_HTTPS.bat to update Vite config
echo 2. Restart frontend with: npm run dev
echo 3. Access via HTTPS: https://192.168.1.29:3000
echo.
pause
