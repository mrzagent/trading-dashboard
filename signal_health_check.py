#!/usr/bin/env python3
"""Check signal generation health"""
from db import get_conn
import psycopg2.extras
from datetime import datetime, timezone

conn = get_conn()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print("=" * 60)
print("SIGNAL GENERATION HEALTH CHECK")
print("=" * 60)

# Check trading_signals (the main signal table)
cur.execute('SELECT COUNT(*) as total FROM trading_signals')
result = cur.fetchone()
total_signals = result["total"]
print(f"\nTotal signals in trading_signals: {total_signals:,}")

# Check signals in last 24 hours
cur.execute("""
    SELECT COUNT(*) as count 
    FROM trading_signals 
    WHERE created_at > NOW() - INTERVAL '24 hours'
""")
result = cur.fetchone()
signals_24h = result["count"]
print(f"Signals in last 24h: {signals_24h}")

# Check signals in last hour
cur.execute("""
    SELECT COUNT(*) as count 
    FROM trading_signals 
    WHERE created_at > NOW() - INTERVAL '1 hour'
""")
result = cur.fetchone()
signals_1h = result["count"]
print(f"Signals in last 1h: {signals_1h}")

# Latest signal timestamp
cur.execute('SELECT MAX(created_at) as latest FROM trading_signals')
result = cur.fetchone()
latest_signal = result["latest"]
if latest_signal:
    age_minutes = (datetime.now(timezone.utc) - latest_signal).total_seconds() / 60
    print(f"\nLatest signal: {latest_signal}")
    print(f"   Age: {age_minutes:.1f} minutes ago")
    if age_minutes < 10:
        print("   [OK] Signals are current")
    elif age_minutes < 60:
        print("   [WARN] Signals are somewhat stale")
    else:
        print("   [ERROR] Signals are very stale!")

# Signals by strategy (last 24h)
cur.execute("""
    SELECT strategy, COUNT(*) as count 
    FROM trading_signals 
    WHERE created_at > NOW() - INTERVAL '24 hours'
    GROUP BY strategy 
    ORDER BY count DESC
""")
rows = cur.fetchall()
print(f"\nSignals by strategy (last 24h):")
for row in rows:
    print(f"   {row['strategy']}: {row['count']}")

# Signals by coin (last 24h)
cur.execute("""
    SELECT coin, COUNT(*) as count 
    FROM trading_signals 
    WHERE created_at > NOW() - INTERVAL '24 hours'
    GROUP BY coin 
    ORDER BY count DESC
""")
rows = cur.fetchall()
print(f"\nSignals by coin (last 24h):")
for row in rows:
    print(f"   {row['coin']}: {row['count']}")

# Recent BUY/SELL signals
cur.execute("""
    SELECT strategy, coin, action, confidence, created_at 
    FROM trading_signals 
    WHERE action IN ('BUY', 'SELL') 
    ORDER BY created_at DESC 
    LIMIT 10
""")
rows = cur.fetchall()
print(f"\nRecent BUY/SELL signals:")
if rows:
    for row in rows:
        print(f"   {row['created_at']}: {row['strategy']} {row['coin']} {row['action']} ({row['confidence']})")
else:
    print("   No BUY/SELL signals found")

# Check trade_executions
cur.execute('SELECT COUNT(*) as total FROM trade_executions')
result = cur.fetchone()
print(f"\nTotal trade executions: {result['total']:,}")

cur.execute("""
    SELECT status, COUNT(*) as count 
    FROM trade_executions 
    GROUP BY status 
    ORDER BY count DESC
""")
rows = cur.fetchall()
print(f"   By status:")
for row in rows:
    print(f"      {row['status']}: {row['count']}")

cur.close()
conn.close()

print("\n" + "=" * 60)
