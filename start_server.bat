@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title MS Construction Management v5.4.2

echo ============================================================
echo MS Construction Management v5.4.2
echo Program folder: %CD%
echo ============================================================
echo.

rem Check whether port 8766 is already serving this app.
powershell -NoProfile -Command "try { $r=Invoke-RestMethod -Uri 'http://127.0.0.1:8766/api/ping' -TimeoutSec 2; if($r.ok){exit 0}else{exit 1} } catch { exit 1 }"
if not errorlevel 1 goto already_running

where py >nul 2>nul
if not errorlevel 1 goto use_py
where python >nul 2>nul
if not errorlevel 1 goto use_python

echo [ERROR] Python was not found.
echo Please do not close this window. Take a screenshot of this message.
pause
goto end

:use_py
echo Starting server with Python launcher...
py -3 "%~dp0server.py"
goto server_ended

:use_python
echo Starting server with Python...
python "%~dp0server.py"
goto server_ended

:already_running
echo Port 8766 is already running an MS server.
echo Opening the current server in Chrome...
start "" chrome.exe "http://localhost:8766/index.html" 2>nul
if errorlevel 1 start "" "http://localhost:8766/index.html"
echo.
echo If this is an OLD version, close its black server window first,
echo then run start_server.bat again.
pause
goto end

:server_ended
echo.
echo ============================================================
echo The server stopped or could not start.
echo The error message is shown above.
echo Please take a screenshot of this black window if it did not start.
echo ============================================================
pause

:end
endlocal
