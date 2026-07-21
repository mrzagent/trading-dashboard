# Trading 4h Data Collection - HyperLiquid
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$logFile = "$scriptDir\logs\collector_4h.log"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# Ensure log directory exists
$logDir = Split-Path -Parent $logFile
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

function Write-Log($message, $level = "INFO") {
    $logEntry = "$timestamp [$level] $message"
    Write-Host $logEntry
    $logEntry | Out-File -FilePath $logFile -Append
}

try {
    Set-Location $scriptDir
    Write-Log "Starting 4h candle collection..."
    
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "python"
    $psi.Arguments = "candle_collector.py --timeframe 4h --quiet"
    $psi.WorkingDirectory = $scriptDir
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    
    $process = [System.Diagnostics.Process]::Start($psi)
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    
    if ($stdout) {
        Write-Log "Output: $stdout"
    }
    if ($stderr) {
        Write-Log "Stderr: $stderr" "WARN"
    }
    
    if ($process.ExitCode -eq 0) {
        Write-Log "Collection completed successfully"
    } else {
        Write-Log "Collection failed with exit code $($process.ExitCode)" "ERROR"
    }
} catch {
    Write-Log "ERROR: $_" "ERROR"
}
