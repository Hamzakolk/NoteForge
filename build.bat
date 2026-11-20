@echo off
REM Builds dist\NoteForge\NoteForge.exe  (Windows, Python 3.10+)
setlocal
cd /d "%~dp0"

if not exist .venv (
    python -m venv .venv || goto :error
)
call .venv\Scripts\activate.bat || goto :error
python -m pip install --upgrade pip >nul
pip install -r requirements-dev.txt || goto :error

pyinstaller --noconfirm --clean --windowed --name NoteForge ^
    --icon assets\icon.ico ^
    --add-data "assets;assets" ^
    main.py || goto :error

echo.
echo Done!  Run: dist\NoteForge\NoteForge.exe
exit /b 0

:error
echo.
echo Build failed.
exit /b 1
