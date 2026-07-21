#!/usr/bin/env python3
"""Sync local trade state with actual HyperLiquid positions"""
import sys
sys.path.insert(0, r'D:\dev\trading-dashboard')
from trade_executor import TradeExecutor
from config_loader import get_credentials_for_strategy
import json

def sync_wallet(wallet_type='swing'):
    """Sync positions for a specific wallet"""
    creds = get_credentials_for_strategy('rsi_mean_reversion' if wallet_type == 'swing' else 'fvg_proximity')
    
    executor = TradeExecutor(
        wallet_address=creds['agent_wallet'],
        private_key=creds['agent_private_key'],
        api_url=creds['api_url'],
        main_wallet=creds['main_wallet']
    )
    
    print(f"\n=== {wallet_type.upper()} Wallet Sync ===")
    print(f"Wallet: {creds['agent_wallet']}")
    
    # Get actual positions from HL
    actual_positions = executor.client.get_positions()
    active_positions = {p['coin']: p for p in actual_positions if abs(p.get('size', 0)) > 0}
    
    print(f"\nActual positions on HL: {list(active_positions.keys())}")
    print(f"Local state positions: {list(executor.open_trades.keys())}")
    
    # Find positions that are closed on HL but still in local state
    to_remove = []
    for symbol, trade in executor.open_trades.items():
        if symbol not in active_positions:
            to_remove.append(symbol)
            print(f"  ❌ {symbol}: Closed on HL but still in local state - REMOVING")
        else:
            actual = active_positions[symbol]
            actual_size = abs(actual.get('size', 0))
            local_size = abs(trade.position_size)
            if abs(actual_size - local_size) > 0.0001:
                print(f"  ⚠️  {symbol}: Size mismatch - HL: {actual_size}, Local: {local_size}")
            else:
                print(f"  ✅ {symbol}: In sync")
    
    # Remove closed positions from state
    for symbol in to_remove:
        del executor.open_trades[symbol]
    
    # Save updated state
    if to_remove:
        executor._save_state()
        print(f"\nUpdated state file. Removed {len(to_remove)} closed positions.")
    else:
        print("\nNo changes needed.")
    
    return active_positions

# Sync both wallets
print("Syncing trade state with HyperLiquid...")
swing_positions = sync_wallet('swing')
scalp_positions = sync_wallet('scalp')

print("\n=== Final Summary ===")
print(f"Swing wallet positions: {len(swing_positions)}")
print(f"Scalp wallet positions: {len(scalp_positions)}")
