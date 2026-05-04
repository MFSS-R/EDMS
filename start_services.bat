@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title EDMS Local Launcher

set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

set "BACKEND_DIR=%PROJECT_DIR%\backend"
set "FRONTEND_DIR=%PROJECT_DIR%\frontend"
set "VENV_PYTHON=%PROJECT_DIR%\venv\Scripts\python.exe"
set "LOG_DIR=%PROJECT_DIR%\logs"
set "BACKEND_LOG=%LOG_DIR%\backend.log"
set "FRONTEND_LOG=%LOG_DIR%\frontend.log"
set "BACKEND_PORT=3000"
set "FRONTEND_PORT=8000"
set "BACKEND_URL=http://127.0.0.1:%BACKEND_PORT%"
set "FRONTEND_URL=http://127.0.0.1:%FRONTEND_PORT%"

echo ========================================
echo           EDMS Local Launcher
echo ========================================
echo.

call :check_path "%BACKEND_DIR%" "Backend directory"
if errorlevel 1 goto :end
call :check_path "%FRONTEND_DIR%" "Frontend directory"
if errorlevel 1 goto :end

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
break > "%BACKEND_LOG%"
break > "%FRONTEND_LOG%"

if not exist "%VENV_PYTHON%" (
  echo [ERROR] Python virtual environment not found:
  echo         %VENV_PYTHON%
  echo.
  echo Please create it first:
  echo   python -m venv venv
  echo   venv\Scripts\pip install -r backend\requirements.txt
  goto :end
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found in PATH.
  echo         Please install Node.js and make sure npm is available.
  goto :end
)

if not exist "%BACKEND_DIR%\.env" (
  if exist "%BACKEND_DIR%\.env.example" (
    copy /Y "%BACKEND_DIR%\.env.example" "%BACKEND_DIR%\.env" >nul
    echo [INFO] Created backend\.env from .env.example
  ) else (
    echo [ERROR] backend\.env is missing and no .env.example was found.
    goto :end
  )
)

if not exist "%FRONTEND_DIR%\.env" (
  if exist "%FRONTEND_DIR%\.env.example" (
    copy /Y "%FRONTEND_DIR%\.env.example" "%FRONTEND_DIR%\.env" >nul
    echo [INFO] Created frontend\.env from .env.example
  ) else (
    echo [WARN] frontend\.env is missing. Continuing with defaults.
  )
)

call :check_port %BACKEND_PORT% "Backend"
if errorlevel 1 goto :end
call :check_port %FRONTEND_PORT% "Frontend"
if errorlevel 1 goto :end

echo [1/4] Checking backend configuration...
"%VENV_PYTHON%" "%BACKEND_DIR%\manage.py" check
if errorlevel 1 (
  echo [ERROR] Django configuration check failed.
  goto :end
)

echo.
echo [2/4] Applying database migrations...
"%VENV_PYTHON%" "%BACKEND_DIR%\manage.py" migrate
if errorlevel 1 (
  echo [ERROR] Database migration failed.
  goto :end
)

echo.
echo [3/4] Starting backend on port %BACKEND_PORT%...
start "EDMS-Backend" /min cmd /c "cd /d "%BACKEND_DIR%" && "%VENV_PYTHON%" manage.py runserver %BACKEND_PORT% 1>>"%BACKEND_LOG%" 2>>&1"
timeout /t 2 /nobreak >nul

echo [4/4] Starting frontend on port %FRONTEND_PORT%...
start "EDMS-Frontend" /min cmd /c "cd /d "%FRONTEND_DIR%" && npm run dev 1>>"%FRONTEND_LOG%" 2>>&1"
timeout /t 4 /nobreak >nul
start "" "%FRONTEND_URL%"

echo.
echo ========================================
echo EDMS services started
echo ========================================
echo Frontend: %FRONTEND_URL%
echo Backend : %BACKEND_URL%
echo Swagger : %BACKEND_URL%/swagger/
echo Logs    : %LOG_DIR%
echo.
echo Tips:
echo - Browser page will open automatically
echo - Service logs are written to logs\backend.log and logs\frontend.log
echo - Or run stop_services.bat for a quick shutdown
echo ========================================
echo.
pause
goto :end

:check_path
if not exist %~1 (
  echo [ERROR] %~2 not found:
  echo         %~1
  exit /b 1
)
exit /b 0

:check_port
set "PORT_IN_USE="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%~1 .*LISTENING"') do (
  set "PORT_IN_USE=%%P"
  goto :port_found
)
exit /b 0

:port_found
echo [ERROR] %~2 port %~1 is already in use by PID !PORT_IN_USE!.
echo         Please stop that process first or change the port.
exit /b 1

:end
endlocal
