Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "D:\dev\trading-dashboard"
WshShell.Run "cmd /c python.exe D:\dev\trading-dashboard\health_check_orchestrator.py > D:\dev\trading-dashboard\logs\health_check.log 2>&1", 0, False
Set WshShell = Nothing
