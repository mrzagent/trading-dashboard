Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "D:\dev\trading-dashboard"

' First, kill any zombie orchestrator processes
WshShell.Run "cmd /c D:\dev\trading-dashboard\kill_zombie_orchestrators.bat > D:\dev\trading-dashboard\logs\zombie_cleanup.log 2>&1", 0, True

' Then run the orchestrator with timeout protection
' Use orchestrator_safe.py instead of orchestrator.py directly
' This prevents zombie processes if orchestrator hangs
WshShell.Run "cmd /c python.exe D:\dev\trading-dashboard\orchestrator_safe.py > D:\dev\trading-dashboard\logs\orchestrator.log 2>&1", 0, False

Set WshShell = Nothing
