# Configuration Migration Complete

## Summary

The trading system now uses a **project-based `.env` file** instead of depending on the global `~/.openclaw/.env`.

---

## Files Changed

| File | Change |
|------|--------|
| `.env` | Updated with legacy aliases and new config options |
| `config_loader.py` | **NEW** — Unified config loader module |
| `db.py` | Now imports from `config_loader` |
| `candle_collector_hl.py` | Now imports from `config_loader` |
| `candle_collector.py` | Now imports from `config_loader` |
| `fetch_binance_5min.py` | Now imports from `config_loader` |
| `fetch_binance_historical.py` | Now imports from `config_loader` |
| `trade_executor.py` | Now imports from `config_loader` (removed `~/.openclaw/.env` dependency) |

---

## Architecture

```
Project .env (D:\dev\trading\.env)
    ↓
config_loader.py (loads & exposes config)
    ↓
All other modules import from config_loader
```

**No dependency on `~/.openclaw/.env` anymore.**

---

## Testing

```powershell
cd D:\dev\trading

# Test config loader
python config_loader.py

# Test DB connection
python -c "from db import get_conn; conn = get_conn(); print('OK'); conn.close()"

# Test collector (dry run)
python candle_collector_hl.py --timeframe 5min --no-db --json
```

---

## To Change Collection Interval (e.g., 5min → 1min)

1. **Update `.env`:**
   ```
   COLLECTION_INTERVAL_MINUTES=1
   ```

2. **Update `candle_collector_hl.py` TF_CONFIG:**
   ```python
   "5min": {
       "hl_interval": "1m",  # was "5m"
       ...
   }
   ```

3. **Update Windows Scheduled Task** to run every 1 minute instead of 5.

4. **Update dashboard** `index.js`:
   ```javascript
   const COLLECTION_INTERVAL_MINUTES = 1;
   ```

5. **Rebuild frontend:**
   ```powershell
   cd D:\dev\agent_dashboard
   npm run build
   ```

---

## Environment Variables

### Database (all scripts use these)
```
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=***
DB_HOST=localhost
DB_PORT=5432

# Legacy aliases (for compatibility)
PGDATABASE=postgres
PGUSER=postgres
PGPASSWORD=***
PGHOST=localhost
PGPORT=5432
```

### HyperLiquid
```
HYPERLIQUID_ENV=testnet  # or 'mainnet'

HYPERLIQUID_TESTNET_PRIVATE_KEY=...
HYPERLIQUID_TESTNET_WALLET=...

HYPERLIQUID_MAINNET_PRIVATE_KEY=...
HYPERLIQUID_MAINNET_WALLET=...

# Convenience aliases (auto-set from active env)
HYPERLIQUID_WALLET=...
HYPERLIQUID_PRIVATE_KEY=...
```

### Trading Parameters
```
REUBEN_AUTO_TRADE=true
REUBEN_PORTFOLIO_PCT=0.02
REUBEN_LEVERAGE=3
REUBEN_SL_PCT=0.05
REUBEN_TP_PCT=0.10
REUBEN_MIN_CONFIDENCE=0.6
REUBEN_MIN_MOMENTUM=0.3
```

### Data Collection
```
COLLECTION_INTERVAL_MINUTES=5
```

---

## Security

- `.env` is in `.gitignore` (do not commit)
- Each project has its own isolated configuration
- No cross-contamination with OpenClaw's global env
