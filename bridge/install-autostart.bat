@echo off
setlocal

set TASK_NAME=SAP Cookie Bridge
set VBS=%~dp0launcher.vbs

echo Registering "%TASK_NAME%" to start at login...
schtasks /create /tn "%TASK_NAME%" /tr "wscript.exe \"%VBS%\"" /sc onlogon /f /it
powershell -NoProfile -Command "$t=Get-ScheduledTask -TaskName '%TASK_NAME%';$t.Settings.DisallowStartIfOnBatteries=$false;$t.Settings.StopIfGoingOnBatteries=$false;Set-ScheduledTask -InputObject $t" >nul 2>&1

if %ERRORLEVEL% == 0 (
  echo.
  echo SUCCESS. The bridge will start automatically at every login.
  echo No console window will appear -- it runs silently in the background.
  echo.
  echo To remove the auto-start:
  echo   schtasks /delete /tn "%TASK_NAME%" /f
  echo.
  echo Starting the bridge now for this session...
  wscript.exe "%VBS%"
  echo Done. Bridge is running on http://127.0.0.1:27182
) else (
  echo.
  echo FAILED. Try running this file as administrator.
)
pause
