@echo off
echo ========================================================
echo   Starting Continuum Morph-Arm Simulation Workcell...
echo ========================================================
cd /d "%~dp0"
python serve.py
if %ERRORLEVEL% NEQ 0 (
    echo Python serve.py encountered an issue. Falling back to built-in module...
    start http://localhost:8000/index.html
    python -m http.server 8000
)
pause
