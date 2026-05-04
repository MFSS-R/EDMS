@echo off
setlocal EnableExtensions
chcp 65001 >nul
title EDMS Local Stopper

set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"
set "LOG_DIR=%PROJECT_DIR%\logs"
set "BACKEND_PORT=3000"
set "FRONTEND_PORT=8000"

echo ========================================
echo           EDMS Local Stopper
echo ========================================
echo.

call :stop_port %BACKEND_PORT% "Backend"
call :stop_port %FRONTEND_PORT% "Frontend"

echo.
echo Done.
if exist "%LOG_DIR%" echo Logs remain in: %LOG_DIR%
pause
goto :end

:stop_port
set "FOUND_PID="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%~1 .*LISTENING"') do (
  set "FOUND_PID=%%P"
  goto :kill_found
)
echo [INFO] %~2 port %~1 is not in use.
exit /b 0

:kill_found
echo [INFO] Stopping %~2 on port %~1 ^(PID !FOUND_PID!^) ...
taskkill /PID !FOUND_PID! /F >nul 2>nul
if errorlevel 1 (
  echo [WARN] Failed to stop PID !FOUND_PID!.
) else (
  echo [OK] %~2 stopped.
)
exit /b 0

:end
endlocal
