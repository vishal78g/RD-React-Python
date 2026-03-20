@echo off
setlocal

if not exist ".venv\Scripts\python.exe" (
    echo .venv Python not found. Create and activate virtual environment first.
    exit /b 1
)

".venv\Scripts\python.exe" build_extract_agent_exe.py
if errorlevel 1 (
    echo Build failed.
    exit /b 1
)

echo Build succeeded.
endlocal
