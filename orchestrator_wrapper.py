#!/usr/bin/env python3
"""
orchestrator_wrapper.py — Robust wrapper that restarts orchestrator on failure

This wrapper ensures the orchestrator keeps running even if it crashes.
It catches exceptions, logs them, and restarts the orchestrator after a delay.
"""

import os
import sys
import time
import traceback
from datetime import datetime, timezone

# Add trading directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def log_message(msg, level="INFO"):
    """Log with timestamp to stderr."""
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] [{level}] {msg}", file=sys.stderr, flush=True)

def run_orchestrator_cycle():
    """Run one cycle of the orchestrator."""
    from orchestrator import main
    main()

def main():
    """Main loop - runs orchestrator continuously with crash recovery."""
    log_message("Orchestrator wrapper starting...")
    
    consecutive_failures = 0
    max_consecutive_failures = 5
    base_delay = 10  # seconds
    
    while True:
        try:
            log_message("Starting orchestrator cycle...")
            run_orchestrator_cycle()
            
            # Success - reset failure counter
            consecutive_failures = 0
            
            # Wait for next 4-minute candle boundary
            now = datetime.now(timezone.utc)
            minutes = now.minute
            seconds = now.second
            
            # Calculate time until next 4-minute mark
            next_boundary = ((minutes // 4) + 1) * 4
            if next_boundary >= 60:
                next_boundary = 0  # Will be next hour
            
            wait_seconds = ((next_boundary - minutes) % 60) * 60 - seconds
            if wait_seconds < 0:
                wait_seconds += 240  # Add 4 minutes
            
            # Add small buffer to ensure we're past the boundary
            wait_seconds += 5
            
            log_message(f"Cycle complete. Waiting {wait_seconds}s until next run...")
            time.sleep(wait_seconds)
            
        except SystemExit:
            # Normal exit (e.g., candle not closed yet)
            consecutive_failures = 0
            time.sleep(30)  # Short wait before retry
            
        except Exception as e:
            consecutive_failures += 1
            log_message(f"Orchestrator crashed: {e}", "ERROR")
            log_message(traceback.format_exc(), "ERROR")
            
            if consecutive_failures >= max_consecutive_failures:
                log_message(f"Too many consecutive failures ({consecutive_failures}). Exiting.", "FATAL")
                sys.exit(1)
            
            # Exponential backoff
            delay = base_delay * (2 ** (consecutive_failures - 1))
            delay = min(delay, 300)  # Max 5 minutes
            
            log_message(f"Restarting in {delay}s (failure {consecutive_failures}/{max_consecutive_failures})...")
            time.sleep(delay)

if __name__ == "__main__":
    main()
