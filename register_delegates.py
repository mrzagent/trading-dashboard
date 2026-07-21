#!/usr/bin/env python3
"""
Register agent wallets as delegates on HyperLiquid
This allows agent wallets to trade on behalf of main wallets
"""
import sys
sys.path.insert(0, r'D:\dev\trading-dashboard')

from hyperliquid.exchange import Exchange
from hyperliquid.info import Info
from eth_account import Account
import os

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

def register_delegate(main_wallet: str, main_private_key: str, agent_wallet: str, env: str = 'testnet'):
    """Register an agent wallet as a delegate for a main wallet"""
    
    api_url = 'https://api.hyperliquid-testnet.xyz' if env == 'testnet' else 'https://api.hyperliquid.xyz'
    
    print(f"\n{'='*60}")
    print(f"Registering delegate on {env.upper()}")
    print(f"Main Wallet: {main_wallet}")
    print(f"Agent Wallet: {agent_wallet}")
    print(f"{'='*60}")
    
    try:
        # Create wallet from private key
        wallet = Account.from_key(main_private_key)
        
        # Create exchange connection
        info = Info(api_url, skip_ws=True)
        meta = info.meta()
        
        exchange = Exchange(
            wallet=wallet,
            base_url=api_url,
            account_address=main_wallet,
            meta=meta
        )
        
        # Check if already approved
        # Note: HyperLiquid doesn't have a direct API to check if agent is approved
        # We'll just try to approve and handle any errors
        
        print(f"Approving agent {agent_wallet}...")
        result, error = exchange.approve_agent(agent_wallet)
        
        if error:
            print(f"❌ Error: {error}")
            return False
        
        print(f"✅ Agent approved successfully!")
        print(f"Result: {result}")
        return True
        
    except Exception as e:
        print(f"❌ Failed: {e}")
        return False


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Register agent wallets as delegates')
    parser.add_argument('--env', choices=['testnet', 'mainnet'], default='testnet',
                        help='Environment (default: testnet)')
    args = parser.parse_args()
    
    env = args.env
    
    # Get credentials from environment
    prefix = f"HYPERLIQUID_{env.upper()}"
    
    # SWING wallet
    swing_main = os.getenv(f"HYPERLIQUID_SWING_{env.upper()}_MAIN_WALLET")
    swing_agent = os.getenv(f"HYPERLIQUID_SWING_{env.upper()}_AGENT_WALLET")
    
    # SCALP wallet
    scalp_main = os.getenv(f"HYPERLIQUID_SCALP_{env.upper()}_MAIN_WALLET")
    scalp_agent = os.getenv(f"HYPERLIQUID_SCALP_{env.upper()}_AGENT_WALLET")
    
    print("This script requires the MAIN WALLET private keys to register delegates.")
    print("You need to provide the private keys for the main wallets.")
    print()
    print("SWING Main Wallet:", swing_main)
    print("SCALP Main Wallet:", scalp_main)
    print()
    print("Please enter the private keys (or press Enter to skip):")
    
    swing_main_pk = input(f"SWING Main Private Key: ").strip()
    scalp_main_pk = input(f"SCALP Main Private Key: ").strip()
    
    if swing_main_pk:
        register_delegate(swing_main, swing_main_pk, swing_agent, env)
    
    if scalp_main_pk:
        register_delegate(scalp_main, scalp_main_pk, scalp_agent, env)
