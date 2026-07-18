#!/usr/bin/env python3
"""
Unified configuration loader for the trading system.

Loads environment variables from the project .env file.
All scripts should import from here instead of using os.environ directly.

Usage:
    from config_loader import DB_CONFIG, HYPERLIQUID_CONFIG, get_hyperliquid_credentials
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from the project directory (where this file lives)
PROJECT_DIR = Path(__file__).parent
ENV_PATH = PROJECT_DIR / ".env"

# Load the .env file
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)
else:
    raise FileNotFoundError(f"No .env file found at {ENV_PATH}. Please create one from .env.example")

# --- Database Configuration ---
DB_CONFIG = {
    "dbname": os.getenv("DB_NAME", "postgres"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", ""),
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "5432")),
}

# Legacy aliases for compatibility
DB_CONFIG_LEGACY = {
    "PGDATABASE": os.getenv("PGDATABASE", DB_CONFIG["dbname"]),
    "PGUSER": os.getenv("PGUSER", DB_CONFIG["user"]),
    "PGPASSWORD": os.getenv("PGPASSWORD", DB_CONFIG["password"]),
    "PGHOST": os.getenv("PGHOST", DB_CONFIG["host"]),
    "PGPORT": os.getenv("PGPORT", DB_CONFIG["port"]),
}

# --- HyperLiquid Configuration ---
HYPERLIQUID_ENV = os.getenv("HYPERLIQUID_ENV", "testnet")

HYPERLIQUID_CONFIG = {
    "testnet": {
        "private_key": os.getenv("HYPERLIQUID_TESTNET_PRIVATE_KEY", ""),
        "wallet": os.getenv("HYPERLIQUID_TESTNET_WALLET", ""),
        "api_url": "https://api.hyperliquid-testnet.xyz/info",
    },
    "mainnet": {
        "private_key": os.getenv("HYPERLIQUID_MAINNET_PRIVATE_KEY", ""),
        "wallet": os.getenv("HYPERLIQUID_MAINNET_WALLET", ""),
        "api_url": "https://api.hyperliquid.xyz/info",
    },
}

# --- Trading Parameters ---
TRADING_CONFIG = {
    "auto_trade": os.getenv("REUBEN_AUTO_TRADE", "false").lower() == "true",
    "portfolio_pct": float(os.getenv("REUBEN_PORTFOLIO_PCT", "0.02")),
    "leverage": int(os.getenv("REUBEN_LEVERAGE", "3")),
    "sl_pct": float(os.getenv("REUBEN_SL_PCT", "0.05")),
    "tp_pct": float(os.getenv("REUBEN_TP_PCT", "0.10")),
    "min_confidence": float(os.getenv("REUBEN_MIN_CONFIDENCE", "0.6")),
    "min_momentum": float(os.getenv("REUBEN_MIN_MOMENTUM", "0.3")),
}

# --- Data Collection ---
COLLECTION_CONFIG = {
    "interval_minutes": int(os.getenv("COLLECTION_INTERVAL_MINUTES", "5")),
}


def get_hyperliquid_credentials(env: str = None) -> dict:
    """
    Get HyperLiquid credentials for the specified environment.
    
    Args:
        env: 'testnet' or 'mainnet'. If None, uses HYPERLIQUID_ENV from .env
    
    Returns:
        dict with private_key, wallet, api_url
    """
    target_env = env or HYPERLIQUID_ENV
    if target_env not in HYPERLIQUID_CONFIG:
        raise ValueError(f"Invalid HyperLiquid environment: {target_env}. Use 'testnet' or 'mainnet'")
    
    creds = HYPERLIQUID_CONFIG[target_env].copy()
    creds["env"] = target_env
    return creds


def get_db_connection_string() -> str:
    """Return a PostgreSQL connection string."""
    return (
        f"postgresql://{DB_CONFIG['user']}:{DB_CONFIG['password']}"
        f"@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['dbname']}"
    )


# For backwards compatibility - set environment variables that legacy code expects
def sync_to_environ():
    """Sync config to os.environ for legacy code that reads directly from there."""
    os.environ.setdefault("DB_NAME", DB_CONFIG["dbname"])
    os.environ.setdefault("DB_USER", DB_CONFIG["user"])
    os.environ.setdefault("DB_PASSWORD", DB_CONFIG["password"])
    os.environ.setdefault("DB_HOST", DB_CONFIG["host"])
    os.environ.setdefault("DB_PORT", str(DB_CONFIG["port"]))
    
    # Legacy aliases
    os.environ.setdefault("PGDATABASE", DB_CONFIG["dbname"])
    os.environ.setdefault("PGUSER", DB_CONFIG["user"])
    os.environ.setdefault("PGPASSWORD", DB_CONFIG["password"])
    os.environ.setdefault("PGHOST", DB_CONFIG["host"])
    os.environ.setdefault("PGPORT", str(DB_CONFIG["port"]))
    
    # HyperLiquid aliases for trade_executor.py
    creds = get_hyperliquid_credentials()
    os.environ.setdefault("HYPERLIQUID_WALLET", creds["wallet"])
    os.environ.setdefault("HYPERLIQUID_PRIVATE_KEY", creds["private_key"])


# Auto-sync on import (can be disabled by setting TRADING_CONFIG_NO_SYNC=1)
if os.getenv("TRADING_CONFIG_NO_SYNC") != "1":
    sync_to_environ()


if __name__ == "__main__":
    # Test the config loader
    print("=" * 60)
    print("Trading App Configuration")
    print("=" * 60)
    print()
    print(f"Project directory: {PROJECT_DIR}")
    print(f".env file: {ENV_PATH} (exists: {ENV_PATH.exists()})")
    print()
    print("Database:")
    print(f"  Host: {DB_CONFIG['host']}:{DB_CONFIG['port']}")
    print(f"  Database: {DB_CONFIG['dbname']}")
    print(f"  User: {DB_CONFIG['user']}")
    print()
    print("HyperLiquid:")
    print(f"  Environment: {HYPERLIQUID_ENV}")
    creds = get_hyperliquid_credentials()
    print(f"  Wallet: {creds['wallet'][:20]}...")
    print(f"  API URL: {creds['api_url']}")
    print()
    print("Trading Params:")
    print(f"  Auto-trade: {TRADING_CONFIG['auto_trade']}")
    print(f"  Leverage: {TRADING_CONFIG['leverage']}x")
    print(f"  Position size: {TRADING_CONFIG['portfolio_pct']*100}%")
    print()
    print("Data Collection:")
    print(f"  Interval: {COLLECTION_CONFIG['interval_minutes']} minutes")
    print("=" * 60)
