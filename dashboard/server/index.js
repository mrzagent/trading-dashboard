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
    const now = new Date();
    const staleThreshold = 10 * 60 * 1000; // 10 minutes
    
    const health = {
      status: 'healthy',
      timestamp: now.toISOString(),
      dataFreshness: {},
      issues: [],
      orchestrator: null,
      tradeState: null,
      lastSignal: null
    };
    
    // Check price data freshness
    const priceResult = await tradingPool.query(
      `SELECT coin, MAX(captured_at) as latest, COUNT(*) as count 
       FROM trading_prices 
       GROUP BY coin`
    );
    
    for (const row of priceResult.rows) {
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
    
    // Get orchestrator task status
    try {
      const taskResult = await tradingPool.query(
        `SELECT MAX(created_at) as last_run 
         FROM trading_signals 
         WHERE created_at > NOW() - INTERVAL '1 hour'`
      );
      const lastSignalTime = taskResult.rows[0]?.last_run;
      const minutesSinceSignal = lastSignalTime ? 
        Math.round((now - new Date(lastSignalTime)) / 60000) : null;
      
      health.orchestrator = {
        taskStatus: {
          LastRunTime: lastSignalTime ? `/Date(${new Date(lastSignalTime).getTime()})/` : null
        }
      };
      
      health.tradeState = {
        minutesSinceUpdate: minutesSinceSignal
      };
    } catch (e) {
      console.error('Orchestrator status check error:', e);
    }
    
    // Get last signal
    try {
      const signalResult = await tradingPool.query(
        `SELECT coin, action, confidence, created_at 
         FROM trading_signals 
         ORDER BY created_at DESC 
         LIMIT 1`
      );
      if (signalResult.rows.length > 0) {
        health.lastSignal = signalResult.rows[0];
      }
    } catch (e) {
      console.error('Last signal check error:', e);
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
        res.json({ positions: positions });
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
    // First, get account balances from Python script
    const scriptPath = path.join(PROJECT_ROOT, 'get_account_info.py');
    
    const pythonProcess = spawn(PYTHON_PATH, [scriptPath], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONPATH: PROJECT_ROOT }
    });
    
    let output = '';
    let errorOutput = '';
    
    pythonProcess.stdout.on('data', (data) => { output += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { errorOutput += data.toString(); });
    
    pythonProcess.on('close', async (code) => {
      if (code !== 0) {
        console.error('Account info error:', errorOutput);
        return res.status(500).json({ error: 'Failed to fetch account info' });
      }
      try {
        const accountInfo = JSON.parse(output);
        
        // Load trading settings from risk_config.json
        const riskConfigPath = path.join(PROJECT_ROOT, 'risk_config.json');
        let settings = {};
        try {
          const data = await fsp.readFile(riskConfigPath, 'utf8');
          settings = JSON.parse(data);
          console.log('[API] Loaded risk_config.json, tradingEnabled:', settings.tradingEnabled);
        } catch (e) {
          console.log('[API] Could not load risk_config.json:', e.message);
        }
        
        // Load wallet settings from .env file (source of truth for wallets)
        const envPath = path.join(PROJECT_ROOT, '.env');
        let envSettings = {};
        try {
          const envData = await fsp.readFile(envPath, 'utf8');
          for (const line of envData.split('\n')) {
            if (line.includes('=') && !line.startsWith('#')) {
              const [key, ...valueParts] = line.split('=');
              envSettings[key.trim()] = valueParts.join('=').trim();
            }
          }
        } catch (e) {
          console.log('[API] Could not load .env:', e.message);
        }
        
        // Determine environment
        const env = settings.environment || 'testnet';
        
        // Merge account info with settings (use explicit null/undefined checks)
        // Wallet values come from .env (source of truth), other settings from risk_config.json
        const merged = {
          ...accountInfo,
          tradingEnabled: settings.tradingEnabled !== undefined ? settings.tradingEnabled : false,
          leverage: settings.leverage !== undefined ? settings.leverage : 3,
          stopLoss: settings.stopLoss !== undefined ? settings.stopLoss : 5,
          takeProfit: settings.takeProfit !== undefined ? settings.takeProfit : 3,
          cooldownMinutes: settings.cooldownMinutes !== undefined ? settings.cooldownMinutes : 30,
          allowMultiplePositions: settings.allowMultiplePositions !== undefined ? settings.allowMultiplePositions : false,
          positionSizePct: settings.positionSizePct !== undefined ? settings.positionSizePct : 2.0,
          environment: env,
          // Wallet values from .env (source of truth)
          swingMainWallet: envSettings[`HYPERLIQUID_SWING_${env.toUpperCase()}_MAIN_WALLET`] || '',
          swingAgentWallet: envSettings[`HYPERLIQUID_SWING_${env.toUpperCase()}_AGENT_WALLET`] || '',
          swingAgentPrivateKey: envSettings[`HYPERLIQUID_SWING_${env.toUpperCase()}_AGENT_PRIVATE_KEY`] || '',
          scalpMainWallet: envSettings[`HYPERLIQUID_SCALP_${env.toUpperCase()}_MAIN_WALLET`] || '',
          scalpAgentWallet: envSettings[`HYPERLIQUID_SCALP_${env.toUpperCase()}_AGENT_WALLET`] || '',
          scalpAgentPrivateKey: envSettings[`HYPERLIQUID_SCALP_${env.toUpperCase()}_AGENT_PRIVATE_KEY`] || '',
        };
        
        console.log('[API] Returning merged data, tradingEnabled:', merged.tradingEnabled);
        res.json(merged);
      } catch (e) {
        console.error('[API] Error processing account info:', e);
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
    
    // Write back to risk_config.json
    await fsp.writeFile(riskConfigPath, JSON.stringify(updatedConfig, null, 2));
    
    // Also sync to .account_settings.json (used by orchestrator and signal_integrator)
    const accountSettingsPath = path.join(PROJECT_ROOT, '.account_settings.json');
    let accountSettings = {};
    try {
      const data = await fsp.readFile(accountSettingsPath, 'utf8');
      accountSettings = JSON.parse(data);
    } catch (e) {
      // File doesn't exist, start fresh
    }
    
    // Map dashboard settings to account settings format
    const updatedAccountSettings = {
      ...accountSettings,
      tradingEnabled: settings.tradingEnabled ?? accountSettings.tradingEnabled ?? false,
      cooldownMinutes: settings.cooldownMinutes ?? accountSettings.cooldownMinutes ?? 30,
      allowMultiplePositions: settings.allowMultiplePositions ?? accountSettings.allowMultiplePositions ?? false,
      leverage: settings.leverage ?? accountSettings.leverage ?? 3,
      stopLoss: settings.stopLoss ?? accountSettings.stopLoss ?? 5,
      takeProfit: settings.takeProfit ?? accountSettings.takeProfit ?? 3,
      positionSizePct: settings.positionSizePct ?? accountSettings.positionSizePct ?? 2,
      environment: settings.environment ?? accountSettings.environment ?? 'testnet',
      updatedAt: new Date().toISOString()
    };
    
    // Update wallet addresses in account settings if provided
    const env = updatedAccountSettings.environment;
    if (!updatedAccountSettings[env]) {
      updatedAccountSettings[env] = {};
    }
    if (settings.swingMainWallet) {
      updatedAccountSettings[env].mainWalletAddress = settings.swingMainWallet;
    }
    if (settings.swingAgentWallet) {
      updatedAccountSettings[env].walletAddress = settings.swingAgentWallet;
    }
    
    await fsp.writeFile(accountSettingsPath, JSON.stringify(updatedAccountSettings, null, 2));
    
    // Update .env with wallet addresses and private keys (4 wallets for swing/scalp separation)
    const hasWalletChanges = settings.swingMainWallet || settings.swingAgentWallet || 
                             settings.scalpMainWallet || settings.scalpAgentWallet ||
                             settings.swingAgentPrivateKey || settings.scalpAgentPrivateKey;
    
    if (hasWalletChanges) {
      const envPath = path.join(PROJECT_ROOT, '.env');
      let envContent = '';
      try {
        envContent = await fsp.readFile(envPath, 'utf8');
      } catch (e) {
        // File doesn't exist
      }
      
      // Track which variables we've updated
      const updated = {
        swingMain: false,
        swingAgent: false,
        swingAgentKey: false,
        scalpMain: false,
        scalpAgent: false,
        scalpAgentKey: false
      };
      
      // Update or add wallet addresses in .env
      const envLines = envContent.split('\n');
      const newEnvLines = [];
      
      for (const line of envLines) {
        if (line.startsWith('HYPERLIQUID_SWING_MAINNET_MAIN_WALLET=') && settings.swingMainWallet) {
          newEnvLines.push(`HYPERLIQUID_SWING_MAINNET_MAIN_WALLET=${settings.swingMainWallet}`);
          updated.swingMain = true;
        } else if (line.startsWith('HYPERLIQUID_SWING_TESTNET_MAIN_WALLET=') && settings.swingMainWallet) {
          newEnvLines.push(`HYPERLIQUID_SWING_TESTNET_MAIN_WALLET=${settings.swingMainWallet}`);
        } else if (line.startsWith('HYPERLIQUID_SWING_MAINNET_AGENT_WALLET=') && settings.swingAgentWallet) {
          newEnvLines.push(`HYPERLIQUID_SWING_MAINNET_AGENT_WALLET=${settings.swingAgentWallet}`);
          updated.swingAgent = true;
        } else if (line.startsWith('HYPERLIQUID_SWING_TESTNET_AGENT_WALLET=') && settings.swingAgentWallet) {
          newEnvLines.push(`HYPERLIQUID_SWING_TESTNET_AGENT_WALLET=${settings.swingAgentWallet}`);
        } else if (line.startsWith('HYPERLIQUID_SCALP_MAINNET_MAIN_WALLET=') && settings.scalpMainWallet) {
          newEnvLines.push(`HYPERLIQUID_SCALP_MAINNET_MAIN_WALLET=${settings.scalpMainWallet}`);
          updated.scalpMain = true;
        } else if (line.startsWith('HYPERLIQUID_SCALP_TESTNET_MAIN_WALLET=') && settings.scalpMainWallet) {
          newEnvLines.push(`HYPERLIQUID_SCALP_TESTNET_MAIN_WALLET=${settings.scalpMainWallet}`);
        } else if (line.startsWith('HYPERLIQUID_SCALP_MAINNET_AGENT_WALLET=') && settings.scalpAgentWallet) {
          newEnvLines.push(`HYPERLIQUID_SCALP_MAINNET_AGENT_WALLET=${settings.scalpAgentWallet}`);
          updated.scalpAgent = true;
        } else if (line.startsWith('HYPERLIQUID_SCALP_TESTNET_AGENT_WALLET=') && settings.scalpAgentWallet) {
          newEnvLines.push(`HYPERLIQUID_SCALP_TESTNET_AGENT_WALLET=${settings.scalpAgentWallet}`);
        } else if (line.startsWith('HYPERLIQUID_SWING_MAINNET_AGENT_PRIVATE_KEY=') && settings.swingAgentPrivateKey) {
          newEnvLines.push(`HYPERLIQUID_SWING_MAINNET_AGENT_PRIVATE_KEY=${settings.swingAgentPrivateKey}`);
          updated.swingAgentKey = true;
        } else if (line.startsWith('HYPERLIQUID_SWING_TESTNET_AGENT_PRIVATE_KEY=') && settings.swingAgentPrivateKey) {
          newEnvLines.push(`HYPERLIQUID_SWING_TESTNET_AGENT_PRIVATE_KEY=${settings.swingAgentPrivateKey}`);
        } else if (line.startsWith('HYPERLIQUID_SCALP_MAINNET_AGENT_PRIVATE_KEY=') && settings.scalpAgentPrivateKey) {
          newEnvLines.push(`HYPERLIQUID_SCALP_MAINNET_AGENT_PRIVATE_KEY=${settings.scalpAgentPrivateKey}`);
          updated.scalpAgentKey = true;
        } else if (line.startsWith('HYPERLIQUID_SCALP_TESTNET_AGENT_PRIVATE_KEY=') && settings.scalpAgentPrivateKey) {
          newEnvLines.push(`HYPERLIQUID_SCALP_TESTNET_AGENT_PRIVATE_KEY=${settings.scalpAgentPrivateKey}`);
        } else {
          newEnvLines.push(line);
        }
      }
      
      // Add any missing variables at the end
      if (settings.swingMainWallet && !updated.swingMain) {
        newEnvLines.push(`HYPERLIQUID_SWING_MAINNET_MAIN_WALLET=${settings.swingMainWallet}`);
        newEnvLines.push(`HYPERLIQUID_SWING_TESTNET_MAIN_WALLET=${settings.swingMainWallet}`);
      }
      if (settings.swingAgentWallet && !updated.swingAgent) {
        newEnvLines.push(`HYPERLIQUID_SWING_MAINNET_AGENT_WALLET=${settings.swingAgentWallet}`);
        newEnvLines.push(`HYPERLIQUID_SWING_TESTNET_AGENT_WALLET=${settings.swingAgentWallet}`);
      }
      if (settings.scalpMainWallet && !updated.scalpMain) {
        newEnvLines.push(`HYPERLIQUID_SCALP_MAINNET_MAIN_WALLET=${settings.scalpMainWallet}`);
        newEnvLines.push(`HYPERLIQUID_SCALP_TESTNET_MAIN_WALLET=${settings.scalpMainWallet}`);
      }
      if (settings.scalpAgentWallet && !updated.scalpAgent) {
        newEnvLines.push(`HYPERLIQUID_SCALP_MAINNET_AGENT_WALLET=${settings.scalpAgentWallet}`);
        newEnvLines.push(`HYPERLIQUID_SCALP_TESTNET_AGENT_WALLET=${settings.scalpAgentWallet}`);
      }
      if (settings.swingAgentPrivateKey && !updated.swingAgentKey) {
        newEnvLines.push(`HYPERLIQUID_SWING_MAINNET_AGENT_PRIVATE_KEY=${settings.swingAgentPrivateKey}`);
        newEnvLines.push(`HYPERLIQUID_SWING_TESTNET_AGENT_PRIVATE_KEY=${settings.swingAgentPrivateKey}`);
      }
      if (settings.scalpAgentPrivateKey && !updated.scalpAgentKey) {
        newEnvLines.push(`HYPERLIQUID_SCALP_MAINNET_AGENT_PRIVATE_KEY=${settings.scalpAgentPrivateKey}`);
        newEnvLines.push(`HYPERLIQUID_SCALP_TESTNET_AGENT_PRIVATE_KEY=${settings.scalpAgentPrivateKey}`);
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const coin = req.query.coin || null;
    const status = req.query.status || null;
    
    // Build count query for total
    let countQuery = `SELECT COUNT(*) as total FROM trade_executions te WHERE 1=1`;
    const countParams = [];
    let countParamIndex = 1;
    
    if (coin) {
      countQuery += ` AND te.coin = $${countParamIndex}`;
      countParams.push(coin);
      countParamIndex++;
    }
    
    if (status && status !== 'all') {
      countQuery += ` AND te.status = $${countParamIndex}`;
      countParams.push(status);
      countParamIndex++;
    }
    
    // Get total count
    const countResult = await tradingPool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);
    
    // Build data query with pagination
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
    
    if (status && status !== 'all') {
      query += ` AND te.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    query += ` ORDER BY te.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit);
    params.push(offset);
    
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
    
    res.json({ 
      executions, 
      count: executions.length,
      pagination: {
        page: page,
        limit: limit,
        total: total,
        totalPages: totalPages
      }
    });
  } catch (err) {
    console.error('Executions fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch executions', details: err.message });
  }
});

// Signals endpoint
app.get('/api/trading/signals', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const offset = (page - 1) * limit;
    const coin = req.query.coin || null;
    const action = req.query.action || null;
    
    // Build count query for total
    let countQuery = `SELECT COUNT(*) as total FROM trading_signals WHERE 1=1`;
    const countParams = [];
    let countParamIndex = 1;
    
    if (coin) {
      countQuery += ` AND coin = $${countParamIndex}`;
      countParams.push(coin);
      countParamIndex++;
    }
    
    if (action && action !== 'ALL') {
      countQuery += ` AND action = $${countParamIndex}`;
      countParams.push(action);
      countParamIndex++;
    }
    
    // Get total count
    const countResult = await tradingPool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);
    
    // Build data query with pagination
    let query = `SELECT * FROM trading_signals WHERE 1=1`;
    const params = [];
    let paramIndex = 1;
    
    if (coin) {
      query += ` AND coin = $${paramIndex}`;
      params.push(coin);
      paramIndex++;
    }
    
    if (action && action !== 'ALL') {
      query += ` AND action = $${paramIndex}`;
      params.push(action);
      paramIndex++;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit);
    params.push(offset);
    
    const result = await tradingPool.query(query, params);
    
    // Add formatted time to each signal
    const signals = result.rows.map(row => {
      const minutesAgo = row.created_at ? (Date.now() - new Date(row.created_at).getTime()) / 60000 : null;
      const createdAt = new Date(row.created_at);
      const formattedDate = createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const formattedTime = createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      
      return {
        ...row,
        timeAgo: formatTimeAgo(minutesAgo),
        formattedDate: formattedDate,
        formattedTime: formattedTime,
        timestamp: `${formattedDate} ${formattedTime}`
      };
    });
    
    res.json({ 
      signals, 
      count: signals.length,
      pagination: {
        page: page,
        limit: limit,
        total: total,
        totalPages: totalPages
      }
    });
  } catch (err) {
    console.error('Signals fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch signals', details: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Trading Dashboard API running on http://localhost:${PORT}`);
});
