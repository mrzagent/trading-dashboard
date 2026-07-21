#!/usr/bin/env python3
"""
Close ALL positions on both wallets to start fresh
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
logger = logging.getLogger('close_all')


def close_all_wallet_positions(wallet_type: str, dry_run: bool = True) -> list:
    """Close all positions on a specific wallet"""
    
    if wallet_type == 'swing':
        creds = get_credentials_for_strategy('rsi_mean_reversion')
    else:
        creds = get_credentials_for_strategy('fvg_proximity')
    
    logger.info(f"\n{'='*60}")
    logger.info(f"Closing ALL positions on {wallet_type.upper()} wallet")
    logger.info(f"Wallet: {creds['main_wallet']}")
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
                executor = TradeExecutor(
                    wallet_address=creds['agent_wallet'],
                    private_key=creds['agent_private_key'],
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
    
    if not closed_positions:
        logger.info(f"\nNo positions found in {wallet_type} wallet")
    else:
        total_value = sum(p['value'] for p in closed_positions)
        total_pnl = sum(p['pnl'] for p in closed_positions)
        logger.info(f"\n{'='*60}")
        logger.info(f"Summary for {wallet_type} wallet:")
        logger.info(f"  Positions closed: {len(closed_positions)}")
        logger.info(f"  Total value: ${total_value:.2f}")
        logger.info(f"  Total unrealized P&L: ${total_pnl:.2f}")
        logger.info(f"{'='*60}")
    
    return closed_positions


def close_all_positions(dry_run: bool = True) -> dict:
    """Close all positions on both wallets"""
    
    logger.info("\n" + "="*60)
    logger.info("CLOSING ALL POSITIONS")
    logger.info(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    logger.info("="*60)
    
    results = {
        'swing': close_all_wallet_positions('swing', dry_run),
        'scalp': close_all_wallet_positions('scalp', dry_run)
    }
    
    total_positions = sum(len(r) for r in results.values())
    total_value = sum(sum(p['value'] for p in r) for r in results.values())
    total_pnl = sum(sum(p['pnl'] for p in r) for r in results.values())
    
    logger.info("\n" + "="*60)
    logger.info("CLOSE ALL COMPLETE")
    logger.info(f"Total positions: {total_positions}")
    logger.info(f"Total value: ${total_value:.2f}")
    logger.info(f"Total unrealized P&L: ${total_pnl:.2f}")
    logger.info("="*60)
    
    return results


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Close all positions on both wallets')
    parser.add_argument('--live', action='store_true',
                        help='Actually close positions (default is dry-run)')
    parser.add_argument('--wallet', choices=['swing', 'scalp', 'both'], default='both',
                        help='Which wallet to close (default: both)')
    
    args = parser.parse_args()
    
    if args.wallet == 'both':
        close_all_positions(dry_run=not args.live)
    else:
        close_all_wallet_positions(args.wallet, dry_run=not args.live)
