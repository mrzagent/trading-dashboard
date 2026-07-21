#!/usr/bin/env pwsh
# Trading Orchestrator - Scheduled Task Runner
# Runs the orchestrator with proper error handling and logging

$ErrorActionPreference = "Stop"

$scriptDir = "D:\dev\trading-dashboard"
$logFile = "$scriptDir\logs\orchestrator.log"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# Ensure logs directory exists
$logDir = Split-Path -Parent $logFile
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

function Write-Log($message, $level = "INFO") {
    $logEntry = "$timestamp [$level] $message"
    Add-Content -Path $logFile -Value $logEntry
}

Write-Log "Starting orchestrator..."

try {
    Set-Location $scriptDir
    
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "python"
    $psi.Arguments = "orchestrator.py"
    $psi.WorkingDirectory = $scriptDir
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    
    $process = [System.Diagnostics.Process]::Start($psi)
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    
    if ($stdout) {
        Add-Content -Path $logFile -Value $stdout
    }
    if ($stderr) {
        Add-Content -Path $logFile -Value "ERROR: $stderr"
    }
    
    if ($process.ExitCode -eq 0) {
        Write-Log "Orchestrator completed successfully"
    } else {
        Write-Log "Orchestrator failed with exit code $($process.ExitCode)" "ERROR"
    }
} catch {
    Write-Log "Exception: $_" "ERROR"
    exit 1
}
