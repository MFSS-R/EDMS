@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title EDMS User Admin Menu Launcher

set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

set "BACKEND_DIR=%PROJECT_DIR%\backend"
set "VENV_PYTHON=%PROJECT_DIR%\venv\Scripts\python.exe"

if not exist "%VENV_PYTHON%" (
  echo [ERROR] Python virtual environment not found:
  echo         %VENV_PYTHON%
  pause
  exit /b 1
)

if not exist "%BACKEND_DIR%\manage.py" (
  echo [ERROR] manage.py not found:
  echo         %BACKEND_DIR%\manage.py
  pause
  exit /b 1
)

pushd "%BACKEND_DIR%" >nul
"%VENV_PYTHON%" manage.py user_admin_menu
popd >nul
pause
endlocal
