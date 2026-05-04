@echo off
chcp 65001 >nul
title EDMS 服务启动器
echo ========================================
echo    EDMS 服务启动中...
echo ========================================
echo.

REM 获取脚本所在目录
set "PROJECT_DIR=%~dp0"

REM 启动后端服务 (3000 端口)
echo [1/2] 启动后端服务 (Django) ...
start "EDMS-Backend" cmd /k "cd /d "%PROJECT_DIR%backend" && "%PROJECT_DIR%venv\Scripts\python.exe" manage.py runserver 3000"

timeout /t 2 /nobreak >nul

REM 启动前端服务 (8000 端口)
echo [2/2] 启动前端服务 (WebUI) ...
start "EDMS-Frontend" cmd /k "cd /d "%PROJECT_DIR%frontend" && set PATH=C:\Program Files\nodejs;%%PATH%% && npm run dev"

echo.
echo ========================================
echo    服务已启动！
echo ========================================
echo.
echo  前端 WebUI: http://localhost:8000
echo  后端 API:    http://localhost:3000
echo  Swagger文档: http://localhost:3000/swagger/
echo.
echo  关闭这些窗口即可停止服务。
echo ========================================
echo.
pause
