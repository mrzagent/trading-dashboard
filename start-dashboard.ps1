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

Write-Header "Trading Dashboard"

# Check if we're in the right directory
if (-not (Test-Path "dashboard/server/index.js")) {
    Write-Error "Not in trading-dashboard directory. Please run from D:\dev\trading-dashboard"
    exit 1
}

# Kill any existing node processes on port 3001
$existing = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Port 3001 in use, stopping existing process..." -ForegroundColor Yellow
    Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
}

# Start Server
if (-not $ClientOnly) {
    Write-Header "Starting API Server (Port 3001)"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\dashboard\server'; node index.js" -WindowStyle Normal
    Write-Host "Server starting..." -ForegroundColor Green
    Start-Sleep -Seconds 3
}

# Start Client
if (-not $ServerOnly) {
    Write-Header "Starting React Client (Port 5173)"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\dashboard'; npm run dev" -WindowStyle Normal
    Write-Host "Client starting..." -ForegroundColor Green
}

Write-Host ""
Write-Host "Dashboard URLs:" -ForegroundColor Yellow
Write-Host "  API:    http://localhost:3001" -ForegroundColor White
Write-Host "  Client: http://localhost:5173" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C in each window to stop" -ForegroundColor Gray
