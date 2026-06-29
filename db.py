import os
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras
from decouple import config

DEFAULTS = {
    "dbname":   config("DB_NAME",      default="postgres"),
    "user":     config("DB_USER",      default="postgres"),
    "password": config("DB_PASSWORD",  default=""),
    "host":     config("DB_HOST",      default="localhost"),
    "port":     config("DB_PORT",      cast=int, default=5432),
}

# Coins tracked across all strategies
COINS = ["BTC", "ETH", "SOL"]


def get_conn():
    """Return a new psycopg2 connection using DEFAULTS."""
    return psycopg2.connect(**DEFAULTS)


_TF_TABLE = {
    "5min": "trading_prices",
    "1h":   "trading_prices_1h",
    "4h":   "trading_prices_4h",
}


def fetch_recent(conn, coin: str, limit: int = 150, timeframe: str = "5min"):
    """
    Fetch the most recent `limit` rows from the appropriate timeframe table.
    Returns a list of RealDictRow objects ordered oldest→newest.
    """
    table = _TF_TABLE.get(timeframe, "trading_prices")
    sql = f"""
        SELECT *
        FROM   {table}
        WHERE  coin = %s
        ORDER  BY captured_at DESC
        LIMIT  %s
    """
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, (coin, limit))
        rows = cur.fetchall()
    # Reverse so strategies see chronological order (oldest first)
    return list(reversed(rows))


def signal_envelope(strategy: str, coin: str, action: str,
                    confidence: float, reason: str,
                    extra: dict | None = None) -> dict:
    """
    Standard signal dict returned by every strategy's analyse() function.
    """
    return {
        "strategy":     strategy,
        "coin":         coin,
        "action":       action,          # "BUY" | "SELL" | "HOLD"
        "confidence":   float(confidence),
        "reason":       reason,
        "meta":         extra or {},
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
    }


def save_signal(conn, signal: dict, table: str = "strategy_signals") -> int:
    """
    Save a signal to the database.
    
    Args:
        conn: Database connection
        signal: Signal dict from signal_envelope()
        table: Target table name (default: strategy_signals)
    
    Returns:
        ID of the inserted row
    """
    import json
    
    sql = f"""
        INSERT INTO {table} (strategy, coin, action, confidence, reason, meta, generated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    """
    
    with conn.cursor() as cur:
        cur.execute(sql, (
            signal['strategy'],
            signal['coin'],
            signal['action'],
            signal['confidence'],
            signal['reason'],
            json.dumps(signal.get('meta', {})),
            signal.get('generated_at', datetime.now(tz=timezone.utc).isoformat())
        ))
        row_id = cur.fetchone()[0]
    
    conn.commit()
    return row_id


def create_trade_execution(conn, signal_id: int, coin: str, strategy: str, 
                           action: str, confidence: float) -> int:
    """
    Create a trade execution record to track the pipeline status.
    
    Args:
        conn: Database connection
        signal_id: ID of the corresponding signal in trading_signals
        coin: Trading pair (e.g., 'BTC', 'ETH')
        strategy: Strategy name
        action: 'BUY' or 'SELL'
        confidence: Signal confidence (0-1)
    
    Returns:
        ID of the created execution record
    """
    sql = """
        INSERT INTO trade_executions (signal_id, coin, strategy, action, confidence,
                                      signal_generated, signal_generated_at, status)
        VALUES (%s, %s, %s, %s, %s, TRUE, NOW(), 'pending')
        RETURNING id
    """
    with conn.cursor() as cur:
        cur.execute(sql, (signal_id, coin, strategy, action, confidence))
        execution_id = cur.fetchone()[0]
    conn.commit()
    return execution_id


def update_orchestrator_status(conn, execution_id: int, processed: bool, 
                               skip_reason: str = None):
    """
    Update the orchestrator processing status.
    
    Args:
        conn: Database connection
        execution_id: Trade execution ID
        processed: Whether the orchestrator processed the signal
        skip_reason: Reason if skipped (e.g., 'cooldown', 'position_exists')
    """
    sql = """
        UPDATE trade_executions 
        SET orchestrator_processed = %s,
            orchestrator_processed_at = NOW(),
            orchestrator_skip_reason = %s,
            status = CASE 
                WHEN %s = FALSE THEN 'skipped'
                ELSE status
            END
        WHERE id = %s
    """
    with conn.cursor() as cur:
        cur.execute(sql, (processed, skip_reason, processed, execution_id))
    conn.commit()


def update_hyperliquid_status(conn, execution_id: int, sent: bool, 
                              response: str = None, error: str = None, 
                              order_id: int = None):
    """
    Update the HyperLiquid order status.
    
    Args:
        conn: Database connection
        execution_id: Trade execution ID
        sent: Whether the order was sent to HyperLiquid
        response: 'success', 'failed', or 'pending'
        error: Error message if failed
        order_id: HyperLiquid order ID if successful
    """
    sql = """
        UPDATE trade_executions 
        SET hyperliquid_sent = %s,
            hyperliquid_sent_at = NOW(),
            hyperliquid_response = %s,
            hyperliquid_error = %s,
            hyperliquid_order_id = %s,
            status = CASE 
                WHEN %s = 'success' THEN 'success'
                WHEN %s = 'failed' THEN 'failed'
                ELSE status
            END
        WHERE id = %s
    """
    with conn.cursor() as cur:
        cur.execute(sql, (sent, response, error, order_id, response, response, execution_id))
    conn.commit()


def get_recent_executions(conn, limit: int = 50, coin: str = None) -> list:
    """
    Get recent trade executions with full pipeline status.
    
    Args:
        conn: Database connection
        limit: Maximum number of records to return
        coin: Optional filter by coin
    
    Returns:
        List of execution records
    """
    sql = """
        SELECT 
            te.id,
            te.signal_id,
            te.coin,
            te.strategy,
            te.action,
            te.confidence,
            te.signal_generated,
            te.signal_generated_at,
            te.orchestrator_processed,
            te.orchestrator_processed_at,
            te.orchestrator_skip_reason,
            te.hyperliquid_sent,
            te.hyperliquid_sent_at,
            te.hyperliquid_response,
            te.hyperliquid_error,
            te.hyperliquid_order_id,
            te.status,
            te.created_at,
            ts.meta as signal_meta
        FROM trade_executions te
        LEFT JOIN trading_signals ts ON te.signal_id = ts.id
        WHERE 1=1
    """
    params = []
    
    if coin:
        sql += " AND te.coin = %s"
        params.append(coin)
    
    sql += " ORDER BY te.created_at DESC LIMIT %s"
    params.append(limit)
    
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()
    return rows
