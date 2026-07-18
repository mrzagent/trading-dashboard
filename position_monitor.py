#!/usr/bin/env python3
"""Position Monitor - Tracks open positions and sends Telegram alerts on changes"""
import sys
import os
import json
import asyncio
import threading
import time
from datetime import datetime
sys.path.insert(0, r'D:\dev\trading-dashboard')

from hyperliquid.info import Info
from dotenv import load_dotenv

# Load environment variables
load_dotenv(r'D:\dev\trading-dashboard\.env')

# Paths
TRADE_STATE_PATH = r'D:\dev\trading-dashboard\trade_state.json'
POSITION_STATE_PATH = r'D:\dev\trading-dashboard\.position_state.json'
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID')

def load_account_settings():
    """Load account settings including environment and wallet addresses"""
    try:
        settings_path = r'D:\dev\trading-dashboard\.account_settings.json'
        with open(settings_path, 'r') as f:
            settings = json.load(f)
        
        env = settings.get('environment', 'testnet')
        env_config = settings.get(env, {})
        
        return {
            'environment': env,
            'api_url': env_config.get('apiUrl', 'https://api.hyperliquid-testnet.xyz'),
            'main_wallet': env_config.get('mainWalletAddress', env_config.get('walletAddress', ''))
        }
    except Exception as e:
        print(f"Error loading account settings: {e}")
        return {
            'environment': 'testnet',
            'api_url': 'https://api.hyperliquid-testnet.xyz',
            'main_wallet': '0x97c465489243175580fcDe624c2ef640c1897a00'
        }

async def send_telegram_alert(message):
    """Send alert to Telegram"""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print("Telegram credentials not configured")
        return False
    
    try:
        import aiohttp
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {
            'chat_id': TELEGRAM_CHAT_ID,
            'text': message,
            'parse_mode': 'HTML'
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as response:
                if response.status == 200:
                    print(f"✓ Telegram alert sent")
                    return True
                else:
                    print(f"✗ Telegram error: {response.status}")
                    return False
    except Exception as e:
        print(f"✗ Failed to send Telegram alert: {e}")
        return False

def load_position_state():
    """Load previously saved position state"""
    try:
        if os.path.exists(POSITION_STATE_PATH):
            with open(POSITION_STATE_PATH, 'r') as f:
                return json.load(f)
    except Exception as e:
        print(f"Warning: Could not load position state: {e}")
    return {"positions": {}, "alerts_sent": []}

def save_position_state(state):
    """Save current position state"""
    try:
        with open(POSITION_STATE_PATH, 'w') as f:
            json.dump(state, f, indent=2)
    except Exception as e:
        print(f"Warning: Could not save position state: {e}")

def fetch_hyperliquid_positions():
    """Fetch current positions from Hyperliquid"""
    account_settings = load_account_settings()
    BASE_URL = account_settings['api_url']
    MAIN_WALLET = account_settings['main_wallet'] or '0x97c465489243175580fcDe624c2ef640c1897a00'
    
    result = {'positions': {}, 'error': None}
    
    def fetch():
        try:
            info = Info(base_url=BASE_URL)
            state = info.user_state(MAIN_WALLET)
            
            positions = {}
            for pos in state.get('assetPositions', []):
                p = pos.get('position', {})
                coin = p.get('coin', '')
                size = float(p.get('szi', 0))
                entry = float(p.get('entryPx', 0))
                position_value = float(p.get('positionValue', 0))
                mark = position_value / abs(size) if size != 0 else entry
                pnl = float(p.get('unrealizedPnl', 0))
                
                # Get SL/TP from position
                sl = float(p.get('stopLoss', 0)) if p.get('stopLoss') else None
                tp = float(p.get('takeProfit', 0)) if p.get('takeProfit') else None
                
                positions[coin] = {
                    'coin': coin,
                    'side': 'LONG' if size > 0 else 'SHORT',
                    'size': abs(size),
                    'entry_price': entry,
                    'mark_price': mark,
                    'unrealized_pnl': pnl,
                    'stop_loss': sl,
                    'take_profit': tp,
                    'position_value': position_value
                }
            
            result['positions'] = positions
        except Exception as e:
            result['error'] = str(e)
    
    thread = threading.Thread(target=fetch)
    thread.daemon = True
    thread.start()
    thread.join(timeout=10)
    
    if thread.is_alive():
        return {'positions': {}, 'error': 'Timeout fetching positions'}
    
    return result

def check_position_changes(current_positions, previous_positions, alerts_sent):
    """Check for position changes and return alerts"""
    alerts = []
    now = datetime.now().strftime('%H:%M:%S')
    
    current_coins = set(current_positions.keys())
    previous_coins = set(previous_positions.keys())
    
    # New positions opened
    opened = current_coins - previous_coins
    for coin in opened:
        pos = current_positions[coin]
        emoji = "🟢" if pos['side'] == 'LONG' else "🔴"
        alert_key = f"open_{coin}_{now[:5]}"
        if alert_key not in alerts_sent:
            alerts.append({
                'key': alert_key,
                'message': (
                    f"{emoji} <b>POSITION OPENED</b>\n\n"
                    f"<b>{coin}</b> {pos['side']}\n"
                    f"Size: {pos['size']:.6f}\n"
                    f"Entry: ${pos['entry_price']:,.2f}\n"
                    f"Value: ${pos['position_value']:.2f}\n"
                    f"SL: ${pos['stop_loss']:,.2f}" if pos['stop_loss'] else "SL: Not set"
                )
            })
    
    # Positions closed
    closed = previous_coins - current_coins
    for coin in closed:
        pos = previous_positions[coin]
        alert_key = f"close_{coin}_{now[:5]}"
        if alert_key not in alerts_sent:
            alerts.append({
                'key': alert_key,
                'message': (
                    f"⚪ <b>POSITION CLOSED</b>\n\n"
                    f"<b>{coin}</b> {pos['side']}\n"
                    f"Was: {pos['size']:.6f} @ ${pos['entry_price']:,.2f}\n"
                    f"Last PnL: ${pos['unrealized_pnl']:+.2f}"
                )
            })
    
    # Check existing positions for SL/TP proximity
    for coin in current_coins & previous_coins:
        curr = current_positions[coin]
        prev = previous_positions[coin]
        
        # Check if position hit SL (closed or PnL significantly worse)
        if curr['unrealized_pnl'] < -abs(prev.get('unrealized_pnl', 0)) * 2:
            alert_key = f"sl_hit_{coin}_{now[:5]}"
            if alert_key not in alerts_sent:
                alerts.append({
                    'key': alert_key,
                    'message': (
                        f"🛑 <b>STOP LOSS HIT?</b>\n\n"
                        f"<b>{coin}</b> {curr['side']}\n"
                        f"PnL dropped: ${prev.get('unrealized_pnl', 0):+.2f} → ${curr['unrealized_pnl']:+.2f}\n"
                        f"Check position status!"
                    )
                })
        
        # Check if position hit TP (significant profit increase)
        if curr['unrealized_pnl'] > abs(prev.get('unrealized_pnl', 0)) * 3 and curr['unrealized_pnl'] > 5:
            alert_key = f"tp_hit_{coin}_{now[:5]}"
            if alert_key not in alerts_sent:
                alerts.append({
                    'key': alert_key,
                    'message': (
                        f"🎯 <b>TAKE PROFIT ZONE</b>\n\n"
                        f"<b>{coin}</b> {curr['side']}\n"
                        f"PnL: ${curr['unrealized_pnl']:+.2f}\n"
                        f"Mark: ${curr['mark_price']:,.2f}\n"
                        f"Consider taking profits!"
                    )
                })
        
        # Check for large PnL swings (>10% of position value)
        pnl_change = abs(curr['unrealized_pnl'] - prev.get('unrealized_pnl', 0))
        if pnl_change > curr['position_value'] * 0.1:
            direction = "📈" if curr['unrealized_pnl'] > prev.get('unrealized_pnl', 0) else "📉"
            alert_key = f"swing_{coin}_{now[:5]}"
            if alert_key not in alerts_sent:
                alerts.append({
                    'key': alert_key,
                    'message': (
                        f"{direction} <b>POSITION UPDATE</b>\n\n"
                        f"<b>{coin}</b> {curr['side']}\n"
                        f"PnL: ${prev.get('unrealized_pnl', 0):+.2f} → ${curr['unrealized_pnl']:+.2f}\n"
                        f"Mark: ${curr['mark_price']:,.2f}"
                    )
                })
    
    return alerts

async def main():
    print(f"Position Monitor - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("-" * 50)
    
    # Load previous state
    state = load_position_state()
    previous_positions = state.get('positions', {})
    alerts_sent = state.get('alerts_sent', [])
    
    # Fetch current positions
    result = fetch_hyperliquid_positions()
    
    if result['error']:
        print(f"[X] Error fetching positions: {result['error']}")
        # Try to send error alert if it's a new error
        error_alert_key = f"error_{datetime.now().strftime('%H:%M')[:4]}"
        if error_alert_key not in alerts_sent and TELEGRAM_BOT_TOKEN:
            await send_telegram_alert(f"⚠️ <b>Position Monitor Error</b>\n\n{result['error']}")
            alerts_sent.append(error_alert_key)
            save_position_state({"positions": previous_positions, "alerts_sent": alerts_sent[-50:]})
        return
    
    current_positions = result['positions']
    
    # Display current positions
    if current_positions:
        print(f"Open Positions ({len(current_positions)}):")
        for coin, pos in current_positions.items():
            side_marker = "[LONG]" if pos['side'] == 'LONG' else "[SHORT]"
            print(f"  {side_marker} {coin}: {pos['size']:.6f} @ ${pos['entry_price']:,.2f} | PnL: ${pos['unrealized_pnl']:+.2f}")
    else:
        print("No open positions")
    
    # Check for changes
    alerts = check_position_changes(current_positions, previous_positions, alerts_sent)
    
    # Send alerts
    if alerts:
        print(f"\n{len(alerts)} alert(s) to send:")
        for alert in alerts:
            print(f"  -> {alert['key']}")
            await send_telegram_alert(alert['message'])
            alerts_sent.append(alert['key'])
            time.sleep(0.5)  # Rate limit
    else:
        print("\nNo changes detected")
    
    # Save state
    save_position_state({
        "positions": current_positions,
        "alerts_sent": alerts_sent[-100:]  # Keep last 100 alerts
    })
    
    print("-" * 50)
    print("Monitor complete")

if __name__ == "__main__":
    asyncio.run(main())
