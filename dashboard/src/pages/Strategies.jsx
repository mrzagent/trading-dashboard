import { useState, useEffect, useCallback } from "react";
import "./Strategies.css";
import {
  CoinCard,
  Countdown,
  HealthMonitor,
  HistoryTabs,
  PositionsTable,
  RiskSummary,
  SignalsList,
  StrategyCard,
  TradeExecutionPipeline,
  getSecsUntilFire,
  formatSecsCountdown,
  COIN_ORDER,
} from "../components/strategies";

// Strategy images
import revImg from "../assets/reversion-4h.svg";
import fvgImg from "../assets/fvg.svg";
import volumeImg from "../assets/volume.svg";
import trendImg from "../assets/trend.svg";
import meanrevImg from "../assets/reversion-1h.svg";
import accelImg from "../assets/momentum.svg";
import vwapImg from "../assets/vwap.svg";
import scalperImg from "../assets/breakout.svg";
import pullbackImg from "../assets/pullback.svg";
import rsiImg from "../assets/rsi.svg";

import strategyImg from "../assets/strategy.svg";

// Strategy definitions with full metadata
const STRATEGIES = [
  {
    id: "rsi_mean_reversion",
    name: "Mean Reversion (4H)",
    img: revImg,
    timeframe: "4h",
    type: "mean_reversion",
    style: "swing",
    description:
      "RSI-based mean reversion with dynamic thresholds. Trades oversold/overbought conditions on 4h timeframe.",
    coreLogic: {
      entry: [
        "RSI < 30 (oversold) for LONG",
        "RSI > 70 (overbought) for SHORT",
        "Price confirmation required",
      ],
      exit: [
        "Stop Loss: 3% (fixed)",
        "Take Profit: 6% (fixed)",
        "Risk per trade: 2%",
      ],
      filters: [
        "4h timeframe confirmation",
        "Minimum confidence threshold 65%",
      ],
    },
    backtest: {
      return_pct: 12.5,
      win_rate: 45.2,
      profit_factor: 1.15,
      total_trades: 320,
      avg_hold_hours: 48,
      max_drawdown_pct: 18.5,
    },
  },
  {
    id: "momentum_rsi",
    name: "Momentum + RSI",
    img: strategyImg,
    timeframe: "1h",
    type: "trend_following",
    style: "swing",
    description:
      "Dual-timeframe RSI strategy with 15m and 1h confluence scoring. Mean reversion approach with RSI oversold/overbought conditions.",
    coreLogic: {
      entry: [
        "RSI 15m < 35 (oversold) AND RSI 1h < 40 for LONG",
        "RSI 15m > 65 (overbought) AND RSI 1h > 60 for SHORT",
        "Confluence score >= 0.7 required",
      ],
      exit: [
        "Stop Loss: 5% (fixed)",
        "Take Profit: 10% (fixed)",
        "Risk per trade: 2%",
      ],
      filters: [
        "Dual timeframe confirmation required",
        "Minimum confidence threshold 70%",
      ],
    },
    backtest: {
      return_pct: -84.8,
      win_rate: 33.5,
      profit_factor: 0.69,
      total_trades: 1912,
      avg_hold_hours: 12,
      max_drawdown_pct: 87.81,
      note: "High trade frequency led to overtrading — strategy needs refinement",
    },
  },
  {
    id: "fvg_proximity",
    name: "Fair Value Gap",
    img: fvgImg,
    timeframe: "15m",
    type: "mean_reversion",
    style: "scalp",
    description:
      "Trades FVG breakouts with confirmation. Enters after price breaks FVG boundary AND next candle closes beyond it. 1:2 Risk/Reward (1.5% SL / 3% TP). Hold until SL or TP hit.",
    coreLogic: {
      entry: [
        "Detect FVGs within last 20 candles (min 0.02% size)",
        "Wait for price to BREAK through FVG boundary",
        "CONFIRM: Next candle must CLOSE beyond the FVG",
        "Enter LONG on bearish FVG break + confirmation",
        "Enter SHORT on bullish FVG break + confirmation",
      ],
      exit: [
        "Stop Loss: 1.5% (fixed)",
        "Take Profit: 3.0% (fixed)",
        "NO time exit — hold until SL or TP hit",
        "Risk/Reward: 1:2",
      ],
      filters: [
        "Max FVG age: 20 candles",
        "Cooldown: 30 minutes between trades per coin",
        "Min FVG size: 0.02%",
      ],
    },
    backtest: {
      return_pct: 57.82,
      win_rate: 35.2,
      profit_factor: 1.09,
      total_trades: 759,
      avg_hold_hours: 29.3,
      max_drawdown_pct: 29.0,
    },
  },
  {
    id: "volume_spike",
    name: "Volume Spike",
    img: volumeImg,
    timeframe: "15m",
    type: "breakout",
    style: "scalp",
    description:
      "Detects volume spikes above 4h rolling average with price direction confirmation. Enters on 1.5x volume spike with directional bias. 1:2 Risk/Reward (1.5% SL / 3% TP). Hold until SL or TP hit.",
    coreLogic: {
      entry: [
        "Current volume > 1.5x 4h rolling average",
        "Price direction confirmation (up for BUY, down for SELL)",
        "Volume spike with momentum in direction of move",
      ],
      exit: [
        "Stop Loss: 1.5% (fixed)",
        "Take Profit: 3.0% (fixed)",
        "NO time exit — hold until SL or TP hit",
        "Risk/Reward: 1:2",
      ],
      filters: [
        "Rolling average window: 16 candles (4h)",
        "Minimum 30 rows of history before trusting average",
        "Uses volume data from Binance 5-min aggregated to 15-min",
      ],
    },
    backtest: {
      return_pct: 8.79,
      win_rate: 36.4,
      profit_factor: 1.05,
      total_trades: 921,
      avg_hold_hours: 27,
      max_drawdown_pct: 4.29,
    },
  },
  {
    id: "trend_breakout",
    name: "Trend Breakout",
    img: trendImg,
    timeframe: "4h",
    type: "trend_following",
    style: "swing",
    description:
      "Breakout strategy trading 20-period high/low breaks with volume confirmation. 1:2 Risk/Reward (2x ATR SL / 4x ATR TP).",
    coreLogic: {
      entry: [
        "Price breaks above 20-period high (resistance) for LONG",
        "Price breaks below 20-period low (support) for SHORT",
        "Volume confirmation: current vol >= 1.2x average",
        "Breakout strength calculated as % above/below level",
      ],
      exit: [
        "Stop Loss: 2x ATR (dynamic)",
        "Take Profit: 4x ATR (dynamic)",
        "Risk/Reward: 1:2",
      ],
      filters: [
        "Minimum 25 rows of 4h data required",
        "Volume must confirm breakout (1.2x average)",
      ],
    },
    backtest: {
      return_pct: 50.88,
      win_rate: 40.0,
      profit_factor: 1.27,
      total_trades: 120,
      avg_hold_hours: 90.1,
      max_drawdown_pct: 24.21,
    },
  },
  {
    id: "mean_reversion",
    name: "Mean Reversion (1H)",
    img: meanrevImg,
    timeframe: "1h",
    type: "mean_reversion",
    style: "swing",
    description:
      "Bollinger Band mean reversion on 1H. Price touches 2σ + RSI(2) extreme. ADX < 25 filter.",
    coreLogic: {
      entry: [
        "Price touches Bollinger Band (20, 2σ)",
        "RSI(2) extreme: < 10 for LONG, > 90 for SHORT",
        "ADX < 25 (no strong trend)",
        "Enter on 1H candle close",
      ],
      exit: [
        "Take Profit 1: Bollinger Band Middle (mean reversion)",
        "Take Profit 2: 2R (2× ATR distance)",
        "Stop Loss: 1.5× ATR beyond entry",
        "Exit on whichever target hits first",
      ],
      filters: [
        "ADX filter prevents trading in strong trends",
        "RSI(2) extreme confirms oversold/overbought",
      ],
    },
    backtest: {
      return_pct: 23.45,
      win_rate: 42.8,
      profit_factor: 1.18,
      total_trades: 245,
      avg_hold_hours: 36,
      max_drawdown_pct: 15.2,
    },
  },
  {
    id: "momentum_accel",
    name: "Momentum Acceleration",
    img: accelImg,
    timeframe: "1h",
    type: "trend_following",
    style: "swing",
    description:
      "Acceleration-based momentum entry. Measures rate of change in momentum to catch early trend moves.",
    coreLogic: {
      entry: [
        "Momentum acceleration above threshold",
        "Price in direction of acceleration",
        "Volume confirming the move",
      ],
      exit: [
        "Stop Loss: 2.5% (fixed)",
        "Take Profit: 5% (fixed)",
        "Risk per trade: 2%",
      ],
      filters: ["Minimum momentum threshold", "1h timeframe confirmation"],
    },
    backtest: {
      return_pct: 18.3,
      win_rate: 38.5,
      profit_factor: 1.12,
      total_trades: 412,
      avg_hold_hours: 28,
      max_drawdown_pct: 22.1,
    },
  },
  {
    id: "vwap_reversion",
    name: "VWAP Reversion",
    img: vwapImg,
    timeframe: "15m",
    type: "mean_reversion",
    style: "scalp",
    description:
      "VWAP-based mean reversion. Trades deviations from VWAP with volume profile confirmation.",
    coreLogic: {
      entry: [
        "Price deviates > 1.5% from VWAP",
        "Volume profile supports reversion",
        "RSI confirmation in reversal zone",
      ],
      exit: [
        "Stop Loss: 1.0% (fixed)",
        "Take Profit: 2.0% (fixed)",
        "Risk/Reward: 1:2",
      ],
      filters: ["VWAP deviation threshold", "15m timeframe only"],
    },
    backtest: {
      return_pct: 31.2,
      win_rate: 41.2,
      profit_factor: 1.21,
      total_trades: 680,
      avg_hold_hours: 4,
      max_drawdown_pct: 12.8,
    },
  },
  {
    id: "momentum_scalper",
    name: "Momentum Scalper",
    img: scalperImg,
    timeframe: "5m",
    type: "trend_following",
    style: "scalp",
    description:
      "Quick momentum captures on micro trends. High frequency scalping with tight stops.",
    coreLogic: {
      entry: [
        "Momentum spike on 5m",
        "Price breaking micro resistance/support",
        "Volume surge confirmation",
      ],
      exit: [
        "Stop Loss: 0.8% (fixed)",
        "Take Profit: 1.6% (fixed)",
        "Risk/Reward: 1:2",
      ],
      filters: ["5m timeframe only", "Quick in-and-out trades"],
    },
    backtest: {
      return_pct: -12.5,
      win_rate: 35.8,
      profit_factor: 0.92,
      total_trades: 1520,
      avg_hold_hours: 0.5,
      max_drawdown_pct: 28.5,
      note: "High frequency leads to transaction costs eating profits",
    },
  },
  {
    id: "pullback_scalper",
    name: "Pullback Scalper",
    img: pullbackImg,
    timeframe: "5m",
    type: "trend_following",
    style: "scalp",
    description:
      "Pullback entries in trending markets. Waits for trend confirmation then enters on retracements.",
    coreLogic: {
      entry: [
        "Established trend on higher timeframe",
        "Pullback to key level (EMA/structure)",
        "Reversal candle pattern confirmation",
      ],
      exit: [
        "Stop Loss: 1.0% (fixed)",
        "Take Profit: 2.0% (fixed)",
        "Risk/Reward: 1:2",
      ],
      filters: [
        "Trend must be established",
        "Pullback depth within acceptable range",
      ],
    },
    backtest: {
      return_pct: 22.8,
      win_rate: 44.5,
      profit_factor: 1.24,
      total_trades: 890,
      avg_hold_hours: 2,
      max_drawdown_pct: 14.3,
    },
  },
];

export default function Strategies() {
  // Strategy state - merge localStorage with API data
  const [activeStrategies, setActiveStrategies] = useState({});
  const [strategiesLoading, setStrategiesLoading] = useState(false);

  // Price data state
  const [priceData, setPriceData] = useState(null);
  const [priceLoading, setPriceLoading] = useState(true);
  const [priceError, setPriceError] = useState(null);

  // Positions and signals state
  const [positions, setPositions] = useState([]);
  const [signals, setSignals] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState(null);

  // Account/trading status state
  const [account, setAccount] = useState(null);

  // Countdown state
  const [dataCountdownMs, setDataCountdownMs] = useState(0);
  const [orchestratorCountdown, setOrchestratorCountdown] = useState(null);
  
  // Config state (fetched from API)
  const [dataConfig, setDataConfig] = useState({
    collectionIntervalMinutes: 5, // default until fetched
    source: { name: 'HyperLiquid' }
  });

  // Fetch strategy states from API
  const fetchStrategyStates = useCallback(async () => {
    setStrategiesLoading(true);
    try {
      const res = await fetch("http://localhost:3001/api/trading/strategies");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // API returns object like {strategy_id: true, ...}
      // If it's already an object, use it directly
      if (data && typeof data === "object" && !Array.isArray(data)) {
        setActiveStrategies(data);
      } else if (Array.isArray(data)) {
        // Handle array format if API ever changes
        const states = {};
        data.forEach((s) => {
          states[s.id] = s.active;
        });
        setActiveStrategies(states);
      } else {
        setActiveStrategies({});
      }
    } catch (err) {
      console.error("Failed to fetch strategy states:", err);
      // Fallback to localStorage
      const saved = localStorage.getItem("activeStrategies");
      if (saved) {
        try {
          setActiveStrategies(JSON.parse(saved));
        } catch {
          setActiveStrategies({});
        }
      }
    } finally {
      setStrategiesLoading(false);
    }
  }, []);

  // Load strategy states on mount
  useEffect(() => {
    fetchStrategyStates();
  }, [fetchStrategyStates]);
  
  // Fetch data config on mount
  useEffect(() => {
    fetch("http://localhost:3001/api/trading/config")
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setDataConfig(data);
      })
      .catch(err => console.error("Failed to fetch config:", err));
  }, []);

  // Save strategy state to localStorage for fallback
  useEffect(() => {
    localStorage.setItem("activeStrategies", JSON.stringify(activeStrategies));
  }, [activeStrategies]);

  // Toggle strategy - update API and local state
  const toggleStrategy = useCallback(
    async (id) => {
      const newState = !activeStrategies[id];

      // Optimistically update UI
      setActiveStrategies((prev) => ({
        ...prev,
        [id]: newState,
      }));

      // Sync with API
      try {
        const res = await fetch(
          `http://localhost:3001/api/trading/strategies/${id}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ active: newState }),
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        console.error("Failed to update strategy state:", err);
        // Revert on error
        setActiveStrategies((prev) => ({
          ...prev,
          [id]: !newState,
        }));
      }
    },
    [activeStrategies],
  );

  // Fetch price data
  const fetchPriceData = useCallback(async () => {
    try {
      setPriceLoading(true);
      const res = await fetch("http://localhost:3001/api/trading");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPriceData(data);
      setPriceError(null);
    } catch (err) {
      setPriceError(err.message);
    } finally {
      setPriceLoading(false);
    }
  }, []);

  // Fetch positions, signals, and account data
  const fetchPositionsAndSignals = useCallback(async () => {
    try {
      setDataLoading(true);
      const [positionsRes, signalsRes, accountRes] = await Promise.all([
        fetch("http://localhost:3001/api/trading/positions"),
        fetch("http://localhost:3001/api/trading/signals?limit=10"),
        fetch("http://localhost:3001/api/trading/account"),
      ]);

      if (positionsRes.ok) {
        const posData = await positionsRes.json();
        // Handle new format {environment, positions} or old array format
        const positionsArray = posData.positions || posData.value || posData;
        setPositions(Array.isArray(positionsArray) ? positionsArray : []);
      }

      if (signalsRes.ok) {
        const sigData = await signalsRes.json();
        setSignals(sigData);
      }

      if (accountRes.ok) {
        const accData = await accountRes.json();
        setAccount(accData);
      }
      setDataError(null);
    } catch (err) {
      setDataError(err.message);
    } finally {
      setDataLoading(false);
    }
  }, []);

  // Update account settings
  const updateAccountSettings = useCallback(async (settings) => {
    try {
      const res = await fetch("http://localhost:3001/api/trading/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        const data = await res.json();
        setAccount((prev) => ({ ...prev, ...settings }));
      }
    } catch (err) {
      console.error("Failed to update settings:", err);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchPriceData();
    fetchPositionsAndSignals();
  }, [fetchPriceData, fetchPositionsAndSignals]);

  // Polling for price data (every 5 seconds, but only fetch at window boundaries)
  useEffect(() => {
    const intervalMin = dataConfig.collectionIntervalMinutes || 5;
    const intervalSec = intervalMin * 60;
    const id = setInterval(() => {
      const now = new Date();
      const posInWindow = (now.getMinutes() * 60 + now.getSeconds()) % intervalSec;
      if (posInWindow < 5) fetchPriceData();
    }, 5000);
    return () => clearInterval(id);
  }, [fetchPriceData, dataConfig.collectionIntervalMinutes]);

  // Countdown timer — uses config interval from API
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const intervalSec = (dataConfig.collectionIntervalMinutes || 5) * 60;
      const posInWindow = (now.getMinutes() * 60 + now.getSeconds()) % intervalSec;
      const remaining = posInWindow >= 0 ? (intervalSec - posInWindow) * 1000 : 0;
      setDataCountdownMs(remaining);
      setOrchestratorCountdown(getSecsUntilFire(240));
    }, 1000);
    return () => clearInterval(interval);
  }, [dataConfig.collectionIntervalMinutes]);

  const activeCount = Object.values(activeStrategies).filter(Boolean).length;

  return (
    <div className="strategies-wrapper">
      {/* Header */}
      <div className="strategies-header">
        <div className="d-flex">
          <h1 className="strategies-title">Strategy Control</h1>
          <p className="strategies-subtitle">
            {activeCount} of {STRATEGIES.length} strategies active
          </p>
        </div>
        <div className="strategies-header-right">
          <Countdown 
            remainingMs={dataCountdownMs} 
            sourceName={dataConfig.source?.name || "HyperLiquid"}
          />
        </div>
      </div>

      {/* Trading Status / Risk Summary */}
      <RiskSummary account={account} onUpdateSettings={updateAccountSettings} />

      {/* Market Overview */}
      <div className="strategies-section d-flex f-dir-row">
        <div className="market-wrapper">
          <h2 className="section-title">
            Market Overview
            {priceLoading && (
              <span className="meta-loading"> · Loading...</span>
            )}
          </h2>
          {priceError ? (
            <p className="strategies-error">{priceError}</p>
          ) : priceData?.latest ? (
            <div className="coin-grid">
              {[...priceData.latest]
                .sort((a, b) => {
                  const ai = COIN_ORDER.indexOf(a.coin);
                  const bi = COIN_ORDER.indexOf(b.coin);
                  if (ai === -1 && bi === -1)
                    return a.coin.localeCompare(b.coin);
                  if (ai === -1) return 1;
                  if (bi === -1) return -1;
                  return ai - bi;
                })
                .map((row) => (
                  <CoinCard key={row.coin} row={row} />
                ))}
            </div>
          ) : (
            <p className="strategies-empty">No price data available</p>
          )}
        </div>
        <div className="w-50">
          {/* System Health Monitor */}
          <HealthMonitor />
        </div>
      </div>

      {/* Strategy Grid */}
      <div className="strategies-section">
        <h2 className="section-title">Strategies</h2>
        <div className="strategy-grid">
          {[...STRATEGIES]
            .sort((a, b) => {
              // Sort: active first, inactive last
              const aActive = activeStrategies[a.id] ? 1 : 0;
              const bActive = activeStrategies[b.id] ? 1 : 0;
              return bActive - aActive;
            })
            .map((strategy) => (
              <StrategyCard
                key={strategy.id}
                strategy={strategy}
                active={activeStrategies[strategy.id]}
                onToggle={toggleStrategy}
                countdownSec={orchestratorCountdown}
              />
            ))}
        </div>
      </div>

      {/* Open Positions */}
      <div className="strategies-section">
        <h2 className="section-title">
          Open Positions
          {dataLoading && <span className="meta-loading"> · Loading...</span>}
          {dataError && <span className="meta-error"> · Error</span>}
        </h2>
        <PositionsTable positions={positions} />
      </div>

      {/* Trade Execution Pipeline */}
      <div className="strategies-section">
        <h2 className="section-title">Trade Execution Pipeline</h2>
        <TradeExecutionPipeline />
      </div>

      {/* Recent Signals */}
      <div className="strategies-section last-section">
        <div>
          <h2 className="section-title">
            Recent Signals
            {dataLoading && <span className="meta-loading"> · Loading...</span>}
          </h2>
          <SignalsList initialSignals={signals} />
        </div>

        <div>
          <h2 className="section-title">Price History</h2>
          <HistoryTabs />
        </div>
      </div>
    </div>
  );
}
