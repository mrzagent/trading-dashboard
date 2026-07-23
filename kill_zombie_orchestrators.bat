@echo off
echo [%date% %time%] Checking for zombie orchestrator processes...

:: Find and kill any python processes running orchestrator.py
for /f "tokens=2 delims=," %%a in ('tasklist /FI "IMAGENAME eq python.exe" /FO CSV /NH 2^>nul') do (
    set "pid=%%~a"
    :: Check if this process is running orchestrator
    wmic process where "ProcessId=%%~a" get CommandLine /format:list 2>nul | findstr /i "orchestrator" >nul
    if !errorlevel! == 0 (
        echo Killing zombie orchestrator process: %%~a
        taskkill /F /PID %%~a 2>nul
    )
)

echo [%date% %time%] Zombie cleanup complete.
