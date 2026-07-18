const express = require('express');
const cors = require('cors');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { Pool } = require('pg');
const { spawn } = require('child_process');

const app = express();
const PORT = 3001;

// Path Configuration
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const PYTHON_PATH = 'C:\\Users\\mrztms\\AppData\\Local\\Python\\pythoncore-3.14-64\\python.exe';

app.use(cors());
app.use(express.json());

// Database pool for trading data
const tradingPool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: '1870506303979',
  database: 'postgres',
});

// Data Source Config
const DATA_SOURCE = { name: 'HyperLiquid', url: 'https://hyperliquid.xyz' };
const COINS = ['BTC', 'ETH', 'SOL'];
const COLLECTION_INTERVAL_MINUTES = 5;

// Technical indicator helpers
function calcRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(2));
}

async function calcTimeframeRSI(coin, timeframe) {
  const candlesNeeded = timeframe === '1h' ? 12 : timeframe === '4h' ? 48 : null;
  if (!candlesNeeded) return null;
  const idealTotal = candlesNeeded * 15;
  
  try {
    const result = await tradingPool.query(
      `SELECT price FROM trading_prices 
       WHERE coin = $1 
       ORDER BY captured_at DESC 
       LIMIT ${idealTotal}`,
      [coin]
    );
    
    if (result.rows.length < candlesNeeded + 1) return null;
    
    const closes = [];
    for (let i = result.rows.length - 1; i >= 0; i -= candlesNeeded) {
      closes.push(parseFloat(result.rows[i].price));
    }
    closes.reverse();
    
    const availablePeriods = closes.length - 1;
    const rsiPeriod = Math.min(14, Math.max(7, Math.floor(availablePeriods * 0.9)));
    
    if (closes.length < rsiPeriod + 1) return null;
    return calcRSI(closes, rsiPeriod);
  } catch (err) {
    console.error(`Error calculating ${timeframe} RSI for ${coin}:`, err);
    return null;
  }
}

function calcMomentum(prices, period = 10) {
  if (prices.length < period + 1) return null;
  const current = prices[prices.length - 1];
  const prev = prices[prices.length - 1 - period];
  return parseFloat(((current - prev) / prev * 100).toFixed(4));
}

function calcFVG(prices, period = 10) {
  const fvgList = [];
  for (let i = 2; i < prices.length && fvgList.length < 3; i++) {
    const prevHigh = Math.max(prices[i-2], prices[i-1]);
    const prevLow = Math.min(prices[i-2], prices[i-1]);
    const currHigh = prices[i];
    const currLow = prices[i];
    if (currLow > prevHigh) {
      fvgList.push({ type: 'bullish', low: prevHigh, high: currLow, timestamp: i });
    } else if (currHigh < prevLow) {
      fvgList.push({ type: 'bearish', low: currHigh, high: prevLow, timestamp: i });
    }
  }
  return fvgList;
}

function formatTimeAgo(minutes) {
  if (!minutes) return 'just now';
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${Math.round(minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m ago`;
}

// Trading prices endpoints
app.get('/api/trading', async (req, res) => {
  try {
    const latestResult = await tradingPool.query(
      `WITH latest AS (
        SELECT DISTINCT ON (coin) * FROM trading_prices ORDER BY coin, captured_at DESC
      ),
      hist_5m AS (
        SELECT DISTINCT ON (coin) coin, price AS price_5m FROM trading_prices
        WHERE captured_at BETWEEN NOW() - INTERVAL '8 minutes' AND NOW() - INTERVAL '2 minutes'
        ORDER BY coin, ABS(EXTRACT(EPOCH FROM (captured_at - (NOW() - INTERVAL '5 minutes'))))
      ),
      hist_1h AS (
        SELECT DISTINCT ON (coin) coin, price AS price_1h FROM trading_prices
        WHERE captured_at BETWEEN NOW() - INTERVAL '70 minutes' AND NOW() - INTERVAL '50 minutes'
        ORDER BY coin, ABS(EXTRACT(EPOCH FROM (captured_at - (NOW() - INTERVAL '60 minutes'))))
      ),
      hist_4h AS (
        SELECT DISTINCT ON (coin) coin, price AS price_4h FROM trading_prices
        WHERE captured_at BETWEEN NOW() - INTERVAL '250 minutes' AND NOW() - INTERVAL '230 minutes'
        ORDER BY coin, ABS(EXTRACT(EPOCH FROM (captured_at - (NOW() - INTERVAL '240 minutes'))))
      )
      SELECT
        l.*,
        CASE WHEN h5.price_5m IS NOT NULL
          THEN ROUND(((l.price - h5.price_5m) / h5.price_5m * 100)::numeric, 2)
          ELSE NULL END AS change_5min,
        CASE WHEN h1.price_1h IS NOT NULL
          THEN ROUND(((l.price - h1.price_1h) / h1.price_1h * 100)::numeric, 2)
          ELSE NULL END AS change_1h,
        CASE WHEN h4.price_4h IS NOT NULL
          THEN ROUND(((l.price - h4.price_4h) / h4.price_4h * 100)::numeric, 2)
          ELSE NULL END AS change_4h
      FROM latest l
      LEFT JOIN hist_5m h5 ON l.coin = h5.coin
      LEFT JOIN hist_1h h1 ON l.coin = h1.coin
      LEFT JOIN hist_4h h4 ON l.coin = h4.coin
      ORDER BY l.coin`
    );
    
    const coins = latestResult.rows.map(r => r.coin);
    const rsiData = {};
    for (const coin of coins) {
      rsiData[coin] = {
        rsi_1h: await calcTimeframeRSI(coin, '1h'),
        rsi_4h: await calcTimeframeRSI(coin, '4h')
      };
    }
    
    const enrichedRows = latestResult.rows.map(row => ({
      ...row,
      rsi_1h: rsiData[row.coin]?.rsi_1h,
      rsi_4h: rsiData[row.coin]?.rsi_4h
    }));
    
    const historyResult = await tradingPool.query(
      `SELECT * FROM trading_prices ORDER BY captured_at DESC LIMIT 5`
    );
    res.json({
      latest: enrichedRows,
      history: historyResult.rows,
    });
  } catch (err) {
    console.error('Trading DB error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

app.get('/api/trading/history', async (req, res) => {
  try {
    const minutes = req.query.minutes ? parseInt(req.query.minutes, 10) : null;
    let rows;
    if (!minutes || isNaN(minutes)) {
      const result = await tradingPool.query(
        `SELECT DISTINCT ON (coin) * FROM trading_prices ORDER BY coin, captured_at DESC`
      );
      rows = result.rows;
    } else {
      const result = await tradingPool.query(
        `SELECT DISTINCT ON (coin) *
         FROM trading_prices
         WHERE captured_at BETWEEN (NOW() - ($1::int * INTERVAL '1 minute') - INTERVAL '10 minutes')
                               AND (NOW() - ($1::int * INTERVAL '1 minute') + INTERVAL '10 minutes')
         ORDER BY coin, ABS(EXTRACT(EPOCH FROM (captured_at - (NOW() - ($1::int * INTERVAL '1 minute')))))`,
        [minutes]
      );
      rows = result.rows;
    }
    res.json(rows);
  } catch (err) {
    console.error('Trading history DB error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

app.get('/api/trading/config', (req, res) => {
  res.json({
    source: DATA_SOURCE,
    coins: COINS,
    collectionIntervalMinutes: COLLECTION_INTERVAL_MINUTES,
    timeframes: {
      '5min': { table: 'trading_prices', interval: '5m' },
      '1h': { table: 'trading_prices_1h', interval: '1h' },
      '4h': { table: 'trading_prices_4h', interval: '4h' }
    },
    note: 'To change interval, update candle_collector_hl.py and COLLECTION_INTERVAL_MINUTES in this file'
  });
});

// Health Monitoring Endpoint
app.get('/api/trading/health', async (req, res) => {
  try {
    const result = await tradingPool.query(
      `SELECT coin, MAX(captured_at) as latest, COUNT(*) as count 
       FROM trading_prices 
       GROUP BY coin`
    );
    
    const now = new Date();
    const staleThreshold = 10 * 60 * 1000; // 10 minutes
    
    const health = {
      status: 'healthy',
      dataFreshness: {},
      issues: []
    };
    
    for (const row of result.rows) {
      const latest = new Date(row.latest);
      const age = now - latest;
      const isStale = age > staleThreshold;
      
      health.dataFreshness[row.coin] = {
        latest: row.latest,
        ageMinutes: Math.round(age / 60000),
        isStale
      };
      
      if (isStale) {
        health.issues.push(`${row.coin} data is stale (${Math.round(age/60000)}m old)`);
      }
    }
    
    if (health.issues.length > 0) {
      health.status = 'degraded';
    }
    
    res.json(health);
  } catch (err) {
    console.error('Health check error:', err);
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Positions endpoint
app.get('/api/trading/positions', async (req, res) => {
  try {
    const scriptPath = path.join(PROJECT_ROOT, 'get_positions_for_dashboard.py');
    
    const pythonProcess = spawn(PYTHON_PATH, [scriptPath], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, PYTHONPATH: PROJECT_ROOT }
    });
    
    let output = '';
    let errorOutput = '';
    
    pythonProcess.stdout.on('data', (data) => { output += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { errorOutput += data.toString(); });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Python script error:', errorOutput);
        return res.status(500).json({ error: 'Failed to fetch positions', details: errorOutput });
      }
      try {
        const positions = JSON.parse(output);
        res.json(positions);
      } catch (e) {
        console.error('JSON parse error:', e);
        res.status(500).json({ error: 'Invalid response from Python script' });
      }
    });
  } catch (err) {
    console.error('Positions fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Account info endpoint
app.get('/api/trading/account', async (req, res) => {
  try {
    const scriptPath = path.join(PROJECT_ROOT, 'get_account_info.py');
    
    const pythonProcess = spawn(PYTHON_PATH, [scriptPath], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONPATH: PROJECT_ROOT }
    });
    
    let output = '';
    let errorOutput = '';
    
    pythonProcess.stdout.on('data', (data) => { output += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { errorOutput += data.toString(); });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Account info error:', errorOutput);
        return res.status(500).json({ error: 'Failed to fetch account info' });
      }
      try {
        const accountInfo = JSON.parse(output);
        res.json(accountInfo);
      } catch (e) {
        res.status(500).json({ error: 'Invalid response format' });
      }
    });
  } catch (err) {
    console.error('Account info error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update account settings (wallets, trading params)
app.post('/api/trading/account', async (req, res) => {
  try {
    const settings = req.body;
    const riskConfigPath = path.join(PROJECT_ROOT, 'risk_config.json');
    
    // Read existing config
    let config = {};
    try {
      const data = await fsp.readFile(riskConfigPath, 'utf8');
      config = JSON.parse(data);
    } catch (e) {
      // File doesn't exist, start fresh
    }
    
    // Update with new settings
    const updatedConfig = {
      ...config,
      ...settings,
      updatedAt: new Date().toISOString()
    };
    
    // Write back
    await fsp.writeFile(riskConfigPath, JSON.stringify(updatedConfig, null, 2));
    
    // Also update .env if wallet addresses changed
    if (settings.mainWallet || settings.agentWallet) {
      const envPath = path.join(PROJECT_ROOT, '.env');
      let envContent = '';
      try {
        envContent = await fsp.readFile(envPath, 'utf8');
      } catch (e) {
        // File doesn't exist
      }
      
      // Update or add wallet addresses in .env
      const envLines = envContent.split('\n');
      const newEnvLines = [];
      let mainWalletUpdated = false;
      let agentWalletUpdated = false;
      
      for (const line of envLines) {
        if (line.startsWith('HYPERLIQUID_WALLET=') && settings.mainWallet) {
          newEnvLines.push(`HYPERLIQUID_WALLET=${settings.mainWallet}`);
          mainWalletUpdated = true;
        } else if (line.startsWith('HYPERLIQUID_TESTNET_WALLET=') && settings.mainWallet) {
          newEnvLines.push(`HYPERLIQUID_TESTNET_WALLET=${settings.mainWallet}`);
          agentWalletUpdated = true;
        } else {
          newEnvLines.push(line);
        }
      }
      
      // Add if not found
      if (settings.mainWallet && !mainWalletUpdated) {
        newEnvLines.push(`HYPERLIQUID_WALLET=${settings.mainWallet}`);
      }
      if (settings.agentWallet && !agentWalletUpdated) {
        newEnvLines.push(`HYPERLIQUID_TESTNET_WALLET=${settings.agentWallet}`);
      }
      
      await fsp.writeFile(envPath, newEnvLines.join('\n'));
    }
    
    res.json({ success: true, settings: updatedConfig });
  } catch (err) {
    console.error('Account update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Strategy registry endpoint
app.get('/api/strategies', (req, res) => {
  try {
    const { exec } = require('child_process');
    const scriptPath = path.join(PROJECT_ROOT, 'strategy_registry.py');
    
    exec(`"${PYTHON_PATH}" "${scriptPath}"`,
      { timeout: 15000, cwd: PROJECT_ROOT, env: { ...process.env, PYTHONPATH: PROJECT_ROOT } },
      (error, stdout, stderr) => {
        if (error) {
          console.error('Strategy registry error:', error);
          return res.status(500).json({ error: 'Failed to load strategies' });
        }
        try {
          const strategies = JSON.parse(stdout);
          res.json(strategies);
        } catch (e) {
          res.status(500).json({ error: 'Invalid strategy data' });
        }
      }
    );
  } catch (err) {
    console.error('Strategies error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Close position endpoint
app.post('/api/trading/close-position', async (req, res) => {
  try {
    const { coin } = req.body;
    if (!coin) {
      return res.status(400).json({ error: 'Coin is required' });
    }
    
    const scriptPath = path.join(PROJECT_ROOT, 'close_position.py');
    
    const pythonProcess = spawn(PYTHON_PATH, [scriptPath, coin], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, PYTHONPATH: PROJECT_ROOT }
    });
    
    let output = '';
    let errorOutput = '';
    
    pythonProcess.stdout.on('data', (data) => { output += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { errorOutput += data.toString(); });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Close position error:', errorOutput);
        return res.status(500).json({ error: 'Failed to close position', details: errorOutput });
      }
      try {
        const result = JSON.parse(output);
        res.json(result);
      } catch (e) {
        res.json({ success: true, message: 'Position closed', raw: output });
      }
    });
  } catch (err) {
    console.error('Close position error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Strategy state endpoints
app.get('/api/trading/strategies', async (req, res) => {
  try {
    const strategyPath = path.join(PROJECT_ROOT, '.strategy_state.json');
    let strategies = {};
    try {
      const data = await fsp.readFile(strategyPath, 'utf8');
      strategies = JSON.parse(data);
    } catch (e) {
      // File doesn't exist, return empty
    }
    res.json(strategies);
  } catch (err) {
    console.error('Strategy state error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/trading/strategies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    const strategyPath = path.join(PROJECT_ROOT, '.strategy_state.json');
    
    let strategies = {};
    try {
      const data = await fsp.readFile(strategyPath, 'utf8');
      strategies = JSON.parse(data);
    } catch (e) {}
    
    strategies[id] = active;
    await fsp.writeFile(strategyPath, JSON.stringify(strategies, null, 2));
    
    res.json({ success: true, id, active });
  } catch (err) {
    console.error('Strategy toggle error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Trade executions endpoint
app.get('/api/trading/executions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const coin = req.query.coin || null;
    
    let query = `
      SELECT 
        te.id, te.signal_id, te.coin, te.strategy, te.action, te.confidence,
        te.signal_generated, te.signal_generated_at, te.orchestrator_processed,
        te.orchestrator_processed_at, te.orchestrator_skip_reason, te.hyperliquid_sent,
        te.hyperliquid_sent_at, te.hyperliquid_response, te.hyperliquid_error,
        te.hyperliquid_order_id, te.status, te.created_at, ts.meta as signal_meta
      FROM trade_executions te
      LEFT JOIN trading_signals ts ON te.signal_id = ts.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (coin) {
      query += ` AND te.coin = $${paramIndex}`;
      params.push(coin);
      paramIndex++;
    }
    
    query += ` ORDER BY te.created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);
    
    const result = await tradingPool.query(query, params);
    
    const executions = result.rows.map(row => {
      let style = null;
      try {
        const meta = typeof row.signal_meta === 'string' ? JSON.parse(row.signal_meta) : row.signal_meta;
        style = meta?.strategy_style || null;
      } catch (_) {}
      
      const stages = {
        signal: { status: row.signal_generated ? 'success' : 'pending', timestamp: row.signal_generated_at },
        orchestrator: {
          status: row.orchestrator_processed ? 'success' : (row.orchestrator_skip_reason ? 'skipped' : 'pending'),
          timestamp: row.orchestrator_processed_at,
          reason: row.orchestrator_skip_reason
        },
        hyperliquid: {
          status: row.hyperliquid_response === 'success' ? 'success' : (row.hyperliquid_response === 'failed' ? 'failed' : 'pending'),
          timestamp: row.hyperliquid_sent_at,
          error: row.hyperliquid_error,
          orderId: row.hyperliquid_order_id
        }
      };
      
      const minutesAgo = row.created_at ? (Date.now() - new Date(row.created_at).getTime()) / 60000 : null;
      
      return {
        id: row.id, signalId: row.signal_id, coin: row.coin, strategy: row.strategy,
        action: row.action, confidence: parseFloat(row.confidence) || 0, style,
        stages, overallStatus: row.status, createdAt: row.created_at,
        timeAgo: formatTimeAgo(minutesAgo)
      };
    });
    
    res.json({ executions, count: executions.length });
  } catch (err) {
    console.error('Executions fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch executions', details: err.message });
  }
});

// Signals endpoint
app.get('/api/trading/signals', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const coin = req.query.coin || null;
    
    let query = `SELECT * FROM trading_signals WHERE 1=1`;
    const params = [];
    let paramIndex = 1;
    
    if (coin) {
      query += ` AND coin = $${paramIndex}`;
      params.push(coin);
      paramIndex++;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);
    
    const result = await tradingPool.query(query, params);
    res.json({ signals: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('Signals fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch signals', details: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Trading Dashboard API running on http://localhost:${PORT}`);
});
