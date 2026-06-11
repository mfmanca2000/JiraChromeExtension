Dim scriptDir, nodeExe, serverJs
scriptDir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
nodeExe   = "C:\nvm4w\nodejs\node.exe"
serverJs  = scriptDir & "server.js"

Set sh = CreateObject("WScript.Shell")
sh.Run """" & nodeExe & """ """ & serverJs & """", 0, False
