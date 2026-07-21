#!/usr/bin/env pwsh
# Update TradingOrchestrator scheduled task to use PowerShell

$ErrorActionPreference = "Stop"

$taskName = "TradingOrchestrator"
$scriptPath = "D:\dev\trading-dashboard\run_orchestrator_scheduled.ps1"

# Check if task exists
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "Task '$taskName' exists. Updating..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Create the action
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""

# Create the trigger (every 5 minutes indefinitely)
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)

# Create the principal (current user with highest privileges)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest

# Create the settings
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -Hidden

# Register the task
try {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Trading Orchestrator - runs every 5 minutes"
    Write-Host "Scheduled task '$taskName' updated successfully!" -ForegroundColor Green
    Write-Host "Orchestrator will run every 5 minutes." -ForegroundColor Cyan
} catch {
    Write-Host "Failed to create scheduled task: $_" -ForegroundColor Red
    Write-Host "You may need to run this script as Administrator." -ForegroundColor Yellow
    exit 1
}

# Run the task once to test
Write-Host "`nTesting task..." -ForegroundColor Cyan
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 3

$task = Get-ScheduledTask -TaskName $taskName
Write-Host "Task state: $($task.State)" -ForegroundColor White
