# Trading Dashboard

A unified trading system with real-time dashboard for HyperLiquid exchange.

## Overview

This project combines:
- **Trading Engine**: Python-based automated trading system for HyperLiquid
- **Dashboard**: React + Vite frontend with Express API server
- **Data Collection**: Multi-timeframe OHLCV candle collection from HyperLiquid

## Project Structure

```
trading-dashboard/
├── .env                          # Configuration (database, API keys, trading params)
├── config_loader.py              # Unified configuration loader
├── candle_collector_hl.py        # HyperLiquid data collector (5min/1h/4h)
├── orchestrator.py               # Trading strategy orchestrator
├── trade_executor.py             # Order execution on HyperLiquid
├── db.py                         # Database utilities
├── strategy_registry.py          # Strategy metadata
├── close_position.py             # Position closing utility
├── get_positions_for_dashboard.py
├── get_account_info.py
├── ...
├── dashboard/                    # React + Express dashboard
│   ├── server/
│   │   └── index.js              # Express API server
│   ├── src/                      # React components
│   ├── package.json
│   └── ...
└── package.json                  # Root package.json with unified scripts
```

## Quick Start

### 1. Install Dependencies

```powershell
cd D:\dev\trading-dashboard

# Install dashboard dependencies
npm run install:all

# Or manually:
cd dashboard
npm install
```

### 2. Configure Environment

Edit `.env` file:

```env
# Database
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432

# HyperLiquid (testnet or mainnet)
HYPERLIQUID_ENV=testnet
HYPERLIQUID_TESTNET_PRIVATE_KEY=0x...
HYPERLIQUID_TESTNET_WALLET=0x...

# Trading Parameters
REUBEN_AUTO_TRADE=true
REUBEN_PORTFOLIO_PCT=0.02
REUBEN_LEVERAGE=3
```

### 3. Test Configuration

```powershell
# Test config loading
python config_loader.py

# Test database connection
npm run test:db
```

### 4. Start Development

```powershell
# Start both server and client (requires 'concurrently' package)
npm run dev

# Or start separately:
npm run server    # API server on :3001
npm run client    # Vite dev server on :5173
```

### 5. Build for Production

```powershell
npm run build
```

## Data Collection

The system collects data from HyperLiquid at multiple timeframes:

| Timeframe | Table | Schedule |
|-----------|-------|----------|
| 5min | `trading_prices` | Every 5 minutes |
| 1h | `trading_prices_1h` | Every hour |
| 4h | `trading_prices_4h` | Every 4 hours |

Run manually:
```powershell
python candle_collector_hl.py --timeframe 5min
```

Or set up Windows Scheduled Tasks (see `setup_scheduled_tasks.ps1`).

## Trading Strategies

10 strategies run via the orchestrator:

| Strategy | Timeframe | Style |
|----------|-----------|-------|
| rsi_mean_reversion | 4h | swing |
| momentum_rsi | 1h | swing |
| fvg_proximity | 5min | scalp |
| volume_spike | 5min | scalp |
| trend_breakout | 4h | swing |
| mean_reversion | 4h | swing |
| momentum_accel | 1h | swing |
| vwap_reversion | 5min | scalp |
| momentum_scalper | 5min | scalp |
| pullback_scalper | 5min | scalp |

## API Endpoints

The dashboard server provides:

- `GET /api/trading` - Latest prices and indicators
- `GET /api/trading/config` - Data source configuration
- `GET /api/trading/signals` - Trading signals
- `GET /api/trading/positions` - Open positions
- `GET /api/trading/health` - System health
- `POST /api/trading/close-position` - Close a position
- `GET /api/strategies` - Strategy metadata
- `GET /api/agents` - Agent statuses

## Configuration

All configuration is in `.env`:

| Variable | Description |
|----------|-------------|
| `DB_*` | PostgreSQL connection |
| `HYPERLIQUID_ENV` | `testnet` or `mainnet` |
| `HYPERLIQUID_*_PRIVATE_KEY` | Wallet private keys |
| `HYPERLIQUID_*_WALLET` | Wallet addresses |
| `REUBEN_*` | Trading parameters |
| `COLLECTION_INTERVAL_MINUTES` | Data collection interval |

## Changing Collection Interval

To switch from 5min to 1min candles:

1. Update `.env`:
   ```env
   COLLECTION_INTERVAL_MINUTES=1
   ```

2. Update `candle_collector_hl.py`:
   ```python
   "5min": {
       "hl_interval": "1m",  # Change from "5m"
       ...
   }
   ```

3. Update Windows Scheduled Task to run every 1 minute

4. Rebuild dashboard:
   ```powershell
   cd dashboard
   npm run build
   ```

## Security

- `.env` is in `.gitignore` - never commit it
- Private keys are only used server-side
- Dashboard only displays data, never exposes keys

## Troubleshooting

**Database connection failed:**
```powershell
# Check PostgreSQL is running
# Verify credentials in .env
python -c "from db import get_conn; conn = get_conn(); print('OK')"
```

**HyperLiquid connection failed:**
```powershell
# Test API connection
python -c "from config_loader import get_hyperliquid_credentials; print(get_hyperliquid_credentials())"
```

**Dashboard not loading:**
```powershell
# Check both servers are running
# API: http://localhost:3001/api/trading/config
# Client: http://localhost:5173
```

## License

Private - For personal use only.
