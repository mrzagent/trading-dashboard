#!/usr/bin/env python3
"""
Dust Cleaner - Periodically closes tiny positions (< $1 value)

Prevents dust positions from blocking new trades and keeps wallets clean.
"""
import sys
sys.path.insert(0, r'D:\dev\trading-dashboard')
from trade_executor import TradeExecutor
from config_loader import get_credentials_for_strategy
from hyperliquid.info import Info
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('dust_cleaner')

# Minimum position value to keep (positions below this will be closed)
MIN_POSITION_VALUE = 1.0  # $1 USD


def clean_wallet(wallet_type: str, dry_run: bool = True) -> list:
    """
    Clean dust positions from a specific wallet.
    
    Args:
        wallet_type: 'swing' or 'scalp'
        dry_run: If True, only log what would be closed without actually closing
    
    Returns:
        List of closed positions
    """
    # Get credentials for this wallet type
    if wallet_type == 'swing':
        creds = get_credentials_for_strategy('rsi_mean_reversion')
    else:
        creds = get_credentials_for_strategy('fvg_proximity')
    
    logger.info(f"\n{'='*60}")
    logger.info(f"Checking {wallet_type.upper()} wallet for dust positions")
    logger.info(f"Wallet: {creds['main_wallet']}")
    logger.info(f"Min position value: ${MIN_POSITION_VALUE}")
    logger.info(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    logger.info(f"{'='*60}")
    
    # Get current positions from HyperLiquid
    info = Info(creds['api_url'], skip_ws=True)
    try:
        state = info.user_state(creds['main_wallet'])
        positions = state.get('assetPositions', [])
    except Exception as e:
        logger.error(f"Failed to get positions: {e}")
        return []
    
    closed_positions = []
    
    for pos in positions:
        p = pos.get('position', {})
        coin = p.get('coin')
        size = float(p.get('szi', 0))
        pos_value = float(p.get('positionValue', 0))
        entry_px = float(p.get('entryPx', 0))
        
        if abs(size) < 0.000001:  # Skip zero positions
            continue
        
        # Check if position value is below threshold
        if pos_value < MIN_POSITION_VALUE:
            logger.info(f"\nFound dust position: {coin}")
            logger.info(f"  Size: {size}")
            logger.info(f"  Value: ${pos_value:.2f}")
            logger.info(f"  Entry: ${entry_px:.2f}")
            
            if dry_run:
                logger.info(f"  [DRY RUN] Would close this position")
                closed_positions.append({
                    'coin': coin,
                    'size': size,
                    'value': pos_value,
                    'action': 'would_close'
                })
            else:
                # Actually close the position
                try:
                    executor = TradeExecutor(
                        wallet_address=creds['agent_wallet'],
                        private_key=creds['agent_private_key'],
                        api_url=creds['api_url'],
                        main_wallet=creds['main_wallet']
                    )
                    
                    result = executor.close_position_real(coin)
                    logger.info(f"  ✓ Position closed: {result}")
                    closed_positions.append({
                        'coin': coin,
                        'size': size,
                        'value': pos_value,
                        'action': 'closed'
                    })
                except Exception as e:
                    logger.error(f"  ✗ Failed to close position: {e}")
                    closed_positions.append({
                        'coin': coin,
                        'size': size,
                        'value': pos_value,
                        'action': 'failed',
                        'error': str(e)
                    })
    
    if not closed_positions:
        logger.info(f"\nNo dust positions found in {wallet_type} wallet")
    else:
        logger.info(f"\n{'='*60}")
        logger.info(f"Summary for {wallet_type} wallet:")
        logger.info(f"  Positions processed: {len(closed_positions)}")
        logger.info(f"  Total value cleaned: ${sum(p['value'] for p in closed_positions):.2f}")
        logger.info(f"{'='*60}")
    
    return closed_positions


def clean_all_wallets(dry_run: bool = True) -> dict:
    """
    Clean dust positions from both swing and scalp wallets.
    
    Args:
        dry_run: If True, only log what would be closed
    
    Returns:
        Dict with results for each wallet
    """
    logger.info("\n" + "="*60)
    logger.info("DUST CLEANER STARTING")
    logger.info(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    logger.info(f"Min position value: ${MIN_POSITION_VALUE}")
    logger.info("="*60)
    
    results = {
        'swing': clean_wallet('swing', dry_run),
        'scalp': clean_wallet('scalp', dry_run)
    }
    
    total_closed = sum(len(r) for r in results.values())
    total_value = sum(sum(p['value'] for p in r) for r in results.values())
    
    logger.info("\n" + "="*60)
    logger.info("DUST CLEANER COMPLETE")
    logger.info(f"Total positions processed: {total_closed}")
    logger.info(f"Total value cleaned: ${total_value:.2f}")
    logger.info("="*60)
    
    return results


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Clean dust positions from trading wallets')
    parser.add_argument('--live', action='store_true', 
                        help='Actually close positions (default is dry-run)')
    parser.add_argument('--wallet', choices=['swing', 'scalp', 'both'], default='both',
                        help='Which wallet to clean (default: both)')
    parser.add_argument('--min-value', type=float, default=1.0,
                        help='Minimum position value to keep (default: $1)')
    
    args = parser.parse_args()
    
    # Set minimum value from args
    MIN_POSITION_VALUE = args.min_value
    
    if args.wallet == 'both':
        clean_all_wallets(dry_run=not args.live)
    else:
        clean_wallet(args.wallet, dry_run=not args.live)
