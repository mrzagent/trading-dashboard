#!/usr/bin/env python3
"""Fetch account info from Hyperliquid for dashboard.

With wallet separation, this aggregates account info from BOTH swing and scalp wallets.
"""
import sys
import os
import json
import threading

# Add trading directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from hyperliquid.info import Info
from config_loader import get_swing_credentials, get_scalp_credentials, HYPERLIQUID_ENV


def load_risk_config_defaults():
    """Load default leverage/sl/tp from risk_config.json"""
    try:
        config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'risk_config.json')
        with open(config_path, 'r') as f:
            rc = json.load(f)
        leverage = rc.get('leverage', 3)
        stop_loss_pct = rc.get('stop_loss_pct', 0.05) * 100  # convert to percentage
        tp_levels = rc.get('take_profit_levels', [])
        take_profit_pct = tp_levels[0]['level'] * 100 if tp_levels else 3.0
        return {
            'leverage': leverage,
            'stopLoss': stop_loss_pct,
            'takeProfit': round(take_profit_pct, 2)
        }
    except Exception:
        return {'leverage': 3, 'stopLoss': 5.0, 'takeProfit': 3.0}


def fetch_wallet_info(creds: dict, wallet_type: str) -> dict:
    """Fetch account info for a specific wallet.
    
    Args:
        creds: Wallet credentials dict with 'main_wallet', 'agent_wallet', 'api_url'
        wallet_type: 'swing' or 'scalp'
    
    Returns:
        Account info dict for this wallet
    """
    main_wallet = creds.get('main_wallet', creds.get('wallet', ''))
    agent_wallet = creds.get('agent_wallet', creds.get('wallet', ''))
    api_url = creds['api_url']
    
    try:
        info = Info(base_url=api_url)
        
        # Get account state (perp account) - use main wallet for balance
        state = info.user_state(main_wallet)
        
        # Get margin summary
        margin_summary = state.get('marginSummary', {})
        total_margin_used = float(margin_summary.get('totalMarginUsed', 0))
        total_ntl_pos = float(margin_summary.get('totalNtlPos', 0))
        
        # Get Total Equity from portfolio endpoint
        account_value = 0.0
        pnl_24h = 0.0
        
        try:
            portfolio = info.post("/info", {"type": "portfolio", "user": wallet_address})
            for period_name, period_data in portfolio:
                if period_name == "day":
                    history = period_data.get("accountValueHistory", [])
                    pnl_hist = period_data.get("pnlHistory", [])
                    if history:
                        account_value = float(history[-1][1])
                    if pnl_hist and len(pnl_hist) >= 2:
                        pnl_24h = float(pnl_hist[-1][1]) - float(pnl_hist[0][1])
        except Exception:
            pass
        
        # Fallback: perp account value if portfolio call failed
        if account_value == 0.0:
            account_value = float(margin_summary.get('accountValue', 0))
        
        # Calculate deployed capital from positions
        positions = state.get('assetPositions', [])
        deployed = 0
        unrealized_pnl = 0
        position_count = 0
        
        for pos in positions:
            p = pos.get('position', {})
            size = float(p.get('szi', 0))
            if size == 0:
                continue
            entry = float(p.get('entryPx', 0))
            deployed += abs(size) * entry
            position_count += 1
            pnl = p.get('unrealizedPnl')
            if pnl is not None:
                unrealized_pnl += float(pnl)
        
        return {
            'walletType': wallet_type,
            'mainWallet': main_wallet,
            'agentWallet': agent_wallet,
            'mainWalletDisplay': main_wallet[:10] + '...' + main_wallet[-6:] if len(main_wallet) > 16 else main_wallet,
            'agentWalletDisplay': agent_wallet[:10] + '...' + agent_wallet[-6:] if len(agent_wallet) > 16 else agent_wallet,
            'balance': account_value,
            'deployedCapital': deployed,
            'available': account_value - total_margin_used,
            'positionCount': position_count,
            'unrealizedPnl': unrealized_pnl,
            'totalMargin': total_margin_used,
            'pnl24h': pnl_24h,
        }
        
    except Exception as e:
        print(f"Error fetching account info for {wallet_type}: {e}", file=sys.stderr)
        return {
            'walletType': wallet_type,
            'mainWallet': main_wallet,
            'agentWallet': agent_wallet,
            'mainWalletDisplay': main_wallet[:10] + '...' + main_wallet[-6:] if len(main_wallet) > 16 else main_wallet,
            'agentWalletDisplay': agent_wallet[:10] + '...' + agent_wallet[-6:] if len(agent_wallet) > 16 else agent_wallet,
            'balance': 0,
            'deployedCapital': 0,
            'available': 0,
            'positionCount': 0,
            'unrealizedPnl': 0,
            'totalMargin': 0,
            'pnl24h': 0,
            'error': str(e)
        }


def fetch_all_account_info():
    """Fetch and aggregate account info from both wallets."""
    try:
        # Get credentials for both wallets
        swing_creds = get_swing_credentials()
        scalp_creds = get_scalp_credentials()
        
        # Fetch info from both wallets
        swing_info = fetch_wallet_info(swing_creds, 'swing')
        scalp_info = fetch_wallet_info(scalp_creds, 'scalp')
        
        # Aggregate totals
        total_balance = swing_info['balance'] + scalp_info['balance']
        total_deployed = swing_info['deployedCapital'] + scalp_info['deployedCapital']
        total_available = swing_info['available'] + scalp_info['available']
        total_positions = swing_info['positionCount'] + scalp_info['positionCount']
        total_unrealized = swing_info['unrealizedPnl'] + scalp_info['unrealizedPnl']
        total_margin = swing_info['totalMargin'] + scalp_info['totalMargin']
        total_pnl_24h = (swing_info.get('pnl24h', 0) or 0) + (scalp_info.get('pnl24h', 0) or 0)
        
        # Load risk config defaults
        defaults = load_risk_config_defaults()
        
        # Build combined result
        result = {
            # Aggregated totals
            'balance': total_balance,
            'deployedCapital': total_deployed,
            'available': total_available,
            'positionCount': total_positions,
            'unrealizedPnl': total_unrealized,
            'totalMargin': total_margin,
            'pnl24h': total_pnl_24h if total_pnl_24h != 0 else None,
            'pnl7d': None,  # Would need separate calculation
            'pnl30d': None,  # Would need separate calculation
            'leverage': defaults['leverage'],
            'stopLoss': defaults['stopLoss'],
            'takeProfit': defaults['takeProfit'],
            # Per-wallet breakdown
            'wallets': {
                'swing': swing_info,
                'scalp': scalp_info
            }
        }
        
        return result
        
    except Exception as e:
        print(f"Error fetching account info: {e}", file=sys.stderr)
        # Return fallback with error
        defaults = load_risk_config_defaults()
        return {
            'balance': 0,
            'deployedCapital': 0,
            'available': 0,
            'positionCount': 0,
            'unrealizedPnl': 0,
            'totalMargin': 0,
            'pnl24h': None,
            'pnl7d': None,
            'pnl30d': None,
            'leverage': defaults['leverage'],
            'stopLoss': defaults['stopLoss'],
            'takeProfit': defaults['takeProfit'],
            'wallets': {},
            'error': str(e)
        }


# Main execution
result = {'data': None, 'error': None}


def run_fetch():
    result['data'] = fetch_all_account_info()


# Run fetch in a thread with timeout
thread = threading.Thread(target=run_fetch)
thread.daemon = True
thread.start()
thread.join(timeout=10)  # 10 second timeout for both wallets

# Default fallback
fallback_defaults = load_risk_config_defaults()
fallback = {
    'balance': 0,
    'deployedCapital': 0,
    'available': 0,
    'positionCount': 0,
    'unrealizedPnl': 0,
    'totalMargin': 0,
    'pnl24h': None,
    'pnl7d': None,
    'pnl30d': None,
    'leverage': fallback_defaults['leverage'],
    'stopLoss': fallback_defaults['stopLoss'],
    'takeProfit': fallback_defaults['takeProfit'],
    'wallets': {}
}

if thread.is_alive():
    # Timeout - return defaults
    print(json.dumps(fallback))
else:
    if result['error']:
        print(f"Error: {result['error']}", file=sys.stderr)
        print(json.dumps(fallback))
    else:
        print(json.dumps(result['data'] or fallback))

sys.stdout.flush()
