#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
candle_collector_hl.py — Multi-timeframe OHLCV candle collector for BTC, ETH, SOL.

Fetches market data from HyperLiquid (the exchange we trade on) and writes into tables:
  5min  → trading_prices
  1h    → trading_prices_1h
  4h    → trading_prices_4h

Usage:
    python candle_collector_hl.py --timeframe 5min
    python candle_collector_hl.py --timeframe 1h
    python candle_collector_hl.py --timeframe 4h   [--no-db] [--quiet] [--json]

Scheduled tasks:
    TradingCollect5min  — every 5  min
    TradingCollect1h    — every 60 min
    TradingCollect4h    — every 240 min
"""

import urllib.request
import urllib.error
import json
import sys
import io
import argparse
import os
import time
from datetime import datetime, timezone

try:
    import psycopg2
    import psycopg2.extras
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

# ── Config ────────────────────────────────────────────────────────────────────
# Import from unified config loader (loads from project .env)
from config_loader import DB_CONFIG, COLLECTION_CONFIG

COINS = ["BTC", "ETH", "SOL"]
HL_API_URL = "https://api.hyperliquid.xyz/info"

RSI_PERIOD    = 14
FVG_LOOKBACK  = 50

# Map timeframe to HyperLiquid interval and candle count needed
TF_CONFIG = {
    "5min": {
        "table":          "trading_prices",
        "hl_interval":    "5m",
        "candle_count":   100,      # Need ~50 for RSI + FVG
        "rsi_period":     14,
        "momentum_look":  10,
        "fvg_lookback":   50,
    },
    "1h": {
        "table":          "trading_prices_1h",
        "hl_interval":    "1h",
        "candle_count":   100,
        "rsi_period":     14,
        "momentum_look":  10,
        "fvg_lookback":   50,
    },
    "4h": {
        "table":          "trading_prices_4h",
        "hl_interval":    "4h",
        "candle_count":   100,
        "rsi_period":     14,
        "momentum_look":  10,
        "fvg_lookback":   50,
    },
}

# ── DB Config ─────────────────────────────────────────────────────────────────
# Use config from config_loader (loaded from project .env)
DB_HOST     = DB_CONFIG["host"]
DB_PORT     = DB_CONFIG["port"]
DB_USER     = DB_CONFIG["user"]
DB_PASSWORD = DB_CONFIG["password"]
DB_NAME     = DB_CONFIG["dbname"]

CREATE_TABLE_TEMPLATE = """
CREATE TABLE IF NOT EXISTS {table} (
    id              SERIAL PRIMARY KEY,
    captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    coin            TEXT NOT NULL,
    price           NUMERIC(20,8),
    change_24h      NUMERIC(10,4),
    volume_24h      NUMERIC(20,2),
    volume_candle   NUMERIC(20,2),
    market_cap      NUMERIC(20,2),
    rsi             NUMERIC(6,2),
    momentum        NUMERIC(10,4),
    fvg_count       INT,
    fvg_data        JSONB,
    alert_triggered BOOLEAN DEFAULT FALSE,
    raw_data        JSONB,
    high_price      NUMERIC(20,8),
    low_price       NUMERIC(20,8),
    open_price      NUMERIC(20,8)
);
"""

INSERT_ROW_TEMPLATE = """
INSERT INTO {table}
    (captured_at, coin, price, change_24h, volume_24h, volume_candle, market_cap,
     rsi, momentum, fvg_count, fvg_data, alert_triggered, raw_data,
     high_price, low_price, open_price)
VALUES
    (%(captured_at)s, %(coin)s, %(price)s, %(change_24h)s, %(volume_24h)s,
     %(volume_candle)s, %(market_cap)s, %(rsi)s, %(momentum)s, %(fvg_count)s,
     %(fvg_data)s, %(alert_triggered)s, %(raw_data)s,
     %(high_price)s, %(low_price)s, %(open_price)s)
"""

# ── HyperLiquid API helpers ───────────────────────────────────────────────────
def hl_post(payload: dict) -> dict:
    """POST request to HyperLiquid API."""
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        HL_API_URL,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

def fetch_all_mids() -> dict:
    """Fetch current mark prices for all coins."""
    return hl_post({"type": "allMids"})

def fetch_candles(coin: str, interval: str, count: int = 100) -> list[dict]:
    """
    Fetch candles from HyperLiquid.
    Returns list of {t, T, s, i, o, c, h, l, v, n} candles.
    """
    # Get candles - request more than needed to ensure we have enough history
    # HL returns up to 5000 candles, we just need the last `count`
    end_time = int(datetime.now(timezone.utc).timestamp() * 1000)
    start_time = end_time - (count * 2 * interval_to_ms(interval))
    
    result = hl_post({
        "type": "candleSnapshot",
        "req": {
            "coin": coin,
            "interval": interval,
            "startTime": start_time,
            "endTime": end_time
        }
    })
    
    # Result is a list of candles
    if not isinstance(result, list):
        return []
    
    # Normalize to our expected format
    candles = []
    for c in result:
        candles.append({
            "t": c["t"],           # start time ms
            "T": c["T"],           # end time ms
            "o": float(c["o"]),    # open
            "h": float(c["h"]),    # high
            "l": float(c["l"]),    # low
            "c": float(c["c"]),    # close
            "v": float(c["v"]),    # volume
            "n": c.get("n", 0),    # number of trades
        })
    
    return candles

def interval_to_ms(interval: str) -> int:
    """Convert HL interval string to milliseconds."""
    mapping = {
        "1m": 60 * 1000,
        "5m": 5 * 60 * 1000,
        "15m": 15 * 60 * 1000,
        "1h": 60 * 60 * 1000,
        "4h": 4 * 60 * 60 * 1000,
        "1d": 24 * 60 * 60 * 1000,
    }
    return mapping.get(interval, 5 * 60 * 1000)

def fetch_24h_volume(coin: str) -> float:
    """Fetch 24h volume from HL metaAndAssetCtxs."""
    try:
        result = hl_post({"type": "metaAndAssetCtxs"})
        # Result is [meta, asset_ctxs]
        if len(result) < 2:
            return 0.0
        
        meta = result[0]
        asset_ctxs = result[1]
        
        # Find coin index in universe
        universe = meta.get("universe", [])
        coin_idx = None
        for i, asset in enumerate(universe):
            if asset.get("name") == coin:
                coin_idx = i
                break
        
        if coin_idx is not None and coin_idx < len(asset_ctxs):
            ctx = asset_ctxs[coin_idx]
            # dayNtlVlm is daily volume in USD
            return float(ctx.get("dayNtlVlm", 0))
    except Exception:
        pass
    return 0.0

# ── Indicators ────────────────────────────────────────────────────────────────
def compute_rsi(candles: list[dict], period: int = RSI_PERIOD) -> float | None:
    closes = [c["c"] for c in candles]
    if len(closes) < period + 1:
        return None
    gains, losses = [], []
    for i in range(1, len(closes)):
        diff = closes[i] - closes[i - 1]
        gains.append(max(diff, 0))
        losses.append(max(-diff, 0))
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100 - (100 / (1 + rs)), 2)

def compute_momentum(candles: list[dict], lookback: int = 10) -> float | None:
    closes = [c["c"] for c in candles]
    if len(closes) < lookback + 1:
        return None
    old = closes[-(lookback + 1)]
    now = closes[-1]
    if old == 0:
        return None
    return round((now - old) / old * 100, 4)

def compute_24h_change(candles: list[dict]) -> float | None:
    """Compute 24h change % from candles if available."""
    if len(candles) < 2:
        return None
    # Find candle closest to 24h ago
    now_ms = datetime.now(timezone.utc).timestamp() * 1000
    target_ms = now_ms - (24 * 60 * 60 * 1000)
    
    closest = None
    closest_diff = float('inf')
    for c in candles:
        diff = abs(c["t"] - target_ms)
        if diff < closest_diff:
            closest_diff = diff
            closest = c
    
    if closest is None:
        return None
    
    current = candles[-1]["c"]
    past = closest["c"]
    if past == 0:
        return None
    return round((current - past) / past * 100, 4)

def find_fvgs(candles: list[dict], lookback: int = FVG_LOOKBACK) -> list[dict]:
    recent = candles[-lookback:] if len(candles) >= lookback else candles
    fvgs = []
    for i in range(1, len(recent) - 1):
        prev, curr, nxt = recent[i - 1], recent[i], recent[i + 1]
        if prev["h"] < nxt["l"]:
            fvgs.append({
                "type":      "bullish",
                "bottom":    prev["h"],
                "top":       nxt["l"],
                "midpoint":  round((prev["h"] + nxt["l"]) / 2, 2),
                "formed_at": datetime.fromtimestamp(curr["t"] / 1000, tz=timezone.utc)
                              .strftime("%Y-%m-%d %H:%M UTC"),
            })
        elif prev["l"] > nxt["h"]:
            fvgs.append({
                "type":      "bearish",
                "top":       prev["l"],
                "bottom":    nxt["h"],
                "midpoint":  round((prev["l"] + nxt["h"]) / 2, 2),
                "formed_at": datetime.fromtimestamp(curr["t"] / 1000, tz=timezone.utc)
                              .strftime("%Y-%m-%d %H:%M UTC"),
            })
    return fvgs[-5:]

# ── DB helpers ────────────────────────────────────────────────────────────────
def get_db_conn():
    return psycopg2.connect(
        host=DB_HOST, port=DB_PORT,
        user=DB_USER, password=DB_PASSWORD,
        dbname=DB_NAME, connect_timeout=10,
    )

def ensure_table(conn, table: str):
    with conn.cursor() as cur:
        cur.execute(CREATE_TABLE_TEMPLATE.format(table=table))
    conn.commit()

def write_rows(conn, table: str, rows: list[dict]):
    sql = INSERT_ROW_TEMPLATE.format(table=table)
    with conn.cursor() as cur:
        for row in rows:
            cur.execute(sql, row)
    conn.commit()

# ── Core collection ───────────────────────────────────────────────────────────
def collect(timeframe: str, quiet: bool = False, no_db: bool = False,
            as_json: bool = False, alert_threshold: float = 5.0) -> dict:
    cfg = TF_CONFIG[timeframe]
    table = cfg["table"]
    now_utc = datetime.now(tz=timezone.utc)

    # Fetch current prices for all coins
    try:
        all_mids = fetch_all_mids()
    except Exception as e:
        msg = f"ERROR fetching prices from HyperLiquid: {e}"
        print(msg, file=sys.stderr)
        sys.exit(1)

    results = {}
    for coin in COINS:
        price = float(all_mids.get(coin, 0))
        
        # Fetch candles for indicators
        try:
            candles = fetch_candles(coin, cfg["hl_interval"], cfg["candle_count"])
            rsi = compute_rsi(candles, cfg["rsi_period"])
            momentum = compute_momentum(candles, cfg["momentum_look"])
            fvgs = [] if quiet else find_fvgs(candles, cfg["fvg_lookback"])
            change_24h = compute_24h_change(candles)
            
            # Get volume from latest candle
            vol_candle = round(candles[-1]["v"], 2) if candles else None
            
            # OHLC from latest candle
            last_candle = candles[-1] if candles else None
            high_price = round(last_candle["h"], 8) if last_candle else None
            low_price = round(last_candle["l"], 8) if last_candle else None
            open_price = round(last_candle["o"], 8) if last_candle else None
        except Exception as e:
            print(f"  [warn] {coin} indicator fetch failed: {e}", file=sys.stderr)
            candles, rsi, momentum, fvgs = [], None, None, []
            change_24h, vol_candle = None, None
            high_price, low_price, open_price = None, None, None
        
        # Fetch 24h volume separately
        try:
            volume_24h = fetch_24h_volume(coin)
        except Exception:
            volume_24h = 0.0
        
        # Alert on significant moves
        alert = abs(change_24h or 0) >= alert_threshold

        results[coin] = {
            "ticker":        coin,
            "price":         price,
            "change_24h":    change_24h,
            "volume_24h":    volume_24h,
            "volume_candle": vol_candle,
            "market_cap":    None,  # HL doesn't provide market cap
            "rsi":           rsi,
            "momentum":      momentum,
            "fvg_count":     len(fvgs),
            "fvg_data":      fvgs,
            "alert":         alert,
            "high_price":    high_price,
            "low_price":     low_price,
            "open_price":    open_price,
        }

    db_ok = False
    db_error = None
    if not no_db:
        if not HAS_PSYCOPG2:
            db_error = "psycopg2 not installed"
            print(f"[warn] {db_error}", file=sys.stderr)
        else:
            try:
                conn = get_db_conn()
                ensure_table(conn, table)

                db_rows = []
                for coin, r in results.items():
                    db_rows.append({
                        "captured_at":   now_utc,
                        "coin":          coin,
                        "price":         r["price"],
                        "change_24h":    r["change_24h"],
                        "volume_24h":    r["volume_24h"],
                        "volume_candle": r["volume_candle"],
                        "market_cap":    r["market_cap"],
                        "rsi":           r["rsi"],
                        "momentum":      r["momentum"],
                        "fvg_count":     r["fvg_count"],
                        "fvg_data":      json.dumps(r["fvg_data"]),
                        "alert_triggered": r["alert"],
                        "raw_data":      json.dumps({"source": "hyperliquid", "price": r["price"]}),
                        "high_price":    r.get("high_price"),
                        "low_price":     r.get("low_price"),
                        "open_price":    r.get("open_price"),
                    })

                write_rows(conn, table, db_rows)
                conn.close()
                db_ok = True

                if not quiet:
                    print(f"[{timeframe}] Wrote {len(db_rows)} rows to {table}", file=sys.stderr)
            except Exception as e:
                db_error = str(e)
                print(f"[warn] DB write failed: {e}", file=sys.stderr)

    if as_json:
        output = {
            "timeframe":    timeframe,
            "table":        table,
            "timestamp":    now_utc.isoformat(),
            "db_written":   db_ok,
            "db_error":     db_error,
            "source":       "hyperliquid",
            "coins":        results,
        }
        print(json.dumps(output, indent=2, default=str))

    return {"db_ok": db_ok, "db_error": db_error, "rows": len(results)}


# ── CLI ───────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="HyperLiquid candle collector")
    parser.add_argument("--timeframe", choices=["5min", "1h", "4h"], required=True,
                        help="Timeframe to collect: 5min | 1h | 4h")
    parser.add_argument("--quiet",  action="store_true", help="Skip FVG (faster)")
    parser.add_argument("--json",   action="store_true", help="Output JSON to stdout")
    parser.add_argument("--no-db",  action="store_true", help="Dry run — skip DB write")
    parser.add_argument("--alert-threshold", type=float, default=5.0)
    args = parser.parse_args()

    result = collect(
        timeframe=args.timeframe,
        quiet=args.quiet,
        no_db=args.no_db,
        as_json=args.json,
        alert_threshold=args.alert_threshold,
    )

    if not args.json and not args.quiet:
        status = "OK" if result["db_ok"] else f"FAILED: {result['db_error']}"
        print(f"[{args.timeframe}] DB: {status} | {result['rows']} coins", file=sys.stderr)

    sys.exit(0 if result["db_ok"] or args.no_db else 1)


if __name__ == "__main__":
    main()
