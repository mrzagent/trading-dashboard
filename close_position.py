#!/usr/bin/env python3
"""Close a position on Hyperliquid via market order.

With wallet separation, this routes the close to the correct wallet
based on the position's wallet_type.
"""
import sys
import os
import json

# Add trading directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from eth_account import Account
from hyperliquid.info import Info
from hyperliquid.exchange import Exchange
from config_loader import get_swing_credentials, get_scalp_credentials


def get_wallet_for_position(coin: str, wallet_type: str = None) -> dict:
    """Determine which wallet has the position and return its credentials.
    
    Args:
        coin: The coin symbol (BTC, ETH, SOL)
        wallet_type: Optional 'swing' or 'scalp' to skip detection
    
    Returns:
        dict with wallet credentials and type
    """
    if wallet_type:
        # Use specified wallet type
        if wallet_type == 'scalp':
            creds = get_scalp_credentials()
            creds['wallet_type'] = 'scalp'
            return creds
        else:
            creds = get_swing_credentials()
            creds['wallet_type'] = 'swing'
            return creds
    
    # Auto-detect: check both wallets
    swing_creds = get_swing_credentials()
    scalp_creds = get_scalp_credentials()
    
    # Check swing wallet first
    try:
        info = Info(base_url=swing_creds['api_url'])
        state = info.user_state(swing_creds['wallet'])
        for pos in state.get('assetPositions', []):
            p = pos.get('position', {})
            if p.get('coin') == coin and abs(float(p.get('szi', 0))) > 0:
                swing_creds['wallet_type'] = 'swing'
                return swing_creds
    except Exception as e:
        print(f"Error checking swing wallet: {e}", file=sys.stderr)
    
    # Check scalp wallet
    try:
        info = Info(base_url=scalp_creds['api_url'])
        state = info.user_state(scalp_creds['wallet'])
        for pos in state.get('assetPositions', []):
            p = pos.get('position', {})
            if p.get('coin') == coin and abs(float(p.get('szi', 0))) > 0:
                scalp_creds['wallet_type'] = 'scalp'
                return scalp_creds
    except Exception as e:
        print(f"Error checking scalp wallet: {e}", file=sys.stderr)
    
    # Default to swing if not found
    print(f"Position not found in either wallet, defaulting to swing", file=sys.stderr)
    swing_creds['wallet_type'] = 'swing'
    return swing_creds


def close_position(coin: str, wallet_type: str = None):
    """Close position for given coin on the correct wallet.
    
    Args:
        coin: The coin symbol (BTC, ETH, SOL)
        wallet_type: Optional 'swing' or 'scalp' to specify wallet
    
    Returns:
        dict with success status and details
    """
    # Get the correct wallet credentials
    creds = get_wallet_for_position(coin, wallet_type)
    wallet_type = creds.get('wallet_type', 'unknown')
    
    private_key = creds['private_key']
    wallet_address = creds['wallet']
    api_url = creds['api_url']
    
    if not private_key:
        return {
            'success': False, 
            'error': f'No private key configured for {wallet_type} wallet'
        }
    
    # Create account from private key
    account = Account.from_key(private_key)
    
    # Initialize SDK
    info = Info(base_url=api_url)
    exchange = Exchange(
        wallet=account, 
        base_url=api_url
    )
    
    # Get positions from the wallet
    state = info.user_state(wallet_address)
    positions = state.get('assetPositions', [])
    
    # Find target position
    target = None
    for pos in positions:
        p = pos.get('position', {})
        if p.get('coin') == coin:
            target = p
            break
    
    if not target:
        return {
            'success': False, 
            'error': f'No position found for {coin} in {wallet_type} wallet'
        }
    
    size = float(target.get('szi', 0))
    
    print(f"Closing {coin} on {wallet_type} wallet: size={size}", file=sys.stderr)
    
    try:
        # Use SDK's market_close with position size
        result = exchange.market_close(coin, sz=abs(size))
        print(f"market_close result: {result}", file=sys.stderr)
        
        if result.get('status') == 'ok':
            statuses = result.get('response', {}).get('data', {}).get('statuses', [])
            if statuses and 'filled' in statuses[0]:
                return {
                    'success': True, 
                    'tx': statuses[0].get('filled', {}).get('oid', 'unknown'),
                    'pnl': float(target.get('unrealizedPnl', 0)),
                    'walletType': wallet_type,
                    'walletAddress': wallet_address[:10] + '...' + wallet_address[-6:]
                }
            elif statuses and 'error' in statuses[0]:
                return {
                    'success': False, 
                    'error': statuses[0]['error'],
                    'walletType': wallet_type
                }
            else:
                return {
                    'success': True, 
                    'tx': 'pending',
                    'walletType': wallet_type
                }
        else:
            return {
                'success': False, 
                'error': str(result),
                'walletType': wallet_type
            }
    except Exception as e:
        import traceback
        traceback.print_exc(file=sys.stderr)
        return {
            'success': False, 
            'error': str(e),
            'walletType': wallet_type
        }


# Main
if len(sys.argv) < 2:
    print(json.dumps({
        'success': False, 
        'error': 'Usage: close_position.py <coin> [wallet_type]'
    }))
    sys.exit(1)

coin = sys.argv[1]
wallet_type = sys.argv[2] if len(sys.argv) > 2 else None

result = close_position(coin, wallet_type)
print(json.dumps(result))
