# Architectural Change Analysis: Separate Wallets for Swing vs Scalp Strategies

## Current State

### Wallet Configuration (config_loader.py)
```
HYPERLIQUID_TESTNET_PRIVATE_KEY=xxx
HYPERLIQUID_TESTNET_WALLET=xxx
HYPERLIQUID_MAINNET_PRIVATE_KEY=xxx
HYPERLIQUID_MAINNET_WALLET=xxx
```

All strategies use the same wallet regardless of type.

### Strategy Classification by Type

**SWING Strategies (longer hold times, fewer trades):**
1. `strategy_fvg` (FVG Breakout) - 15m, avg hold 29.3h
2. `strategy_volume` (Volume Spike) - 15m, avg hold 27.1h
3. `strategy_trend_breakout` (Trend Breakout) - 4h, avg hold 90.1h
4. `strategy_mean_reversion` (Mean Reversion) - 1h/4h

**SCALP Strategies (short hold times, frequent trades):**
1. `strategy_momentum_scalper` (Momentum Scalper) - 5m
2. `strategy_pullback_scalper` (Pullback Scalper) - 5m/15m
3. `strategy_vwap_reversion` (VWAP Reversion) - 5m, avg hold 18.7h

**TREND/OTHER (can be grouped with SWING):**
1. `strategy_rsi` (RSI Confluence) - 15m/1h
2. `strategy_momentum` (Momentum) - 1h
3. `strategy_momentum_accel` (Momentum Acceleration) - 1h

## Problem
All strategies trade into the same HyperLiquid account, causing:
- Position stacking (multiple strategies adding to same position)
- Unclear P&L attribution per strategy type
- Risk management confusion
- Difficult to track which strategy opened which position

## Proposed Solution

### 1. New Wallet Structure
```
# SWING Trading Wallets (testnet + mainnet)
HYPERLIQUID_SWING_TESTNET_PRIVATE_KEY=xxx
HYPERLIQUID_SWING_TESTNET_WALLET=xxx
HYPERLIQUID_SWING_MAINNET_PRIVATE_KEY=xxx
HYPERLIQUID_SWING_MAINNET_WALLET=xxx

# SCALP Trading Wallets (testnet + mainnet)
HYPERLIQUID_SCALP_TESTNET_PRIVATE_KEY=xxx
HYPERLIQUID_SCALP_TESTNET_WALLET=xxx
HYPERLIQUID_SCALP_MAINNET_PRIVATE_KEY=xxx
HYPERLIQUID_SCALP_MAINNET_WALLET=xxx
```

### 2. Files to Modify

#### Core Configuration
- [ ] `config_loader.py` - Add swing/scalp wallet configs
- [ ] `.env` - Add new wallet environment variables

#### Strategy Registry
- [ ] `strategy_registry.py` - Add wallet_type field to metadata

#### Orchestrator
- [ ] `orchestrator.py` - Route signals to correct wallet based on strategy type

#### Trade Executor
- [ ] `trade_executor.py` - Accept wallet credentials as parameters instead of env vars

#### Position Management
- [ ] `get_positions_for_dashboard.py` - Fetch positions from both wallets
- [ ] `close_position.py` - Route close to correct wallet
- [ ] `get_account_info.py` - Aggregate account info from both wallets

#### Dashboard
- [ ] `dashboard/server/index.js` - Update account/positions endpoints
- [ ] `RiskSummary.jsx` - Show both wallet balances
- [ ] `PositionsTable.jsx` - Show which wallet each position belongs to

#### Database
- [ ] Add `wallet_type` column to trades/positions tables
- [ ] Track which wallet opened each trade

### 3. Data Flow Changes

**Current Flow:**
```
Strategy → Signal → Orchestrator → Trade Executor → Single Wallet
```

**New Flow:**
```
Strategy → Signal → Orchestrator → Route by Type → Trade Executor → Swing Wallet OR Scalp Wallet
```

### 4. Implementation Steps

1. **Phase 1: Configuration**
   - Update config_loader.py with new wallet structure
   - Update .env with 4 new wallet addresses
   - Update strategy_registry.py with wallet_type metadata

2. **Phase 2: Core Logic**
   - Modify orchestrator.py to route by strategy type
   - Modify trade_executor.py to accept wallet params
   - Update position/account scripts to handle multiple wallets

3. **Phase 3: Database**
   - Add wallet_type column to relevant tables
   - Update db.py queries

4. **Phase 4: Dashboard**
   - Update server endpoints
   - Update UI components to show wallet separation

5. **Phase 5: Testing**
   - Test swing trades go to swing wallet
   - Test scalp trades go to scalp wallet
   - Verify position tracking works correctly

## Benefits

1. **Clear Position Attribution** - Know exactly which strategy type opened each position
2. **Independent Risk Management** - Different position sizing per wallet
3. **Better P&L Tracking** - Separate performance metrics for swing vs scalp
4. **No More Stacking** - Strategies can't interfere with each other
5. **Easier Debugging** - Isolated wallets make troubleshooting simpler

## Risks

1. **Capital Split** - Need to fund both wallets separately
2. **Complexity** - More moving parts to manage
3. **Migration** - Need to close existing positions before switching
