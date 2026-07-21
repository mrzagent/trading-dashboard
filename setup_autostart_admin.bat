@echo off
REM Run this file as Administrator to set up trading dashboard auto-start

echo Creating scheduled tasks for Trading Dashboard auto-start...
echo.

REM Remove existing tasks if they exist
schtasks /delete /tn "TradingDashboardStartup" /f 2>nul
schtasks /delete /tn "TradingDashboardWake" /f 2>nul

REM Create the logon task - starts dashboard when user logs in
schtasks /create /tn "TradingDashboardStartup" ^
  /tr "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File D:\dev\trading-dashboard\start-dashboard.ps1" ^
  /sc onlogon ^
  /rl highest ^
  /f

if %errorlevel% neq 0 (
  echo ERROR: Failed to create TradingDashboardStartup task
  pause
  exit /b 1
)

echo [OK] TradingDashboardStartup task created

REM Create the wake-from-sleep task using event trigger
REM Event ID 1 from Power-Troubleshooter = System woke from sleep
schtasks /create /tn "TradingDashboardWake" ^
  /tr "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File D:\dev\trading-dashboard\start-dashboard.ps1" ^
  /sc onevent ^
  /ec System ^
  /mo "*[System[Provider[@Name='Microsoft-Windows-Power-Troubleshooter'] and EventID=1]]" ^
  /rl highest ^
  /f

if %errorlevel% neq 0 (
  echo ERROR: Failed to create TradingDashboardWake task
  pause
  exit /b 1
)

echo [OK] TradingDashboardWake task created

echo.
echo ==========================================
echo Scheduled tasks created successfully!
echo.
echo The trading dashboard will now auto-start:
echo   - When you log in to Windows
echo   - When your PC wakes from sleep/hibernation
echo.
echo Ports:
echo   - API Server: http://localhost:3001
echo   - Vite Client: http://localhost:5173
echo.
echo Logs: D:\dev\trading-dashboard\logs\
echo ==========================================
echo.
pause
