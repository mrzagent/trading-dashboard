Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c python.exe D:\dev\trading-dashboard\orchestrator.py > D:\dev\trading-dashboard\logs\orchestrator.log 2>&1", 0, False
Set WshShell = Nothing
