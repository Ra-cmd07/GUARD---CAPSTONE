@echo off
title BLE Trilateration Server
echo.
echo ============================================================
echo   Starting BLE Trilateration Server
echo ============================================================
echo.
echo Checking Python installation...
python --version
echo.
echo Starting server on port 8080...
echo.
python trilateration_server.py
echo.
echo Server stopped.
pause
