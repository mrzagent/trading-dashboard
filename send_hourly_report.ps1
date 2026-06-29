# send_hourly_report.ps1
$ErrorActionPreference = "Stop"

$telegramToken = "8603775714:AAE3h8fsTGI-FO8p5O8r5h9GxlcSYFChCgg"
$chatId = "8305325794"
$reportFile = "D:\dev\trading\.latest_report.txt"

Write-Host "Generating trading report..."
Set-Location D:\dev\trading
if (Test-Path ".venv\Scripts\Activate.ps1") { . .venv\Scripts\Activate.ps1 }
python generate_trading_report.py

# Send the report to Telegram
Write-Host "Sending report to Telegram..."
$reportContent = Get-Content $reportFile -Raw

# Telegram has a 4096 character limit for messages
$maxLength = 4000
if ($reportContent.Length -gt $maxLength) {
    $reportContent = $reportContent.Substring(0, $maxLength) + "..."
}

$uri = "https://api.telegram.org/bot$telegramToken/sendMessage"
$body = @{
    chat_id = $chatId
    text = $reportContent
    parse_mode = "Markdown"
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri $uri -Method Post -ContentType "application/json" -Body $body
    Write-Host "✅ Report sent to Telegram successfully"
} catch {
    Write-Host "❌ Failed to send report to Telegram: $_"
    exit 1
}
