@echo off
echo ========================================
echo AttendBox PWA - Icon Generator
echo ========================================
echo.

echo Checking if Pillow is installed...
python -c "import PIL" 2>nul
if %errorlevel% neq 0 (
    echo Pillow not found. Installing...
    pip install Pillow
    echo.
)

echo Generating PWA icons...
echo.
python generate_icons.py

echo.
echo ========================================
echo Done! Press any key to exit...
pause >nul
