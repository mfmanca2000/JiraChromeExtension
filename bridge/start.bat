@echo off
echo SAP Cookie Bridge
echo =================
echo Starting on http://127.0.0.1:27182
echo.
echo Keep this window open while logging time.
echo Open http://127.0.0.1:27182 in Edge to get the bookmarklet.
echo.
"C:\nvm4w\nodejs\node.exe" "%~dp0server.js"
pause
