#!/usr/bin/env python3
"""Run database migration for wallet separation"""
import psycopg2
from config_loader import DB_CONFIG

conn = psycopg2.connect(**DB_CONFIG)
cur = conn.cursor()

# Read and execute migration
with open('migrate_wallet_separation.sql', 'r') as f:
    sql = f.read()
    cur.execute(sql)

conn.commit()
print('Migration completed successfully!')

# Verify
cur.execute('''
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name IN ('trading_signals', 'strategy_signals', 'trade_executions')
    AND column_name IN ('wallet_type', 'wallet_address')
    ORDER BY table_name, ordinal_position
''')
for row in cur.fetchall():
    print(f'{row[0]}.{row[1]}: {row[2]}')

conn.close()
