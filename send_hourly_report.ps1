# send_hourly_report.ps1
$ErrorActionPreference = "Stop"

Write-Host "Generating and sending trading report..."
Set-Location D:\dev\trading-dashboard
if (Test-Path ".venv\Scripts\Activate.ps1") { . .venv\Scripts\Activate.ps1 }

# Use Python script instead of PowerShell for Telegram API
python send_hourly_report.py

Write-Host "Done."
