' Launches the importer wrapper with no console window at all.
' Task Scheduler cannot hide console apps; wscript can (window style 0).
Dim shell, scriptDir
Set shell = CreateObject("Wscript.Shell")
scriptDir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & scriptDir & "import_ideas_task.ps1""", 0, False
