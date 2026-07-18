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
import json


def load_local_trade_metadata(wallet_type: str = 'swing'):
    """Load additional metadata from local trade_state.json for a specific wallet type."""
    # Each wallet type has its own state file
    state_file = f'trade_state_{wallet_type}.json'
    try:
        if os.path.exists(state_file):
            with open(state_file, 'r') as f:
                state = json.load(f)
            return state.get('open_trades', {})
    except Exception as e:
        print(f"Warning: Could not load trade state for {wallet_type}: {e}", file=sys.stderr)
    return {}


def format_time(iso_time):
    """Format ISO timestamp to HH:MM:SS"""
    if not iso_time:
        return None
    try:
        # Handle both with and without timezone
        dt = datetime.fromisoformat(iso_time.replace('Z', '+00:00'))
        return dt.strftime('%H:%M:%S')
    except:
        return iso_time[:8] if len(str(iso_time)) > 8 else iso_time


def fetch_positions_for_wallet(creds: dict, wallet_type: str) -> list:
    """Fetch positions from a specific wallet.
    
    Args:
        creds: Wallet credentials dict with 'wallet', 'api_url'
        wallet_type: 'swing' or 'scalp'
    
    Returns:
        List of position dicts with wallet_type field
    """
    positions = []
    wallet_address = creds['wallet']
    api_url = creds['api_url']
    
    try:
        # Load local metadata for this wallet type
        local_trades = load_local_trade_metadata(wallet_type)
        
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
            
            # Get local trade metadata if available
            local_trade = local_trades.get(coin, {})
            
            # Calculate SL/TP distances
            sl_distance = abs(entry - local_trade.get('stop_loss', sl)) / entry * 100 if entry > 0 else 0
            tp_prices = local_trade.get('take_profits', [])
            tp_price = tp_prices[0].get('price', tp) if tp_prices else tp
            tp_distance = abs(tp_price - entry) / entry * 100 if entry > 0 and tp_price > 0 else 0
            
            # Build position object with merged data
            position = {
                'id': f'{coin}_{wallet_type.upper()}',
                'coin': coin,
                'side': 'LONG' if size > 0 else 'SHORT',
                'size': abs(size),
                'entryPrice': entry,
                'markPrice': mark,
                'stopLoss': local_trade.get('stop_loss', sl),
                'stopLossDistance': round(sl_distance, 2),
                'takeProfit': tp_price,
                'takeProfitDistance': round(tp_distance, 2),
                'unrealizedPnl': pnl,
                'leverage': round(leverage, 1) if leverage > 0 else 0,
                'openedAt': p.get('openedAt', None),
                # Local metadata
                'signalTime': format_time(local_trade.get('signal_time')),
                'orderPlacedTime': format_time(local_trade.get('order_placed_time')),
                'entryTime': format_time(local_trade.get('entry_time')),
                'orderId': local_trade.get('order_id'),
                'slOrderId': local_trade.get('sl_order_id'),
                'tpOrderIds': local_trade.get('tp_order_ids', []),
                'marginRequired': local_trade.get('margin_required'),
                'riskAmount': local_trade.get('risk_amount'),
                'strategy': local_trade.get('strategy'),
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
