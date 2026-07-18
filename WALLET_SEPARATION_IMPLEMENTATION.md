# Wallet Separation Implementation Plan

## Overview
Separate wallets for SWING vs SCALP strategies to prevent position stacking and enable clearer P&L tracking.

## Architecture Changes Required

### 1. Config Layer (DONE)
- ✅ `config_loader.py` - Added `get_swing_credentials()`, `get_scalp_credentials()`, `get_credentials_for_strategy()`
- ✅ `.env` - Added HYPERLIQUID_SWING_* and HYPERLIQUID_SCALP_* variables
- ✅ `strategy_registry.py` - Added `wallet_type` to strategy metadata

### 2. Trade Executor Layer
**File: `trade_executor.py`**

Modify `execute_signal()` function to accept wallet credentials:
```python
def execute_signal(signal: Dict, test_mode: bool = True, 
                   wallet_credentials: Dict = None) -> Optional[Trade]:
    """
    Execute a trading signal with optional wallet credentials.
    
    Args:
        signal: Trading signal dict
        test_mode: If True, simulate trades
        wallet_credentials: Optional dict with 'wallet', 'private_key', 'api_url'
                           If None, uses default from environment
    """
```

Modify `TradeExecutor` class to accept wallet credentials in constructor:
```python
class TradeExecutor:
    def __init__(self, risk_config: RiskConfig, 
                 wallet_credentials: Dict = None):
        self.risk = risk_config
        
        # Use provided credentials or fall back to environment
        if wallet_credentials:
            self.client = HyperliquidClient(
                wallet_address=wallet_credentials['wallet'],
                private_key=wallet_credentials['private_key'],
                api_url=wallet_credentials.get('api_url')
            )
        else:
            self.client = HyperliquidClient()  # Uses env vars
```

### 3. Signal Integrator Layer
**File: `signal_integrator.py`**

Modify `SignalIntegrator` to use correct wallet per strategy:
```python
from config_loader import get_credentials_for_strategy

class SignalIntegrator:
    def __init__(self, ...):
        # ... existing init ...
        # Create separate executors for swing and scalp
        self.swing_executor = None
        self.scalp_executor = None
        
    def _get_executor_for_strategy(self, strategy: str) -> TradeExecutor:
        """Get or create the appropriate executor for a strategy."""
        from config_loader import get_credentials_for_strategy
        
        creds = get_credentials_for_strategy(strategy)
        wallet_type = creds['wallet_type']
        
        if wallet_type == 'scalp':
            if self.scalp_executor is None:
                self.scalp_executor = TradeExecutor(
                    self.risk_config,
                    wallet_credentials=creds
                )
            return self.scalp_executor
        else:
            if self.swing_executor is None:
                self.swing_executor = TradeExecutor(
                    self.risk_config,
                    wallet_credentials=creds
                )
            return self.swing_executor
    
    def process_signal(self, signal: Dict, dry_run: bool = False) -> Optional[Dict]:
        # ... existing validation ...
        
        strategy = signal.get('strategy', 'unknown')
        
        # Get the correct executor for this strategy type
        executor = self._get_executor_for_strategy(strategy)
        
        # Pass executor to execute_signal or call executor method directly
        # ... rest of method ...
```

### 4. Orchestrator Layer
**File: `orchestrator.py`**

Already imports `get_credentials_for_strategy`. No changes needed if SignalIntegrator handles wallet selection.

### 5. Position/Account Management
**Files to update:**
- `get_positions_for_dashboard.py` - Query both wallets and merge results
- `get_account_info.py` - Aggregate info from both wallets
- `close_position.py` - Route close to correct wallet based on position metadata

### 6. Database Layer
**Add `wallet_type` column to:**
- `trading_positions` table
- `trades` table (if exists)
- `trade_executions` table

Update queries to include wallet_type for filtering and display.

### 7. Dashboard Layer
**Files to update:**
- `RiskSummary.jsx` - Show both wallet balances
- `PositionsTable.jsx` - Show wallet_type column
- `server/index.js` - Update endpoints to aggregate from both wallets

## Implementation Priority

1. **Phase 1: Config** ✅ DONE
2. **Phase 2: Core Trading Logic** (TradeExecutor, SignalIntegrator)
3. **Phase 3: Position Management** (get_positions, close_position)
4. **Phase 4: Database** (Add wallet_type columns)
5. **Phase 5: Dashboard** (UI updates)

## Testing Checklist

- [ ] Swing strategy trades go to swing wallet
- [ ] Scalp strategy trades go to scalp wallet
- [ ] Positions from both wallets display correctly
- [ ] Closing positions routes to correct wallet
- [ ] Account balances show both wallets
- [ ] No position stacking between strategy types
