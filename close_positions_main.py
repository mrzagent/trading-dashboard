#!/usr/bin/env python3
"""
Close ALL positions using main wallet credentials (not agent)
"""
import sys
sys.path.insert(0, r'D:\dev\trading-dashboard')
from trade_executor import TradeExecutor
from config_loader import get_swing_credentials, get_scalp_credentials
from hyperliquid.info import Info
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('close_all')


def close_all_wallet_positions(creds: dict, wallet_name: str, dry_run: bool = True) -> list:
    """Close all positions on a specific wallet using main wallet credentials"""
    
    logger.info(f"\n{'='*60}")
    logger.info(f"Closing ALL positions on {wallet_name.upper()} wallet")
    logger.info(f"Main Wallet: {creds['main_wallet']}")
    logger.info(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    logger.info(f"{'='*60}")
    
    # Get current positions
    info = Info(creds['api_url'], skip_ws=True)
    try:
        state = info.user_state(creds['main_wallet'])
        positions = state.get('assetPositions', [])
    except Exception as e:
        logger.error(f"Failed to get positions: {e}")
        return []
    
    if not positions:
        logger.info(f"\nNo positions found in {wallet_name} wallet")
        return []
    
    closed_positions = []
    
    for pos in positions:
        p = pos.get('position', {})
        coin = p.get('coin')
        size = float(p.get('szi', 0))
        pos_value = float(p.get('positionValue', 0))
        entry_px = float(p.get('entryPx', 0))
        unrealized_pnl = float(p.get('unrealizedPnl', 0))
        
        if abs(size) < 0.000001:
            continue
        
        side = 'LONG' if size > 0 else 'SHORT'
        
        logger.info(f"\n{coin} {side}")
        logger.info(f"  Size: {size}")
        logger.info(f"  Value: ${pos_value:.2f}")
        logger.info(f"  Entry: ${entry_px:.2f}")
        logger.info(f"  Unrealized P&L: ${unrealized_pnl:.2f}")
        
        if dry_run:
            logger.info(f"  [DRY RUN] Would close this position")
            closed_positions.append({
                'coin': coin,
                'size': size,
                'value': pos_value,
                'pnl': unrealized_pnl,
                'action': 'would_close'
            })
        else:
            try:
                # Use main wallet credentials directly
                executor = TradeExecutor(
                    wallet_address=creds['main_wallet'],
                    private_key=creds['main_private_key'],  # Need to add this to creds
                    api_url=creds['api_url'],
                    main_wallet=creds['main_wallet']
                )
                
                result = executor.close_position_real(coin)
                logger.info(f"  Position closed: {result}")
                closed_positions.append({
                    'coin': coin,
                    'size': size,
                    'value': pos_value,
                    'pnl': unrealized_pnl,
                    'action': 'closed'
                })
            except Exception as e:
                logger.error(f"  Failed to close position: {e}")
                closed_positions.append({
                    'coin': coin,
                    'size': size,
                    'value': pos_value,
                    'pnl': unrealized_pnl,
                    'action': 'failed',
                    'error': str(e)
                })
    
    return closed_positions


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Close all positions using main wallet')
    parser.add_argument('--live', action='store_true', help='Actually close positions (default: dry run)')
    args = parser.parse_args()
    
    dry_run = not args.live
    
    # Get credentials
    swing_creds = get_swing_credentials()
    scalp_creds = get_scalp_credentials()
    
    # Close positions on both wallets
    swing_closed = close_all_wallet_positions(swing_creds, 'swing', dry_run)
    scalp_closed = close_all_wallet_positions(scalp_creds, 'scalp', dry_run)
    
    # Summary
    logger.info(f"\n{'='*60}")
    logger.info("CLOSE ALL COMPLETE")
    logger.info(f"Total positions: {len(swing_closed) + len(scalp_closed)}")
    logger.info(f"{'='*60}")
