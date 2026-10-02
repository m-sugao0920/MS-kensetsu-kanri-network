@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title MS Construction Shared Server
where py >nul 2>nul
if not errorlevel 1 goto use_py
where python >nul 2>nul
if not errorlevel 1 goto use_python
echo Python was not found. Please install Python on the server PC.
pause
goto end
:use_py
py -3 "%~dp0server.py"
goto stopped
:use_python
python "%~dp0server.py"
:stopped
echo Server stopped. See the message above.
pause
:end
endlocal
