#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Create a scheduled task to start trading dashboard on user logon
.DESCRIPTION
    Creates a Windows scheduled task that starts the trading dashboard server when the user logs in
#>

$ErrorActionPreference = "Stop"

$taskName = "TradingDashboardStartup"
$scriptPath = "D:\dev\trading-dashboard\start-dashboard.ps1"

# Check if task already exists
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "Task '$taskName' already exists. Removing old task..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Create the action
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`" -ServerOnly"

# Create the trigger (at logon)
$trigger = New-ScheduledTaskTrigger -AtLogon

# Create the principal (current user)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest

# Create the settings
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

# Register the task
try {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Start Trading Dashboard server on user logon"
    Write-Host "Scheduled task '$taskName' created successfully!" -ForegroundColor Green
    Write-Host "Dashboard will start automatically when you log in." -ForegroundColor Cyan
} catch {
    Write-Host "Failed to create scheduled task: $_" -ForegroundColor Red
    Write-Host "You may need to run this script as Administrator." -ForegroundColor Yellow
}
