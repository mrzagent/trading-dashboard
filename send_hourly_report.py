#!/usr/bin/env python3
"""
send_hourly_report.py - Send trading report to Telegram
Alternative to PowerShell script to avoid Windows Defender false positives
"""

import os
import sys
import subprocess
import requests
from pathlib import Path

# Telegram config
TELEGRAM_TOKEN = "8603775714:AAE3h8fsTGI-FO8p5O8r5h9GxlcSYFChCgg"
CHAT_ID = "8305325794"
REPORT_FILE = Path("D:/dev/trading-dashboard/.latest_report.txt")

def generate_report():
    """Generate the trading report"""
    print("Generating trading report...")
    os.chdir("D:/dev/trading-dashboard")
    
    # Activate venv if it exists
    venv_python = Path(".venv/Scripts/python.exe")
    if venv_python.exists():
        python_cmd = str(venv_python)
    else:
        python_cmd = "python"
    
    result = subprocess.run(
        [python_cmd, "generate_trading_report.py"],
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        print(f"Error generating report: {result.stderr}")
        return False
    
    print(result.stdout)
    return True

def send_to_telegram():
    """Send report to Telegram"""
    print("Sending report to Telegram...")
    
    if not REPORT_FILE.exists():
        print(f"Error: Report file not found: {REPORT_FILE}")
        return False
    
    report_content = REPORT_FILE.read_text(encoding='utf-8')
    
    # Escape special characters for MarkdownV2 or use plain text
    # Telegram Markdown mode has issues with certain characters
    
    # Telegram has a 4096 character limit
    if len(report_content) > 4000:
        report_content = report_content[:4000] + "..."
    
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    payload = {
        "chat_id": CHAT_ID,
        "text": report_content
        # Removed parse_mode to avoid Markdown parsing errors
    }
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        response.raise_for_status()
        print("[OK] Report sent to Telegram successfully")
        return True
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] Failed to send report to Telegram: {e}")
        return False

def main():
    """Main entry point"""
    if not generate_report():
        sys.exit(1)
    
    if not send_to_telegram():
        sys.exit(1)

if __name__ == "__main__":
    main()
