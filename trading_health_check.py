#!/usr/bin/env python3
"""
Trading System Health Check - Comprehensive
Checks both signal generation AND trade execution health
"""
from db import get_conn
import psycopg2.extras
from datetime import datetime, timezone, timedelta
import sys

conn = get_conn()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print("=" * 70)
print("TRADING SYSTEM HEALTH CHECK")
print("=" * 70)

healthy = True
warnings = []
errors = []

# 1. Check signal generation
print("\n[SIGNAL GENERATION]")
print("-" * 40)

cur.execute("""
    SELECT MAX(generated_at) as latest, COUNT(*) as count_1h
    FROM trading_signals
    WHERE generated_at > NOW() - INTERVAL '1 hour'
""")
result = cur.fetchone()
signals_1h = result["count_1h"]
latest_signal = result["latest"]

print(f"Signals in last hour: {signals_1h}")
if latest_signal:
    age_minutes = (datetime.now(timezone.utc) - latest_signal).total_seconds() / 60
    print(f"Latest signal: {latest_signal} ({age_minutes:.1f} min ago)")
    
    if age_minutes > 10:
        errors.append(f"Signals are stale ({age_minutes:.1f} min old)")
        healthy = False
        print("   ERROR: Signals are stale!")
    else:
        print("   OK: Signals are current")
else:
    errors.append("No signals in last hour")
    healthy = False
    print("   ERROR: No signals generated!")

# 2. Check trade execution
print("\n[TRADE EXECUTION]")
print("-" * 40)

cur.execute("""
    SELECT 
        MAX(created_at) as latest_execution,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as count_1h,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours' AND status = 'success') as success_24h,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours' AND status = 'failed') as failed_24h,
        COUNT(*) FILTER (WHERE status = 'pending' AND created_at < NOW() - INTERVAL '10 minutes') as stale_pending
    FROM trade_executions
""")
result = cur.fetchone()

executions_1h = result["count_1h"]
success_24h = result["success_24h"]
failed_24h = result["failed_24h"]
stale_pending = result["stale_pending"]
latest_execution = result["latest_execution"]

print(f"Executions in last hour: {executions_1h}")
print(f"Successful trades (24h): {success_24h}")
print(f"Failed trades (24h): {failed_24h}")
print(f"Stale pending (>10min): {stale_pending}")

if latest_execution:
    age_minutes = (datetime.now(timezone.utc) - latest_execution).total_seconds() / 60
    print(f"Latest execution: {latest_execution} ({age_minutes:.1f} min ago)")
    
    if age_minutes > 60:
        errors.append(f"No trade execution for {age_minutes:.1f} minutes")
        healthy = False
        print("   ERROR: No trade execution for over an hour!")
    elif age_minutes > 10:
        warnings.append(f"Last execution was {age_minutes:.1f} min ago")
        print(f"   WARNING: Last execution was {age_minutes:.1f} min ago")
    else:
        print("   OK: Recent execution activity")
else:
    errors.append("No trade executions found")
    healthy = False
    print("   ERROR: No trade executions!")

if stale_pending > 0:
    errors.append(f"{stale_pending} stale pending executions")
    healthy = False
    print(f"   ERROR: {stale_pending} stale pending executions!")

# 3. Check for execution gaps
print("\n[EXECUTION GAPS]")
print("-" * 40)

cur.execute("""
    SELECT created_at, status, coin, strategy
    FROM trade_executions
    WHERE status IN ('success', 'pending')
    ORDER BY created_at DESC
    LIMIT 5
""")
recent = cur.fetchall()

if recent:
    print("Recent successful/pending executions:")
    for row in recent:
        age = (datetime.now(timezone.utc) - row["created_at"]).total_seconds() / 60
        print(f"   {row['created_at']}: {row['coin']} {row['strategy']} ({row['status']}) - {age:.1f} min ago")

# Check for gap between signals and executions
# Find signals that should have been executed but weren't
cur.execute("""
    SELECT s.coin, s.strategy, s.action, s.confidence, s.generated_at
    FROM trading_signals s
    LEFT JOIN trade_executions e ON s.id = e.signal_id
    WHERE s.action IN ('BUY', 'SELL')
      AND s.confidence >= 0.5
      AND s.generated_at > NOW() - INTERVAL '2 hours'
      AND (e.id IS NULL OR e.status = 'failed')
    ORDER BY s.generated_at DESC
    LIMIT 5
""")
missed = cur.fetchall()

if missed:
    print(f"\n   WARNING: Recent signals without execution:")
    for row in missed:
        age = (datetime.now(timezone.utc) - row["generated_at"]).total_seconds() / 60
        print(f"      {row['generated_at']}: {row['coin']} {row['strategy']} {row['action']} ({row['confidence']:.0%}) - {age:.1f} min ago")
    warnings.append(f"{len(missed)} recent signals not executed")

# 4. Overall status
print("\n" + "=" * 70)
print("OVERALL STATUS")
print("=" * 70)

if healthy and not warnings:
    print("HEALTHY: Trading system is operating normally")
    sys.exit(0)
elif healthy and warnings:
    print("WARNING: Trading system has issues")
    for w in warnings:
        print(f"   - {w}")
    sys.exit(1)
else:
    print("ERROR: Trading system has critical issues")
    for e in errors:
        print(f"   - {e}")
    for w in warnings:
        print(f"   - {w}")
    sys.exit(2)

cur.close()
conn.close()
