#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Update Windows Scheduled Tasks to use new trading-dashboard path
.DESCRIPTION
    Updates all Trading* scheduled tasks to point to D:\dev\trading-dashboard instead of D:\dev\trading
#>

$ErrorActionPreference = "Stop"

Write-Host "Updating Scheduled Tasks for trading-dashboard..." -ForegroundColor Cyan

$tasks = @(
    "TradingOrchestrator",
    "TradingCollect5min",
    "TradingCollect1h", 
    "TradingCollect4h",
    "TradingFVGDetect",
    "TradingPriceCheck",
    "TradingReportHourly"
)

foreach ($taskName in $tasks) {
    try {
        $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        if ($task) {
            $action = $task.Actions[0]
            $oldExecute = $action.Execute
            $oldArgs = $action.Arguments
            
            Write-Host "Task: $taskName" -ForegroundColor Yellow
            Write-Host "  Old: $oldExecute $oldArgs" -ForegroundColor Gray
            
            # Update the action to use new path
            $newArgs = $oldArgs -replace "D:\\dev\\trading", "D:\\dev\\trading-dashboard"
            
            # Create new action
            $newAction = New-ScheduledTaskAction -Execute $oldExecute -Argument $newArgs
            
            # Update the task
            Set-ScheduledTask -TaskName $taskName -Action $newAction | Out-Null
            
            Write-Host "  New: $oldExecute $newArgs" -ForegroundColor Green
            Write-Host "  Updated!" -ForegroundColor Green
        } else {
            Write-Host "Task not found: $taskName" -ForegroundColor Red
        }
    } catch {
        Write-Host "Error updating $taskName : $_" -ForegroundColor Red
    }
    Write-Host ""
}

Write-Host "Scheduled task update complete!" -ForegroundColor Cyan
