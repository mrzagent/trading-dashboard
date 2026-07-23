#!/usr/bin/env python3
"""Fetch account info from Hyperliquid for dashboard.

With wallet separation, this aggregates account info from BOTH swing and scalp wallets.
Uses direct HTTP requests instead of the SDK to avoid hanging issues.
"""
import sys
import os
import json
import urllib.request
import urllib.error

# Add trading directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config_loader import get_swing_credentials, get_scalp_credentials


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


def hl_api_post(base_url: str, payload: dict) -> dict:
    """Make a POST request to HyperLiquid API."""
    req = urllib.request.Request(
        f"{base_url}/info",
        data=json.dumps(payload).encode(),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())


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
        # Get clearinghouse state (perp account) - use main wallet for balance
        state = hl_api_post(api_url, {"type": "clearinghouseState", "user": main_wallet})
        
        # Get spot clearinghouse state (spot balance)
        spot_state = hl_api_post(api_url, {"type": "spotClearinghouseState", "user": main_wallet})
        
        # Calculate spot USDC balance
        spot_usdc = 0.0
        for balance in spot_state.get('balances', []):
            if balance.get('coin') == 'USDC':
                spot_usdc = float(balance.get('total', 0))
                break
        
        # Get margin summary
        margin_summary = state.get('marginSummary', {})
        total_margin_used = float(margin_summary.get('totalMarginUsed', 0))
        perp_account_value = float(margin_summary.get('accountValue', 0))
        
        # Total account value = perp + spot
        account_value = perp_account_value + spot_usdc
        
        # Get portfolio data for PnL (24h, 7d, 30d)
        pnl_24h = 0.0
        pnl_7d = 0.0
        pnl_30d = 0.0
        try:
            portfolio = hl_api_post(api_url, {"type": "portfolio", "user": main_wallet})
            # portfolio is a list of [period, data] pairs
            for period_name, period_data in portfolio:
                pnl_hist = period_data.get("pnlHistory", [])
                if pnl_hist and len(pnl_hist) >= 2:
                    pnl_value = float(pnl_hist[-1][1]) - float(pnl_hist[0][1])
                    if period_name == "day":
                        pnl_24h = pnl_value
                    elif period_name == "week":
                        pnl_7d = pnl_value
                    elif period_name == "month":
                        pnl_30d = pnl_value
        except Exception:
            pass
        
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
        
        # Calculate available balance (excluding margin used)
        available_balance = account_value - total_margin_used
        
        return {
            'walletType': wallet_type,
            'mainWallet': main_wallet,
            'agentWallet': agent_wallet,
            'mainWalletDisplay': main_wallet[:10] + '...' + main_wallet[-6:] if len(main_wallet) > 16 else main_wallet,
            'agentWalletDisplay': agent_wallet[:10] + '...' + agent_wallet[-6:] if len(agent_wallet) > 16 else agent_wallet,
            'balance': available_balance,  # Show available balance as equity (not total account value)
            'deployedCapital': deployed,
            'available': available_balance,
            'positionCount': position_count,
            'unrealizedPnl': unrealized_pnl,
            'totalMargin': total_margin_used,
            'pnl24h': pnl_24h,
            'pnl7d': pnl_7d,
            'pnl30d': pnl_30d,
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
            'pnl7d': 0,
            'pnl30d': 0,
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
        total_pnl_7d = (swing_info.get('pnl7d', 0) or 0) + (scalp_info.get('pnl7d', 0) or 0)
        total_pnl_30d = (swing_info.get('pnl30d', 0) or 0) + (scalp_info.get('pnl30d', 0) or 0)
        
        # Load risk config defaults
        defaults = load_risk_config_defaults()
        
        # Get private keys from config (for display in dashboard)
        swing_private_key = swing_creds.get('agent_private_key', '')
        scalp_private_key = scalp_creds.get('agent_private_key', '')
        
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
            'pnl7d': total_pnl_7d if total_pnl_7d != 0 else None,
            'pnl30d': total_pnl_30d if total_pnl_30d != 0 else None,
            'leverage': defaults['leverage'],
            'stopLoss': defaults['stopLoss'],
            'takeProfit': defaults['takeProfit'],
            # Per-wallet breakdown
            'wallets': {
                'swing': swing_info,
                'scalp': scalp_info
            },
            # Private keys (masked) for dashboard display
            'swingAgentPrivateKey': swing_private_key,
            'scalpAgentPrivateKey': scalp_private_key,
            'hasSwingPrivateKey': bool(swing_private_key),
            'hasScalpPrivateKey': bool(scalp_private_key)
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
if __name__ == "__main__":
    result = fetch_all_account_info()
    print(json.dumps(result))
    sys.stdout.flush()
