#!/usr/bin/env python3
"""Check current positions on both wallets"""
import sys
sys.path.insert(0, 'D:\\dev\\trading-dashboard')

from hyperliquid.info import Info

swing_main = '0x97c465489243175580fcDe624c2ef640c1897a00'
scalp_main = '0x89823A4f85cc8ef3A5574E8a56741A7b4562f288'

api_url = 'https://api.hyperliquid-testnet.xyz'
info = Info(api_url, skip_ws=True)

print("=== Current Positions ===\n")

for name, address in [("SWING", swing_main), ("SCALP", scalp_main)]:
    print(f"\n{name} Wallet: {address}")
    print("-" * 60)
    try:
        state = info.user_state(address)
        positions = state.get('assetPositions', [])
        if not positions:
            print("  No positions")
        for pos in positions:
            p = pos.get('position', {})
            coin = p.get('coin', 'Unknown')
            size = float(p.get('szi', 0))
            entry = float(p.get('entryPx', 0))
            value = float(p.get('positionValue', 0))
            pnl = float(p.get('unrealizedPnl', 0))
            side = "LONG" if size > 0 else "SHORT"
            print(f"  {coin} {side}: {abs(size)} @ ${entry:,.2f} (Value: ${value:,.2f}, P&L: ${pnl:+.2f})")
    except Exception as e:
        print(f"  Error: {e}")
