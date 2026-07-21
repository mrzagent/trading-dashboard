#!/usr/bin/env pwsh
# Run orchestrator manually to test signal generation

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$logFile = "$scriptDir\logs\orchestrator_manual.log"

# Ensure log directory exists
$logDir = Split-Path -Parent $logFile
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"$timestamp - Starting manual orchestrator run..." | Out-File -FilePath $logFile -Append

Set-Location $scriptDir

try {
    $output = python orchestrator.py 2>&1
    "$timestamp - Output:" | Out-File -FilePath $logFile -Append
    $output | Out-File -FilePath $logFile -Append
    Write-Host $output
} catch {
    "$timestamp - ERROR: $_" | Out-File -FilePath $logFile -Append
    Write-Host "ERROR: $_" -ForegroundColor Red
}

"$timestamp - Orchestrator run complete" | Out-File -FilePath $logFile -Append
