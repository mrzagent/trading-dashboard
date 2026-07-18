#!/usr/bin/env python3
"""Check trading data collection status for BTC, ETH, SOL."""

import psycopg2
import psycopg2.extras
from datetime import datetime

conn = psycopg2.connect(
    host='localhost', port=5432, database='postgres',
    user='postgres', password='1870506303979'
)

print('='*60)
print('TRADING DATA COLLECTION REVIEW')
print('='*60)
print()

# Tables to check
tables = ['trading_prices', 'trading_prices_1h', 'trading_prices_4h']
coins = ['BTC', 'ETH', 'SOL']

for table in tables:
    print(f'--- {table} ---')
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    # Count per coin
    cur.execute(f'''
        SELECT coin, COUNT(*) as count, 
               MAX(captured_at) as latest,
               MIN(captured_at) as earliest
        FROM {table} 
        GROUP BY coin 
        ORDER BY coin
    ''')
    rows = cur.fetchall()
    for row in rows:
        coin = row['coin']
        count = row['count']
        latest = row['latest']
        print(f'  {coin}: {count} records | latest: {latest}')
    
    if not rows:
        print('  No data found')
    print()

conn.close()
print('='*60)
