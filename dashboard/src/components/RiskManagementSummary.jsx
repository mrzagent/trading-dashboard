import { useMemo } from "react";
import btcIcon from "../assets/btc.svg";
import ethIcon from "../assets/eth.svg";
import solIcon from "../assets/sol.svg";

const COIN_ICON = { BTC: btcIcon, ETH: ethIcon, SOL: solIcon };
const COIN_COLOR = { BTC: "#f7931a", ETH: "#627eea", SOL: "#9945ff" };
const COIN_ORDER = ["BTC", "ETH", "SOL"];

function formatCurrency(val) {
  if (val == null) return "$--";
  return (
    "$" +
    Number(val).toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  );
}

function formatPct(val, decimals = 1) {
  if (val == null) return "--%";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(decimals)}%`;
}

function maskAddress(address) {
  if (!address || address.length < 8) return "Not connected";
  return `...${address.slice(-6)}`;
}

export default function RiskManagementSummary({
  config,
  exchange,
  walletAddress,
  status,
}) {
  const {
    initialCapital,
    riskPerTradePct,
    leverage,
    initialStopLossATR,
    trailingStopATR,
    maxDailyDrawdownPct,
    maxConsecutiveLosses,
    pauseAfterConsecutiveLosses,
    fundingLongThreshold,
    fundingShortThreshold,
    assets,
  } = config;

  const riskPerTrade = useMemo(
    () => (initialCapital * riskPerTradePct) / 100,
    [initialCapital, riskPerTradePct],
  );
  const maxPositionValue = useMemo(
    () => initialCapital * leverage,
    [initialCapital, leverage],
  );

  const allConditionsMet = status?.conditionsMet ?? true;
  const dailyDrawdown = status?.dailyDrawdown ?? 0;
  const consecutiveLosses = status?.consecutiveLosses ?? 0;
  const isTrading = status?.isTrading ?? true;
  const pausedUntil = status?.pausedUntil;

  const dailyDrawdownBreached = dailyDrawdown <= -maxDailyDrawdownPct;
  const consecutiveLossBreached = consecutiveLosses >= maxConsecutiveLosses;

  const cardClass =
    allConditionsMet && isTrading
      ? "summary-card active"
      : "summary-card paused";

  return (
    <div className="risk-summary-component">
      <div className="summary-header">
        <div className="summary-title-section">
          <h3 className="summary-title">Risk Management</h3>
          <div
            className={`trading-status ${isTrading && allConditionsMet ? "live" : "paused"}`}
          >
            {isTrading && allConditionsMet ? "● TRADING LIVE" : "○ PAUSED"}
          </div>
        </div>
        <div className="exchange-info">
          <span className="exchange-label">{exchange || "Hyperliquid"}</span>
          <span className="wallet-address" title={walletAddress}>
            {maskAddress(walletAddress)}
          </span>
        </div>
      </div>

      <div className="summary-grid">
        {/* Capital Section */}
        <div className="summary-section">
          <h4 className="section-label">Capital & Leverage</h4>
          <div className="metric-row">
            <div className="metric">
              <span className="metric-label">Starting Capital</span>
              <span className="metric-value">
                {formatCurrency(initialCapital)}
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Leverage</span>
              <span className="metric-value">{leverage}x</span>
            </div>
            <div className="metric">
              <span className="metric-label">Max Position</span>
              <span className="metric-value">
                {formatCurrency(maxPositionValue)}
              </span>
            </div>
          </div>
        </div>

        {/* Risk Per Trade Section */}
        <div className="summary-section highlight">
          <h4 className="section-label">Per Trade Risk</h4>
          <div className="metric-row">
            <div className="metric large">
              <span className="metric-label">Risk Per Trade</span>
              <span className="metric-value accent">{riskPerTradePct}%</span>
              <span className="metric-sublabel">
                {formatCurrency(riskPerTrade)}
              </span>
            </div>
          </div>
        </div>

        {/* Stop Loss Section */}
        <div className="summary-section">
          <h4 className="section-label">Stop Management</h4>
          <div className="metric-row">
            <div className="metric">
              <span className="metric-label">Initial Stop</span>
              <span className="metric-value">
                {initialStopLossATR}x ATR(14)
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Trailing Stop</span>
              <span className="metric-value">{trailingStopATR}x ATR(14)</span>
            </div>
          </div>
        </div>

        {/* Circuit Breakers */}
        <div className="summary-section circuit-breakers">
          <h4 className="section-label">Circuit Breakers</h4>
          <div className="breaker-list">
            <div
              className={`breaker-item ${dailyDrawdownBreached ? "triggered" : ""}`}
            >
              <span className="breaker-icon">
                {dailyDrawdownBreached ? "⚠️" : "✓"}
              </span>
              <span className="breaker-text">
                Stop after {formatPct(-maxDailyDrawdownPct, 0)} daily drawdown
              </span>
              <span className="breaker-resume">Resume next day UTC</span>
            </div>
            <div
              className={`breaker-item ${consecutiveLossBreached ? "triggered" : ""}`}
            >
              <span className="breaker-icon">
                {consecutiveLossBreached ? "⚠️" : "✓"}
              </span>
              <span className="breaker-text">
                Pause after {maxConsecutiveLosses} consecutive losses
              </span>
              <span className="breaker-resume">Resume after 24hrs</span>
            </div>
          </div>
          {pausedUntil && (
            <div className="pause-notice">
              Trading paused until {new Date(pausedUntil).toLocaleString()}
            </div>
          )}
        </div>

        {/* Funding Filters */}
        <div className="summary-section">
          <h4 className="section-label">Funding Filters</h4>
          <div className="filter-row">
            <div className="filter-item">
              <span className="filter-side long">LONGS</span>
              <span className="filter-condition">
                Avoid if funding &gt; {formatPct(fundingLongThreshold, 2)}
              </span>
            </div>
            <div className="filter-item">
              <span className="filter-side short">SHORTS</span>
              <span className="filter-condition">
                Avoid if funding &lt; {formatPct(fundingShortThreshold, 2)}
              </span>
            </div>
          </div>
        </div>

        {/* Assets */}
        <div className="summary-section">
          <h4 className="section-label">Assets</h4>
          <div className="asset-list">
            {COIN_ORDER.filter((c) => assets.includes(c)).map((coin) => (
              <div
                key={coin}
                className="asset-badge"
                style={{ borderColor: COIN_COLOR[coin] }}
              >
                <img src={COIN_ICON[coin]} alt={coin} className="asset-icon" />
                <span>{coin}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
