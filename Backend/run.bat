@echo off
echo --- Starting HandyText Backend ---
cd /d "%~dp0"

:: Set path to venv python and pip
set VENV_PYTHON=.venv\Scripts\python.exe
set VENV_PIP=.venv\Scripts\pip.exe

:: Check if virtual environment exists
if not exist ".venv" (
    echo Virtual environment not found. Creating one...
    python -m venv .venv
)

:: Ensure we are using the venv's pip to check for fastapi
echo Checking dependencies...
%VENV_PYTHON% -m pip show fastapi >nul 2>&1
if %errorlevel% neq 0 (
    echo Requirements not found or incomplete.
    echo Upgrading pip...
    %VENV_PYTHON% -m pip install --upgrade pip
    echo Installing requirements from requirements.txt...
    %VENV_PYTHON% -m pip install -r requirements.txt
) else (
    echo Requirements already satisfied.
)

echo Starting server...
:: Run main.py using the venv's python directly
%VENV_PYTHON% main.py

if %errorlevel% neq 0 (
    echo.
    echo Server failed to start. Attempting a fresh dependency install...
    %VENV_PYTHON% -m pip install --upgrade pip
    %VENV_PYTHON% -m pip install -r requirements.txt
    echo.
    echo Retrying server start...
    %VENV_PYTHON% main.py
)

pause