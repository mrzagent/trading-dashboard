-- Migration: Add wallet_type columns for swing/scalp wallet separation
-- Run this SQL to update the database schema

-- Add wallet_type to trading_signals table
ALTER TABLE trading_signals 
ADD COLUMN IF NOT EXISTS wallet_type VARCHAR(10) DEFAULT 'swing';

-- Add wallet_type to strategy_signals table  
ALTER TABLE strategy_signals
ADD COLUMN IF NOT EXISTS wallet_type VARCHAR(10) DEFAULT 'swing';

-- Add wallet_type to trade_executions table
ALTER TABLE trade_executions
ADD COLUMN IF NOT EXISTS wallet_type VARCHAR(10) DEFAULT 'swing';

-- Add wallet_address to trade_executions table (to track which wallet executed)
ALTER TABLE trade_executions
ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(50);

-- Create index on wallet_type for faster queries
CREATE INDEX IF NOT EXISTS idx_trading_signals_wallet_type ON trading_signals(wallet_type);
CREATE INDEX IF NOT EXISTS idx_strategy_signals_wallet_type ON strategy_signals(wallet_type);
CREATE INDEX IF NOT EXISTS idx_trade_executions_wallet_type ON trade_executions(wallet_type);

-- Add comments explaining the columns
COMMENT ON COLUMN trading_signals.wallet_type IS 'Wallet type: swing (longer holds) or scalp (short holds)';
COMMENT ON COLUMN strategy_signals.wallet_type IS 'Wallet type: swing (longer holds) or scalp (short holds)';
COMMENT ON COLUMN trade_executions.wallet_type IS 'Wallet type used for execution: swing or scalp';
COMMENT ON COLUMN trade_executions.wallet_address IS 'Full wallet address that executed the trade';

-- Verify the changes
SELECT 
    table_name,
    column_name,
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('trading_signals', 'strategy_signals', 'trade_executions')
AND column_name IN ('wallet_type', 'wallet_address')
ORDER BY table_name, ordinal_position;
