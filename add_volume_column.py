#!/usr/bin/env python3
"""Add volume_candle column to trading_prices table"""
import sys
sys.path.insert(0, r'D:\dev\trading-dashboard')
from db import get_conn

conn = get_conn()
cur = conn.cursor()

# Add column to trading_prices
try:
    cur.execute("ALTER TABLE trading_prices ADD COLUMN IF NOT EXISTS volume_candle NUMERIC(20,2)")
    print("Added volume_candle to trading_prices")
except Exception as e:
    print(f"Error: {e}")

# Add column to trading_prices_1h
try:
    cur.execute("ALTER TABLE trading_prices_1h ADD COLUMN IF NOT EXISTS volume_candle NUMERIC(20,2)")
    print("Added volume_candle to trading_prices_1h")
except Exception as e:
    print(f"Error: {e}")

# Add column to trading_prices_4h
try:
    cur.execute("ALTER TABLE trading_prices_4h ADD COLUMN IF NOT EXISTS volume_candle NUMERIC(20,2)")
    print("Added volume_candle to trading_prices_4h")
except Exception as e:
    print(f"Error: {e}")

conn.commit()
cur.close()
conn.close()
print("Done!")
