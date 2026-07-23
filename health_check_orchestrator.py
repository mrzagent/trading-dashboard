#!/usr/bin/env python3
"""
health_check_orchestrator.py — Health check for orchestrator process

This script checks if the orchestrator is running properly and kills/restarts
if it's stuck. Can be run as a scheduled task every few minutes.
"""

import os
import sys
import subprocess
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Paths
ORCHESTRATOR_LOG = Path(__file__).parent / "logs" / "orchestrator.log"
CANDLE_GATE_FILE = Path(__file__).parent / ".candle_gate.json"
HEALTH_LOG = Path(__file__).parent / "logs" / "health_check.log"

# Thresholds
MAX_LOG_AGE_MINUTES = 10  # If no log activity for 10 min, consider stuck
MAX_PROCESS_AGE_MINUTES = 10  # If process running > 10 min, consider stuck

def log(msg, level="INFO"):
    """Log with timestamp."""
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    log_line = f"[{timestamp}] [{level}] {msg}"
    print(log_line)
    try:
        with open(HEALTH_LOG, 'a') as f:
            f.write(log_line + '\n')
    except:
        pass

def get_log_last_write():
    """Get last write time of orchestrator log."""
    try:
        if ORCHESTRATOR_LOG.exists():
            mtime = ORCHESTRATOR_LOG.stat().st_mtime
            return datetime.fromtimestamp(mtime, tz=timezone.utc)
    except Exception as e:
        log(f"Error checking log file: {e}", "ERROR")
    return None

def get_candle_gate_last_update():
    """Get last update time from candle gate."""
    try:
        if CANDLE_GATE_FILE.exists():
            mtime = CANDLE_GATE_FILE.stat().st_mtime
            return datetime.fromtimestamp(mtime, tz=timezone.utc)
    except Exception as e:
        log(f"Error checking candle gate: {e}", "ERROR")
    return None

def get_orchestrator_processes():
    """Find all orchestrator python processes."""
    processes = []
    try:
        import psutil
        for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'create_time']):
            try:
                cmdline = proc.info.get('cmdline', [])
                if cmdline and any('orchestrator' in str(arg).lower() for arg in cmdline):
                    if 'health_check' not in str(cmdline).lower():
                        processes.append({
                            'pid': proc.pid,
                            'cmdline': cmdline,
                            'create_time': datetime.fromtimestamp(proc.info['create_time'], tz=timezone.utc)
                        })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
    except ImportError:
        log("psutil not available, process checking limited", "WARN")
    return processes

def kill_process(pid):
    """Kill a process by PID."""
    try:
        import psutil
        proc = psutil.Process(pid)
        proc.kill()
        log(f"Killed process {pid}")
        return True
    except Exception as e:
        log(f"Failed to kill process {pid}: {e}", "ERROR")
        return False

def run_orchestrator_now():
    """Trigger orchestrator run immediately."""
    try:
        result = subprocess.run(
            [sys.executable, str(Path(__file__).parent / "orchestrator_safe.py")],
            capture_output=True,
            text=True,
            timeout=180
        )
        if result.returncode == 0:
            log("Orchestrator ran successfully")
            return True
        else:
            log(f"Orchestrator failed: {result.stderr[:200]}", "ERROR")
            return False
    except Exception as e:
        log(f"Failed to run orchestrator: {e}", "ERROR")
        return False

def main():
    """Main health check."""
    now = datetime.now(timezone.utc)
    log("Starting health check...")
    
    issues = []
    
    # Check 1: Log file activity
    log_last_write = get_log_last_write()
    if log_last_write:
        age_minutes = (now - log_last_write).total_seconds() / 60
        if age_minutes > MAX_LOG_AGE_MINUTES:
            issues.append(f"Log file stale ({age_minutes:.1f} min old)")
    else:
        issues.append("Log file not found")
    
    # Check 2: Candle gate activity
    candle_last_update = get_candle_gate_last_update()
    if candle_last_update:
        age_minutes = (now - candle_last_update).total_seconds() / 60
        if age_minutes > MAX_LOG_AGE_MINUTES:
            issues.append(f"Candle gate stale ({age_minutes:.1f} min old)")
    else:
        issues.append("Candle gate file not found")
    
    # Check 3: Long-running processes
    processes = get_orchestrator_processes()
    stale_processes = []
    for proc in processes:
        age_minutes = (now - proc['create_time']).total_seconds() / 60
        if age_minutes > MAX_PROCESS_AGE_MINUTES:
            stale_processes.append(proc)
            issues.append(f"Stale process {proc['pid']} running {age_minutes:.1f} min")
    
    if not issues:
        log("All health checks passed")
        return 0
    
    # Log issues
    log(f"Found {len(issues)} issue(s):", "WARN")
    for issue in issues:
        log(f"  - {issue}", "WARN")
    
    # Kill stale processes
    killed = 0
    for proc in stale_processes:
        if kill_process(proc['pid']):
            killed += 1
    
    if killed > 0:
        log(f"Killed {killed} stale process(es)")
    
    # Trigger fresh run
    log("Triggering fresh orchestrator run...")
    if run_orchestrator_now():
        log("Recovery successful")
        return 0
    else:
        log("Recovery failed", "ERROR")
        return 1

if __name__ == "__main__":
    sys.exit(main())
