#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Health check for trading data collectors
.DESCRIPTION
    Checks if price data is being collected properly and reports status
#>

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$logFile = "$scriptDir\logs\health_check.log"

function Write-Log($message, $level = "INFO") {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "$timestamp [$level] $message"
    Write-Host $logEntry
    $logEntry | Out-File -FilePath $logFile -Append
}

# Ensure log directory exists
$logDir = Split-Path -Parent $logFile
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

Write-Log "=== Collector Health Check ==="

# Check scheduled tasks
$tasks = @("TradingCollect5min", "TradingCollect1h", "TradingCollect4h", "TradingOrchestrator")
foreach ($taskName in $tasks) {
    $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($task) {
        $state = $task.State
        $lastRun = $task.LastRunTime
        $nextRun = $task.NextRunTime
        Write-Log "Task $taskName`: State=$state, LastRun=$lastRun, NextRun=$nextRun"
    } else {
        Write-Log "Task $taskName`: NOT FOUND" "WARN"
    }
}

# Check database connectivity and data freshness
try {
    $env:PGPASSWORD = "1870506303979"
    
    # Check 5min data
    $result5min = & "C:\Program Files\PostgreSQL\18\bin\psql" -U postgres -t -c "SELECT coin, MAX(captured_at) FROM trading_prices GROUP BY coin ORDER BY coin;" 2>&1
    Write-Log "5min data latest timestamps:"
    $result5min | ForEach-Object { Write-Log "  $_" }
    
    # Check 1h data
    $result1h = & "C:\Program Files\PostgreSQL\18\bin\psql" -U postgres -t -c "SELECT coin, MAX(captured_at) FROM trading_prices_1h GROUP BY coin ORDER BY coin;" 2>&1
    Write-Log "1h data latest timestamps:"
    $result1h | ForEach-Object { Write-Log "  $_" }
    
    # Check 4h data
    $result4h = & "C:\Program Files\PostgreSQL\18\bin\psql" -U postgres -t -c "SELECT coin, MAX(captured_at) FROM trading_prices_4h GROUP BY coin ORDER BY coin;" 2>&1
    Write-Log "4h data latest timestamps:"
    $result4h | ForEach-Object { Write-Log "  $_" }
    
} catch {
    Write-Log "Database check failed: $_" "ERROR"
}

# Check log files for recent activity
$logFiles = @("collector_5min.log", "collector_1h.log", "collector_4h.log")
foreach ($log in $logFiles) {
    $logPath = "$scriptDir\logs\$log"
    if (Test-Path $logPath) {
        $lastWrite = (Get-Item $logPath).LastWriteTime
        $size = (Get-Item $logPath).Length
        $age = [math]::Round(((Get-Date) - $lastWrite).TotalMinutes, 1)
        Write-Log "$log`: LastWrite=${age}min ago, Size=${size}bytes"
        
        # Show last 2 lines
        $lastLines = Get-Content $logPath -Tail 2 -ErrorAction SilentlyContinue
        if ($lastLines) {
            $lastLines | ForEach-Object { Write-Log "  > $_" }
        }
    } else {
        Write-Log "$log`: NOT FOUND" "WARN"
    }
}

Write-Log "=== Health Check Complete ==="
