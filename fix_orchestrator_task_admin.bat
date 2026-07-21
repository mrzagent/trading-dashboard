@echo off
REM Run this file as Administrator to fix the TradingOrchestrator scheduled task

echo Fixing TradingOrchestrator scheduled task...
echo.

REM Delete existing task if exists
schtasks /delete /tn "TradingOrchestrator" /f 2>nul

REM Create task with multiple triggers using XML
set "TEMP_XML=%TEMP%\orchestrator_task.xml"

(
echo ^<?xml version="1.0" encoding="UTF-16"?^>
echo ^<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task"^>
echo   ^<RegistrationInfo^>
echo     ^<Description^>Trading Orchestrator - runs on logon and every 5 minutes^</Description^>
echo   ^</RegistrationInfo^>
echo   ^<Triggers^>
echo     ^<LogonTrigger^>
echo       ^<Enabled^>true^</Enabled^>
echo     ^</LogonTrigger^>
echo     ^<TimeTrigger^>
echo       ^<Repetition^>
echo         ^<Interval^>PT5M^</Interval^>
echo         ^<Duration^>P365D^</Duration^>
echo       ^</Repetition^>
echo       ^<StartBoundary^>2026-01-01T00:00:00^</StartBoundary^>
echo       ^<Enabled^>true^</Enabled^>
echo     ^</TimeTrigger^>
echo   ^</Triggers^>
echo   ^<Principals^>
echo     ^<Principal id="Author"^>
echo       ^<LogonType^>InteractiveToken^</LogonType^>
echo       ^<RunLevel^>HighestAvailable^</RunLevel^>
echo     ^</Principal^>
echo   ^</Principals^>
echo   ^<Settings^>
echo     ^<MultipleInstancesPolicy^>IgnoreNew^</MultipleInstancesPolicy^>
echo     ^<DisallowStartIfOnBatteries^>false^</DisallowStartIfOnBatteries^>
echo     ^<StopIfGoingOnBatteries^>false^</StopIfGoingOnBatteries^>
echo     ^<AllowHardTerminate^>true^</AllowHardTerminate^>
echo     ^<StartWhenAvailable^>true^</StartWhenAvailable^>
echo     ^<RunOnlyIfNetworkAvailable^>false^</RunOnlyIfNetworkAvailable^>
echo     ^<IdleSettings^>
echo       ^<StopOnIdleEnd^>true^</StopOnIdleEnd^>
echo       ^<RestartOnIdle^>false^</RestartOnIdle^>
echo     ^</IdleSettings^>
echo     ^<AllowStartOnDemand^>true^</AllowStartOnDemand^>
echo     ^<Enabled^>true^</Enabled^>
echo     ^<Hidden^>false^</Hidden^>
echo     ^<RunOnlyIfIdle^>false^</RunOnlyIfIdle^>
echo     ^<WakeToRun^>false^</WakeToRun^>
echo     ^<ExecutionTimeLimit^>PT10M^</ExecutionTimeLimit^>
echo     ^<Priority^>7^</Priority^>
echo   ^</Settings^>
echo   ^<Actions Context="Author"^>
echo     ^<Exec^>
echo       ^<Command^>wscript.exe^</Command^>
echo       ^<Arguments^>D:\dev\trading-dashboard\run_orchestrator_hidden.vbs^</Arguments^>
echo     ^</Exec^>
echo   ^</Actions^>
echo ^</Task^>
) > "%TEMP_XML%"

REM Import the task from XML
schtasks /create /tn "TradingOrchestrator" /xml "%TEMP_XML%" /f

REM Clean up temp file
del "%TEMP_XML%" 2>nul

if %errorlevel% neq 0 (
  echo ERROR: Failed to create task from XML
  echo Trying fallback method...
  
  REM Fallback: simple minute-based task
  schtasks /create /tn "TradingOrchestrator" ^
    /tr "wscript.exe D:\dev\trading-dashboard\run_orchestrator_hidden.vbs" ^
    /sc minute /mo 5 ^
    /rl highest ^
    /f
)

echo.
echo [OK] TradingOrchestrator task created successfully!
echo.
echo The orchestrator will now run:
echo   - When you log in to Windows
echo   - Every 5 minutes while PC is running
echo   - After PC restart (once you log in)
echo.
pause
