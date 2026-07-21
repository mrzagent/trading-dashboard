#!/usr/bin/env python3
"""Check if wallets exist on HyperLiquid"""
import sys
sys.path.insert(0, r'D:\dev\trading-dashboard')

from hyperliquid.info import Info

# Wallet addresses
swing_main = '0x97c465489243175580fcDe624c2ef640c1897a00'
swing_agent = '0x7A082AEe3A8c69b3935792B6f23c2EA2da460431'
scalp_main = '0x89823A4f85cc8ef3A5574E8a56741A7b4562f288'
scalp_agent = '0xee46b825D3E1c6880a5e0FC2d5be82fFb13FD433'

api_url = 'https://api.hyperliquid-testnet.xyz'
info = Info(api_url, skip_ws=True)

print("=== Checking Wallet Existence on HyperLiquid ===\n")

for name, address in [
    ("SWING Main", swing_main),
    ("SWING Agent", swing_agent),
    ("SCALP Main", scalp_main),
    ("SCALP Agent", scalp_agent)
]:
    print(f"{name}: {address}")
    try:
        state = info.user_state(address)
        print(f"  Status: ✅ Wallet exists")
        print(f"  Balance: ${float(state.get('marginSummary', {}).get('accountValue', 0)):.2f}")
    except Exception as e:
        print(f"  Status: ❌ Error - {e}")
    print()
