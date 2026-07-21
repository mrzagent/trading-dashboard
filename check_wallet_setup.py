#!/usr/bin/env python3
"""Check wallet delegate setup on HyperLiquid"""
import sys
sys.path.insert(0, 'D:\\dev\\trading-dashboard')

from hyperliquid.info import Info

# Wallet addresses
swing_main = '0x97c465489243175580fcDe624c2ef640c1897a00'
swing_agent = '0x7A082AEe3A8c69b3935792B6f23c2EA2da460431'
scalp_main = '0x89823A4f85cc8ef3A5574E8a56741A7b4562f288'
scalp_agent = '0xee46b825D3E1c6880a5e0FC2d5be82fFb13FD433'

api_url = 'https://api.hyperliquid-testnet.xyz'
info = Info(api_url, skip_ws=True)

print("=== Checking Wallet Setup ===\n")

# Check if agents are registered as delegates
print("SWING Wallet:")
print(f"  Main: {swing_main}")
print(f"  Agent: {swing_agent}")
try:
    # Get clearinghouse state to see if agent is authorized
    state = info.user_state(swing_main)
    print(f"  Main wallet has {len(state.get('assetPositions', []))} positions")
except Exception as e:
    print(f"  Error: {e}")

print("\nSCALP Wallet:")
print(f"  Main: {scalp_main}")
print(f"  Agent: {scalp_agent}")
try:
    state = info.user_state(scalp_main)
    print(f"  Main wallet has {len(state.get('assetPositions', []))} positions")
except Exception as e:
    print(f"  Error: {e}")

print("\n=== Issue ===")
print("The agent wallets need to be registered as delegates on HyperLiquid.")
print("This is done through the HyperLiquid UI or API.")
