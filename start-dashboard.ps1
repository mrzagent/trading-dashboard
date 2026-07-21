#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Start the Trading Dashboard
.DESCRIPTION
    Starts both the API server and the React client
#>

param(
    [switch]$ServerOnly,
    [switch]$ClientOnly
)

$ErrorActionPreference = "Stop"

function Write-Header($text) {
    Write-Host ""
    Write-Host "=" * 60 -ForegroundColor Cyan
    Write-Host $text -ForegroundColor Cyan
    Write-Host "=" * 60 -ForegroundColor Cyan
    Write-Host ""
}

# Log file for debugging startup issues
$logDir = "$PSScriptRoot\logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}
$logFile = "$logDir\dashboard_startup.log"

function Log-Message($message) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp - $message" | Out-File -FilePath $logFile -Append
    Write-Host $message
}

Log-Message "Starting Trading Dashboard..."
Log-Message "ServerOnly: $ServerOnly, ClientOnly: $ClientOnly"

# Check if we're in the right directory
if (-not (Test-Path "$PSScriptRoot\dashboard\server\index.js")) {
    Log-Message "ERROR: Not in trading-dashboard directory. Expected dashboard/server/index.js"
    exit 1
}

# Function to check if a port is in use
function Test-PortInUse($port) {
    $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    return $connection -ne $null
}

# Function to kill process on a port
function Stop-ProcessOnPort($port) {
    $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connection) {
        try {
            $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
            if ($process) {
                Log-Message "Stopping process $($process.ProcessName) (PID: $($process.Id)) on port $port"
                $process | Stop-Process -Force
                Start-Sleep -Seconds 2
            }
        } catch {
            Log-Message "Warning: Could not stop process on port $port : $_"
        }
    }
}

# Start Server
if (-not $ClientOnly) {
    if (Test-PortInUse 3001) {
        Log-Message "Port 3001 already in use, stopping existing process..."
        Stop-ProcessOnPort 3001
    }
    
    Write-Header "Starting API Server (Port 3001)"
    $serverLog = "$logDir\server.log"
    
    # Start server in a hidden/minimized window
    $serverProcess = Start-Process powershell -ArgumentList "-Command", "cd '$PSScriptRoot\dashboard\server'; node index.js 2>&1 | Tee-Object -FilePath '$serverLog'" -WindowStyle Minimized -PassThru
    Log-Message "Server started (PID: $($serverProcess.Id))"
    
    # Wait for server to be ready
    $maxWait = 30
    $waited = 0
    while (-not (Test-PortInUse 3001) -and $waited -lt $maxWait) {
        Start-Sleep -Seconds 1
        $waited++
    }
    
    if (Test-PortInUse 3001) {
        Log-Message "Server is ready on port 3001"
    } else {
        Log-Message "WARNING: Server may not have started properly"
    }
}

# Start Client
if (-not $ServerOnly) {
    if (Test-PortInUse 5173) {
        Log-Message "Port 5173 already in use, stopping existing process..."
        Stop-ProcessOnPort 5173
    }
    
    Write-Header "Starting React Client (Port 5173)"
    $clientLog = "$logDir\client.log"
    
    # Start client in a hidden/minimized window
    $clientProcess = Start-Process powershell -ArgumentList "-Command", "cd '$PSScriptRoot\dashboard'; npm run dev 2>&1 | Tee-Object -FilePath '$clientLog'" -WindowStyle Minimized -PassThru
    Log-Message "Client started (PID: $($clientProcess.Id))"
    
    # Wait for client to be ready
    $maxWait = 30
    $waited = 0
    while (-not (Test-PortInUse 5173) -and $waited -lt $maxWait) {
        Start-Sleep -Seconds 1
        $waited++
    }
    
    if (Test-PortInUse 5173) {
        Log-Message "Client is ready on port 5173"
    } else {
        Log-Message "WARNING: Client may not have started properly"
    }
}

Write-Host ""
Write-Host "Dashboard URLs:" -ForegroundColor Yellow
Write-Host "  API:    http://localhost:3001" -ForegroundColor White
Write-Host "  Client: http://localhost:5173" -ForegroundColor White
Write-Host ""
Write-Host "Logs: $logDir" -ForegroundColor Gray
Write-Host ""

Log-Message "Dashboard startup complete"
