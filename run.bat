@echo off
REM ============================================
REM  AI Polish Assistant - Single Service Launcher
REM  Start backend (serves frontend + API) on http://127.0.0.1:8000
REM ============================================
cd /d "%~dp0"

if not exist "venv\Scripts\python.exe" (
    echo [ERROR] venv not found. Creating...
    python -m venv venv
    venv\Scripts\python.exe -m pip install -r requirements.txt
)

if not exist "frontend\dist\index.html" (
    echo [WARN] Frontend not built. Building...
    pushd frontend
    if not exist "node_modules" call npm install
    call npm run build
    popd
)

echo Starting service at http://127.0.0.1:8000 ...
venv\Scripts\python.exe api_server.py
pause
