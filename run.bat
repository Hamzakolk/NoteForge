@echo off
REM Runs NoteForge from source (creates a virtual environment on first run).
setlocal
cd /d "%~dp0"
if not exist .venv (
    python -m venv .venv || goto :error
    call .venv\Scripts\activate.bat
    pip install -r requirements.txt || goto :error
) else (
    call .venv\Scripts\activate.bat
)
python main.py
exit /b 0

:error
echo Setup failed. Make sure Python 3.10+ is installed and on PATH.
pause
exit /b 1
