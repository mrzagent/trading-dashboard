# Trading 4h Data Collection - HyperLiquid
$ErrorActionPreference = "Stop"

$logFile = "D:\dev\trading\collector_4h.log"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

try {
    Set-Location "D:\dev\trading"
    $output = python candle_collector.py --timeframe 4h --quiet 2>&1
    if ($LASTEXITCODE -ne 0) {
        "$timestamp ERROR: Exit code $LASTEXITCODE - $output" | Out-File -FilePath $logFile -Append
    }
} catch {
    "$timestamp ERROR: $_" | Out-File -FilePath $logFile -Append
}
