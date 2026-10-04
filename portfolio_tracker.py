#!/usr/bin/env python3
"""
Portfolio Tracker - Track deployed capital and returns since July 10, 2026

This module tracks:
- Daily snapshots of deployed capital (margin used)
- Cumulative PnL since July 10
- Return % based on average deployed capital
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import json
from datetime import datetime, timezone
from db import get_conn

# July 10, 2026 00:00:00 UTC
JULY_10_2026 = datetime(2026, 7, 10, 0, 0, 0, tzinfo=timezone.utc)


def get_today_str():
    """Get today's date as string YYYY-MM-DD"""
    return datetime.now(timezone.utc).strftime('%Y-%m-%d')


def store_daily_snapshot(swing_margin, scalp_margin, swing_pnl, scalp_pnl):
    """Store daily snapshot of deployed capital and PnL"""
    conn = get_conn()
    cur = conn.cursor()
    
    today = get_today_str()
    total_margin = swing_margin + scalp_margin
    total_pnl = swing_pnl + scalp_pnl
    
    # Check if entry exists for today
    cur.execute("""
        SELECT id FROM portfolio_snapshots 
        WHERE snapshot_date = %s
    """, (today,))
    
    existing = cur.fetchone()
    
    if existing:
        # Update existing entry
        cur.execute("""
            UPDATE portfolio_snapshots 
            SET swing_margin = %s,
                scalp_margin = %s,
                total_margin = %s,
                swing_pnl = %s,
                scalp_pnl = %s,
                total_pnl = %s,
                updated_at = NOW()
            WHERE snapshot_date = %s
        """, (swing_margin, scalp_margin, total_margin, 
              swing_pnl, scalp_pnl, total_pnl, today))
    else:
        # Insert new entry
        cur.execute("""
            INSERT INTO portfolio_snapshots 
                (snapshot_date, swing_margin, scalp_margin, total_margin,
                 swing_pnl, scalp_pnl, total_pnl)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (today, swing_margin, scalp_margin, total_margin,
              swing_pnl, scalp_pnl, total_pnl))
    
    conn.commit()
    conn.close()


def get_portfolio_stats_since_july_10():
    """Get portfolio stats since July 10, 2026"""
    conn = get_conn()
    cur = conn.cursor()
    
    # Get all snapshots since July 10
    cur.execute("""
        SELECT 
            snapshot_date,
            swing_margin,
            scalp_margin,
            total_margin,
            swing_pnl,
            scalp_pnl,
            total_pnl
        FROM portfolio_snapshots
        WHERE snapshot_date >= '2026-07-10'
        ORDER BY snapshot_date ASC
    """)
    
    rows = cur.fetchall()
    conn.close()
    
    if not rows:
        return {
            'days_tracked': 0,
            'avg_swing_margin': 0,
            'avg_scalp_margin': 0,
            'avg_total_margin': 0,
            'total_pnl': 0,
            'return_pct': 0,
            'snapshots': []
        }
    
    # Calculate averages
    total_swing_margin = sum(r[1] for r in rows)
    total_scalp_margin = sum(r[2] for r in rows)
    total_margin_sum = sum(r[3] for r in rows)
    days = len(rows)
    
    # Get latest PnL (cumulative since July 10)
    latest_pnl = rows[-1][6]  # total_pnl from latest row
    
    # Calculate return % based on average deployed capital
    avg_total_margin = total_margin_sum / days if days > 0 else 0
    return_pct = (latest_pnl / avg_total_margin * 100) if avg_total_margin > 0 else 0
    
    return {
        'days_tracked': days,
        'avg_swing_margin': round(float(total_swing_margin) / days, 2) if days > 0 else 0,
        'avg_scalp_margin': round(float(total_scalp_margin) / days, 2) if days > 0 else 0,
        'avg_total_margin': round(float(avg_total_margin), 2),
        'total_pnl': round(float(latest_pnl), 2),
        'return_pct': round(float(return_pct), 2),
        'snapshots': [
            {
                'date': str(r[0]),
                'swing_margin': float(r[1]),
                'scalp_margin': float(r[2]),
                'total_margin': float(r[3]),
                'swing_pnl': float(r[4]),
                'scalp_pnl': float(r[5]),
                'total_pnl': float(r[6])
            }
            for r in rows
        ]
    }


def update_today_snapshot(swing_info, scalp_info):
    """Update today's snapshot with current data"""
    swing_margin = swing_info.get('totalMargin', 0)
    scalp_margin = scalp_info.get('totalMargin', 0)
    swing_pnl = swing_info.get('pnlSinceJuly10', 0) or 0
    scalp_pnl = scalp_info.get('pnlSinceJuly10', 0) or 0
    
    store_daily_snapshot(swing_margin, scalp_margin, swing_pnl, scalp_pnl)


if __name__ == "__main__":
    # Test
    stats = get_portfolio_stats_since_july_10()
    print(json.dumps(stats, indent=2))
