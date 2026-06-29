-- Create table to track trade execution pipeline status
CREATE TABLE IF NOT EXISTS trade_executions (
    id SERIAL PRIMARY KEY,
    signal_id INTEGER REFERENCES trading_signals(id),
    coin VARCHAR(10) NOT NULL,
    strategy VARCHAR(50) NOT NULL,
    action VARCHAR(10) NOT NULL,
    confidence DECIMAL(5,4) NOT NULL,
    
    -- Pipeline stages
    signal_generated BOOLEAN DEFAULT TRUE,
    signal_generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    orchestrator_processed BOOLEAN DEFAULT FALSE,
    orchestrator_processed_at TIMESTAMP WITH TIME ZONE,
    orchestrator_skip_reason VARCHAR(100),
    
    hyperliquid_sent BOOLEAN DEFAULT FALSE,
    hyperliquid_sent_at TIMESTAMP WITH TIME ZONE,
    
    hyperliquid_response VARCHAR(20), -- 'success', 'failed', 'pending'
    hyperliquid_error TEXT,
    hyperliquid_order_id BIGINT,
    
    -- Final status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'success', 'failed', 'skipped'
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_trade_executions_signal_id ON trade_executions(signal_id);
CREATE INDEX IF NOT EXISTS idx_trade_executions_status ON trade_executions(status);
CREATE INDEX IF NOT EXISTS idx_trade_executions_created_at ON trade_executions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_executions_coin ON trade_executions(coin);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_trade_executions_updated_at ON trade_executions;
CREATE TRIGGER update_trade_executions_updated_at
    BEFORE UPDATE ON trade_executions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
