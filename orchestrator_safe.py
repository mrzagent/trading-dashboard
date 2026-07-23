#!/usr/bin/env python3
"""
orchestrator_safe.py — Safe wrapper for orchestrator with timeout protection

This script runs the orchestrator with a hard timeout to prevent hanging.
If the orchestrator doesn't complete within the timeout, it is killed.

Features:
- Kills stale orchestrator processes before starting
- 2-minute timeout protection
- Proper logging
- Exit code handling
"""

import os
import sys
import subprocess
import json
from datetime import datetime, timezone
from pathlib import Path

# Configuration
TIMEOUT_SECONDS = 120  # 2 minutes max for orchestrator to complete
ORCHESTRATOR_PATH = Path(__file__).parent / "orchestrator.py"
LOG_PATH = Path(__file__).parent / "logs" / "orchestrator_safe.log"

def log(msg, level="INFO"):
    """Log with timestamp."""
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    log_line = f"[{timestamp}] [{level}] {msg}"
    print(log_line, file=sys.stderr)
    try:
        LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(LOG_PATH, 'a') as f:
            f.write(log_line + '\n')
    except:
        pass

def kill_stale_orchestrators():
    """Kill any existing python processes running orchestrator.py."""
    killed = 0
    try:
        # Use tasklist and taskkill for Windows compatibility
        result = subprocess.run(
            ['tasklist', '/FI', 'IMAGENAME eq python.exe', '/FO', 'CSV', '/NH'],
            capture_output=True, text=True
        )
        for line in result.stdout.strip().split('\n'):
            if not line:
                continue
            parts = line.strip('"').split('","')
            if len(parts) >= 2:
                pid = parts[1]
                try:
                    # Check if this process is running orchestrator
                    check_result = subprocess.run(
                        ['wmic', 'process', 'where', f'ProcessId={pid}', 'get', 'CommandLine', '/format:list'],
                        capture_output=True, text=True
                    )
                    if 'orchestrator' in check_result.stdout.lower():
                        # Don't kill ourselves
                        if int(pid) != os.getpid():
                            log(f"Killing stale orchestrator process: {pid}")
                            subprocess.run(['taskkill', '/F', '/PID', pid], capture_output=True)
                            killed += 1
                except:
                    pass
    except Exception as e:
        log(f"Could not check for stale processes: {e}", "WARN")
    return killed

def run_with_timeout():
    """Run orchestrator with timeout protection."""
    start_time = datetime.now(timezone.utc)
    
    # First, kill any stale orchestrators
    killed = kill_stale_orchestrators()
    if killed > 0:
        log(f"Cleaned up {killed} stale process(es)")
    
    log(f"Starting orchestrator (timeout: {TIMEOUT_SECONDS}s)...")
    
    try:
        # Run orchestrator as subprocess with timeout
        result = subprocess.run(
            [sys.executable, str(ORCHESTRATOR_PATH)],
            capture_output=True,
            text=True,
            timeout=TIMEOUT_SECONDS
        )
        
        duration = (datetime.now(timezone.utc) - start_time).total_seconds()
        
        if result.returncode == 0:
            log(f"Orchestrator completed successfully in {duration:.1f}s")
            # Output the orchestrator's stdout
            print(result.stdout)
            return 0
        else:
            log(f"Orchestrator exited with code {result.returncode} after {duration:.1f}s", "WARN")
            # Orchestrator exits with code 1 normally when candle not closed
            # Still output the stdout for signal data
            if result.stdout:
                print(result.stdout)
            return result.returncode
            
    except subprocess.TimeoutExpired as e:
        duration = (datetime.now(timezone.utc) - start_time).total_seconds()
        log(f"Orchestrator timed out after {duration:.1f}s", "ERROR")
        # Try to output what we got
        if e.stdout:
            print(e.stdout)
        return 1
        
    except Exception as e:
        duration = (datetime.now(timezone.utc) - start_time).total_seconds()
        log(f"Orchestrator error after {duration:.1f}s: {e}", "ERROR")
        return 1

def main():
    """Main entry point."""
    try:
        exit_code = run_with_timeout()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        log("Interrupted by user", "WARN")
        sys.exit(130)

if __name__ == "__main__":
    main()
