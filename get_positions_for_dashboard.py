#!/usr/bin/env python3
"""Fetch positions from Hyperliquid for dashboard with local trade metadata.

With wallet separation, this fetches positions from BOTH swing and scalp wallets
and merges them for dashboard display.
"""
import sys
import os
import threading
import time
from datetime import datetime

# Add trading directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from hyperliquid.info import Info
from config_loader import get_swing_credentials, get_scalp_credentials, HYPERLIQUID_ENV
from db import get_conn
import psycopg2.extras
import json


def load_trade_metadata_from_db(coin: str, wallet_type: str = 'swing', entry_price: float = None):
    """Load trade metadata from database for a specific coin and wallet type.
    
    Matches by entry price (from signal meta) to find the trade that opened the current position.
    """
    try:
        conn = get_conn()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # First try to match by entry price from signal meta (most accurate)
        if entry_price and entry_price > 0:
            # Allow 0.5% price difference for matching
            price_tolerance = entry_price * 0.005
            cur.execute("""
                SELECT te.*, ts.strategy, ts.created_at as signal_time,
                       (ts.meta->>'price')::numeric as signal_price
                FROM trade_executions te
                LEFT JOIN trading_signals ts ON te.signal_id = ts.id
                WHERE te.coin = %s AND te.status = 'success'
                    AND ts.meta->>'price' IS NOT NULL
                    AND ABS((ts.meta->>'price')::numeric - %s) < %s
                ORDER BY te.created_at DESC
                LIMIT 1
            """, (coin, entry_price, price_tolerance))
            
            trade = cur.fetchone()
            if trade:
                cur.close()
                conn.close()
                return {
                    'strategy': trade.get('strategy'),
                    'signal_time': trade.get('signal_time').isoformat() if trade.get('signal_time') else None,
                    'order_placed_time': trade.get('hyperliquid_sent_at').isoformat() if trade.get('hyperliquid_sent_at') else None,
                    'entry_time': trade.get('created_at').isoformat() if trade.get('created_at') else None,
                    'order_id': str(trade.get('hyperliquid_order_id')) if trade.get('hyperliquid_order_id') else None,
                    'sl_order_id': None,
                    'tp_order_ids': [],
                }
        
        # Fallback: get the most recent successful trade for this coin
        cur.execute("""
            SELECT te.*, ts.strategy, ts.created_at as signal_time
            FROM trade_executions te
            LEFT JOIN trading_signals ts ON te.signal_id = ts.id
            WHERE te.coin = %s AND te.status = 'success'
            ORDER BY te.created_at DESC
            LIMIT 1
        """, (coin,))
        
        trade = cur.fetchone()
        cur.close()
        conn.close()
        
        if trade:
            return {
                'strategy': trade.get('strategy'),
                'signal_time': trade.get('signal_time').isoformat() if trade.get('signal_time') else None,
                'order_placed_time': trade.get('hyperliquid_sent_at').isoformat() if trade.get('hyperliquid_sent_at') else None,
                'entry_time': trade.get('created_at').isoformat() if trade.get('created_at') else None,
                'order_id': str(trade.get('hyperliquid_order_id')) if trade.get('hyperliquid_order_id') else None,
                'sl_order_id': None,
                'tp_order_ids': [],
            }
    except Exception as e:
        print(f"Warning: Could not load trade metadata from DB for {coin}: {e}", file=sys.stderr)
    return {}


def format_time(iso_time):
    """Format ISO timestamp to DD MMM HH:MM:SS"""
    if not iso_time:
        return None
    try:
        # Handle both with and without timezone
        dt = datetime.fromisoformat(iso_time.replace('Z', '+00:00'))
        return dt.strftime('%d %b %H:%M:%S')
    except:
        return iso_time[:8] if len(str(iso_time)) > 8 else iso_time


def fetch_positions_for_wallet(creds: dict, wallet_type: str) -> list:
    """Fetch positions from a specific wallet.
    
    Args:
        creds: Wallet credentials dict with 'wallet', 'api_url', 'main_wallet'
        wallet_type: 'swing' or 'scalp'
    
    Returns:
        List of position dicts with wallet_type field
    """
    positions = []
    # Use main_wallet for fetching positions (positions are held there)
    wallet_address = creds.get('main_wallet', creds['wallet'])
    api_url = creds['api_url']
    
    try:
        info = Info(base_url=api_url)
        state = info.user_state(wallet_address)
        
        for pos in state.get('assetPositions', []):
            p = pos.get('position', {})
            coin = p.get('coin', '')
            size = float(p.get('szi', 0))
            entry = float(p.get('entryPx', 0))
            position_value = float(p.get('positionValue', 0))
            # Calculate mark price from position value / size
            mark = position_value / abs(size) if size != 0 else entry
            pnl = float(p.get('unrealizedPnl', 0))
            sl = float(p.get('stopLoss', 0)) if p.get('stopLoss') else 0
            tp = float(p.get('takeProfit', 0)) if p.get('takeProfit') else 0
            
            # Leverage is stored in position['leverage'] as object {type, value}
            leverage_obj = p.get('leverage', {})
            if isinstance(leverage_obj, dict):
                leverage = float(leverage_obj.get('value', 0))
            else:
                leverage = float(leverage_obj) if leverage_obj else 0
            
            # Fallback: calculate from position value / margin used
            if leverage == 0:
                margin_used = float(p.get('marginUsed', 0))
                if margin_used > 0 and position_value > 0:
                    leverage = position_value / margin_used
            
            # Get trade metadata from database (match by entry price for accuracy)
            trade_meta = load_trade_metadata_from_db(coin, wallet_type, entry)
            
            # Calculate SL/TP distances
            sl_distance = abs(entry - sl) / entry * 100 if entry > 0 and sl > 0 else 0
            tp_distance = abs(tp - entry) / entry * 100 if entry > 0 and tp > 0 else 0
            
            # Build position object with merged data from DB
            position = {
                'id': f'{coin}_{wallet_type.upper()}',
                'coin': coin,
                'side': 'LONG' if size > 0 else 'SHORT',
                'size': abs(size),
                'entryPrice': entry,
                'markPrice': mark,
                'stopLoss': sl if sl > 0 else None,
                'stopLossDistance': round(sl_distance, 2) if sl > 0 else 0,
                'takeProfit': tp if tp > 0 else None,
                'takeProfitDistance': round(tp_distance, 2) if tp > 0 else 0,
                'unrealizedPnl': pnl,
                'leverage': round(leverage, 1) if leverage > 0 else 0,
                'openedAt': p.get('openedAt', None),
                # Metadata from database
                'signalTime': format_time(trade_meta.get('signal_time')),
                'orderPlacedTime': format_time(trade_meta.get('order_placed_time')),
                'entryTime': format_time(trade_meta.get('entry_time')),
                'orderId': trade_meta.get('order_id'),
                'slOrderId': trade_meta.get('sl_order_id'),
                'tpOrderIds': trade_meta.get('tp_order_ids', []),
                'strategy': trade_meta.get('strategy'),
                # Wallet separation metadata
                'walletType': wallet_type,
                'walletAddress': wallet_address[:10] + '...' + wallet_address[-6:] if len(wallet_address) > 16 else wallet_address,
            }
            
            positions.append(position)
            
    except Exception as e:
        print(f"Error fetching positions for {wallet_type} wallet: {e}", file=sys.stderr)
    
    return positions


def fetch_all_positions():
    """Fetch positions from both swing and scalp wallets."""
    all_positions = []
    errors = []
    
    try:
        # Get credentials for both wallets
        swing_creds = get_swing_credentials()
        scalp_creds = get_scalp_credentials()
        
        # Fetch from swing wallet
        swing_positions = fetch_positions_for_wallet(swing_creds, 'swing')
        all_positions.extend(swing_positions)
        
        # Fetch from scalp wallet
        scalp_positions = fetch_positions_for_wallet(scalp_creds, 'scalp')
        all_positions.extend(scalp_positions)
        
    except Exception as e:
        errors.append(str(e))
    
    return all_positions, errors


# Main execution
result = {'positions': [], 'errors': []}


def run_fetch():
    positions, errors = fetch_all_positions()
    result['positions'] = positions
    result['errors'] = errors


# Run fetch in a thread with timeout
thread = threading.Thread(target=run_fetch)
thread.daemon = True
thread.start()
thread.join(timeout=10)  # 10 second timeout for both wallets

if thread.is_alive():
    # Timeout - return empty
    print(json.dumps([]))
else:
    if result['errors']:
        print(f"Errors: {result['errors']}", file=sys.stderr)
    print(json.dumps(result['positions']))

sys.stdout.flush()
