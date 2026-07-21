#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Create a scheduled task to start trading dashboard on user logon and wake from sleep
.DESCRIPTION
    Creates Windows scheduled tasks that start the trading dashboard server when the user logs in
    and when the system wakes from sleep/hibernation
#>

$ErrorActionPreference = "Stop"

$taskName = "TradingDashboardStartup"
$scriptPath = "D:\dev\trading-dashboard\start-dashboard.ps1"

# Check if task already exists
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "Task '$taskName' already exists. Removing old task..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Remove wake task if exists
$wakeTaskName = "TradingDashboardWake"
$existingWakeTask = Get-ScheduledTask -TaskName $wakeTaskName -ErrorAction SilentlyContinue
if ($existingWakeTask) {
    Write-Host "Task '$wakeTaskName' already exists. Removing old task..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $wakeTaskName -Confirm:$false
}

# Create the action (start BOTH server and client)
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""

# Create the trigger (at logon)
$triggerLogon = New-ScheduledTaskTrigger -AtLogon

# Create the principal (current user)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest

# Create the settings
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

# Register the logon task
try {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $triggerLogon -Principal $principal -Settings $settings -Description "Start Trading Dashboard server on user logon"
    Write-Host "Scheduled task '$taskName' created successfully!" -ForegroundColor Green
} catch {
    Write-Host "Failed to create scheduled task: $_" -ForegroundColor Red
    Write-Host "You may need to run this script as Administrator." -ForegroundColor Yellow
    exit 1
}

# Create a separate task for wake from sleep using event trigger
# Event ID 1 from Power-Troubleshooter = System woke from sleep
$wakeTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 365)

# We need to use XML to properly set the event trigger for wake from sleep
$taskXml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Start Trading Dashboard when system wakes from sleep</Description>
  </RegistrationInfo>
  <Triggers>
    <EventTrigger>
      <Enabled>true</Enabled>
      <Subscription>&lt;QueryList&gt;&lt;Query Id="0" Path="System"&gt;&lt;Select Path="System"&gt;*[System[Provider[@Name='Microsoft-Windows-Power-Troubleshooter'] and EventID=1]]&lt;/Select&gt;&lt;/Query&gt;&lt;/QueryList&gt;</Subscription>
    </EventTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>$env:USERNAME</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>true</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <DisallowStartOnRemoteAppSession>false</DisallowStartOnRemoteAppSession>
    <UseUnifiedSchedulingEngine>true</UseUnifiedSchedulingEngine>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>powershell.exe</Command>
      <Arguments>-ExecutionPolicy Bypass -WindowStyle Hidden -File "$scriptPath"</Arguments>
    </Exec>
  </Actions>
</Task>
"@

# Save XML to temp file
$tempXml = [System.IO.Path]::GetTempFileName() + ".xml"
$taskXml | Out-File -FilePath $tempXml -Encoding Unicode

try {
    Register-ScheduledTask -TaskName $wakeTaskName -Xml (Get-Content $tempXml -Raw) -Force
    Write-Host "Scheduled task '$wakeTaskName' created successfully!" -ForegroundColor Green
} catch {
    Write-Host "Failed to create wake task: $_" -ForegroundColor Red
} finally {
    Remove-Item $tempXml -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Dashboard will start automatically:" -ForegroundColor Cyan
Write-Host "  - When you log in" -ForegroundColor White
Write-Host "  - When your PC wakes from sleep/hibernation" -ForegroundColor White
Write-Host ""
