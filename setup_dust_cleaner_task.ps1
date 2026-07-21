# Setup Dust Cleaner Scheduled Task
# Run this script as Administrator to create the scheduled task

$Action = New-ScheduledTaskAction -Execute "python.exe" -Argument "D:\dev\trading-dashboard\dust_cleaner.py --live"
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Days 365)
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$Principal = New-ScheduledTaskPrincipal -UserId "$env:USERNAME" -LogonType Interactive

Register-ScheduledTask -TaskName "TradingDustCleaner" -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Description "Clean dust positions (<$1) from trading wallets every hour" -Force

Write-Host "Scheduled task 'TradingDustCleaner' created successfully!"
Write-Host "The task will run every hour to close positions smaller than $1."
