#!/usr/bin/env python3
"""Backfill volume_candle from raw_data JSON"""
import sys
sys.path.insert(0, r'D:\dev\trading-dashboard')
from db import get_conn
import json

conn = get_conn()
cur = conn.cursor()

# Try to extract volume_candle from raw_data for existing rows
tables = ['trading_prices', 'trading_prices_1h', 'trading_prices_4h']

for table in tables:
    print(f"\nProcessing {table}...")
    
    # Get rows where volume_candle is null but raw_data might have it
    cur.execute(f"""
        SELECT id, raw_data 
        FROM {table} 
        WHERE volume_candle IS NULL 
        AND raw_data IS NOT NULL
        ORDER BY captured_at DESC
        LIMIT 1000
    """)
    
    rows = cur.fetchall()
    updated = 0
    
    for row_id, raw_data in rows:
        try:
            data = json.loads(raw_data) if isinstance(raw_data, str) else raw_data
            if data and 'volume_candle' in data and data['volume_candle']:
                vol = float(data['volume_candle'])
                cur.execute(f"""
                    UPDATE {table} 
                    SET volume_candle = %s 
                    WHERE id = %s
                """, (vol, row_id))
                updated += 1
        except Exception as e:
            pass
    
    conn.commit()
    print(f"  Updated {updated} rows")

cur.close()
conn.close()
print("\nDone!")
