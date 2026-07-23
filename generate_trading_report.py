#!/usr/bin/env python3
"""
generate_trading_report.py — Generate trading report for Telegram
"""
import sys
import os
import json
import requests
from datetime import datetime, timedelta

sys.path.insert(0, r'D:\dev\trading-dashboard')
os.chdir(r'D:\dev\trading-dashboard')

REPORT_FILE = r'D:\dev\trading-dashboard\.latest_report.txt'
COINS = ['BTC', 'ETH', 'SOL']

# Load settings directly to avoid import issues
SETTINGS_PATH = r'D:\dev\trading-dashboard\risk_config.json'

def load_settings():
    """Load settings from risk_config.json"""
    with open(SETTINGS_PATH, 'r') as f:
        return json.load(f)

def get_latest_prices():
    """Get latest prices from database"""
    from db import get_conn
    conn = get_conn()
    cur = conn.cursor()
    
    prices = {}
    for coin in COINS:
        cur.execute("""
            SELECT price FROM trading_prices 
            WHERE coin = %s 
            ORDER BY captured_at DESC 
            LIMIT 1
        """, (coin,))
        row = cur.fetchone()
        prices[coin] = row[0] if row else 0
    
    conn.close()
    return prices

def get_latest_signals():
    """Get latest signals from database - best signal per coin"""
    from db import get_conn
    conn = get_conn()
    cur = conn.cursor()
    
    signals = {}
    since = datetime.now() - timedelta(minutes=60)
    
    for coin in COINS:
        # Get the best signal (highest confidence) from last hour
        cur.execute("""
            SELECT action, confidence, strategy
            FROM trading_signals
            WHERE coin = %s AND strategy != 'quorum_view' 
              AND created_at > %s
            ORDER BY confidence DESC, created_at DESC
            LIMIT 1
        """, (coin, since))
        
        row = cur.fetchone()
        if row:
            signals[coin] = {'action': row[0], 'confidence': row[1], 'strategy': row[2]}
        else:
            signals[coin] = None
    
    conn.close()
    return signals

def get_wallet_positions(wallet_address, base_url="https://api.hyperliquid-testnet.xyz"):
    """Get open positions for a specific wallet from HyperLiquid API"""
    positions = []
    account_value = 0.0
    
    if not wallet_address:
        return positions, account_value
    
    try:
        url = f"{base_url}/info"
        payload = {
            "type": "clearinghouseState",
            "user": wallet_address
        }
        response = requests.post(url, json=payload, timeout=10)
        response.raise_for_status()
        state = response.json()
        
        # Get current prices for PnL calculation
        price_payload = {"type": "allMids"}
        price_response = requests.post(url, json=price_payload, timeout=10)
        current_prices = {}
        if price_response.status_code == 200:
            price_data = price_response.json()
            current_prices = {k: float(v) for k, v in price_data.items()}
        
        # Get account value
        margin_summary = state.get('marginSummary', {})
        account_value = float(margin_summary.get('accountValue', 0))
        
        # Parse positions
        asset_positions = state.get('assetPositions', [])
        for pos in asset_positions:
            position_data = pos.get('position', {})
            coin = position_data.get('coin')
            size = float(position_data.get('szi', 0))
            entry_px = float(position_data.get('entryPx', 0))
            unrealized_pnl = float(position_data.get('unrealizedPnl', 0))
            leverage_data = position_data.get('leverage', {})
            leverage = leverage_data.get('value', 3) if isinstance(leverage_data, dict) else 3
            
            # Skip dust positions
            if abs(size) < 0.0001:
                continue
            
            # Determine side
            side = 'LONG' if size > 0 else 'SHORT'
            
            positions.append({
                'symbol': coin,
                'side': side,
                'leverage': leverage,
                'entry': entry_px,
                'mark': current_prices.get(coin, entry_px),
                'pnl': unrealized_pnl,
                'size': abs(size)
            })
            
    except Exception as e:
        print(f"[ERROR] Failed to fetch positions for {wallet_address}: {e}")
    
    return positions, account_value

def get_all_positions():
    """Get positions from both swing and scalp wallets"""
    settings = load_settings()
    
    # Get both wallet addresses
    swing_wallet = settings.get('swingMainWallet', '')
    scalp_wallet = settings.get('scalpMainWallet', '')
    environment = settings.get('environment', 'testnet')
    
    base_url = "https://api.hyperliquid-testnet.xyz"
    if environment == 'mainnet':
        base_url = "https://api.hyperliquid.xyz"
    
    # Fetch positions for both wallets
    swing_positions, swing_balance = get_wallet_positions(swing_wallet, base_url)
    scalp_positions, scalp_balance = get_wallet_positions(scalp_wallet, base_url)
    
    return {
        'swing': {
            'positions': swing_positions,
            'balance': swing_balance,
            'wallet': swing_wallet
        },
        'scalp': {
            'positions': scalp_positions,
            'balance': scalp_balance,
            'wallet': scalp_wallet
        }
    }

def get_recent_trades(limit=5):
    """Get recent trade executions from database"""
    from db import get_conn
    conn = get_conn()
    cur = conn.cursor()
    
    cur.execute("""
        SELECT coin, strategy, action, status, wallet_type, created_at
        FROM trade_executions
        ORDER BY created_at DESC
        LIMIT %s
    """, (limit,))
    
    trades = []
    for row in cur.fetchall():
        trades.append({
            'coin': row[0],
            'strategy': row[1],
            'action': row[2],
            'status': row[3],
            'wallet_type': row[4] or 'unknown',
            'time': row[5]
        })
    
    conn.close()
    return trades

def format_position(pos):
    """Format a single position for display"""
    pnl_str = f"PnL {'+' if pos['pnl'] >= 0 else '-'}${abs(pos['pnl']):.2f}"
    if pos['entry'] >= 1000:
        entry_str = f"${pos['entry']:,.0f}"
    else:
        entry_str = f"${pos['entry']:.2f}"
    return f"  {pos['symbol']} | {pos['side']} | {pos['leverage']}x | Entry {entry_str} | {pnl_str}"

def generate_report():
    """Generate trading report in the agreed format"""
    prices = get_latest_prices()
    signals = get_latest_signals()
    wallet_data = get_all_positions()
    recent_trades = get_recent_trades(5)
    
    now = datetime.now()
    
    lines = []
    
    # Header
    lines.append(f"TRADING REPORT")
    lines.append(f"{now.strftime('%A, %B %d - %H:%M')} (Bucharest)")
    lines.append("")
    
    # Prices
    lines.append("PRICES")
    for coin in COINS:
        price = prices.get(coin, 0)
        if price >= 1000:
            lines.append(f"  {coin} ${price:,.0f}")
        else:
            lines.append(f"  {coin} ${price:.2f}")
    
    lines.append("")
    lines.append("LATEST SIGNALS (Last Hour)")
    
    for coin in COINS:
        sig = signals.get(coin)
        if sig:
            action = sig['action']
            conf = sig['confidence']
            strategy = sig['strategy']
            if action in ['BUY', 'SELL'] and conf >= 0.5:
                lines.append(f"  {coin} | {action} @ {conf:.0%} | {strategy}")
            else:
                lines.append(f"  {coin} | {action} @ {conf:.0%} | {strategy}")
        else:
            lines.append(f"  {coin} | No Signal")
    
    # Swing Wallet Positions
    swing_data = wallet_data['swing']
    lines.append("")
    lines.append(f"SWING WALLET (Balance: ${swing_data['balance']:.2f})")
    lines.append(f"Open Positions: {len(swing_data['positions'])}")
    
    if swing_data['positions']:
        for pos in swing_data['positions']:
            lines.append(format_position(pos))
    else:
        lines.append("  No open positions")
    
    # Scalp Wallet Positions
    scalp_data = wallet_data['scalp']
    lines.append("")
    lines.append(f"SCALP WALLET (Balance: ${scalp_data['balance']:.2f})")
    lines.append(f"Open Positions: {len(scalp_data['positions'])}")
    
    if scalp_data['positions']:
        for pos in scalp_data['positions']:
            lines.append(format_position(pos))
    else:
        lines.append("  No open positions")
    
    # Total summary
    total_positions = len(swing_data['positions']) + len(scalp_data['positions'])
    total_balance = swing_data['balance'] + scalp_data['balance']
    total_pnl = sum(p['pnl'] for p in swing_data['positions']) + sum(p['pnl'] for p in scalp_data['positions'])
    pnl_str = f"{'+' if total_pnl >= 0 else '-'}${abs(total_pnl):.2f}"
    lines.append("")
    lines.append(f"TOTAL: {total_positions} positions | ${total_balance:.2f} balance | PnL {pnl_str}")
    
    # Recent Trades
    lines.append("")
    lines.append("RECENT TRADES")
    if recent_trades:
        for trade in recent_trades:
            status_str = "OK" if trade['status'] == 'success' else "SKIPPED" if trade['status'] == 'skipped' else "FAIL"
            wallet_label = trade['wallet_type'].upper() if trade['wallet_type'] else "?"
            lines.append(f"  [{status_str}] {trade['coin']} {trade['action']} ({trade['strategy']}) [{wallet_label}]")
    else:
        lines.append("  No recent trades")
    
    report = "\n".join(lines)
    
    # Save to file with UTF-8 encoding
    with open(REPORT_FILE, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(report)
    print(f"\n[OK] Report saved to {REPORT_FILE}")
    return True

if __name__ == "__main__":
    generate_report()
