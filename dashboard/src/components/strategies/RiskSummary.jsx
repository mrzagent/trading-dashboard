import { useState, useEffect } from "react";
import "./RiskSummary.css";
import hyperliquid from "../../assets/hyperliquid-dark.png";

export default function RiskSummary({ account, onUpdateSettings }) {
  // Defaults sourced from risk_config.json via API: leverage=3, stopLoss=5%, takeProfit=3%
  const DEFAULT_LEVERAGE = 3;
  const DEFAULT_STOP_LOSS = 5;
  const DEFAULT_TAKE_PROFIT = 3;
  const DEFAULT_COOLDOWN_MINUTES = 30;
  const DEFAULT_ALLOW_MULTIPLE_POSITIONS = false;
  const DEFAULT_POSITION_SIZE_PCT = 2.0;
  const DEFAULT_ENVIRONMENT = "testnet";
  const DEFAULT_TRADING_ENABLED = false;

  const [localSettings, setLocalSettings] = useState({
    tradingEnabled: DEFAULT_TRADING_ENABLED,
    leverage: DEFAULT_LEVERAGE,
    stopLoss: DEFAULT_STOP_LOSS,
    takeProfit: DEFAULT_TAKE_PROFIT,
    cooldownMinutes: DEFAULT_COOLDOWN_MINUTES,
    allowMultiplePositions: DEFAULT_ALLOW_MULTIPLE_POSITIONS,
    positionSizePct: DEFAULT_POSITION_SIZE_PCT,
    environment: DEFAULT_ENVIRONMENT,
    mainWallet: "",
    agentWallet: "",
  });
  const [saving, setSaving] = useState(false);
  const [editingWallets, setEditingWallets] = useState(false);

  // Update local settings when account changes (API returns risk_config.json values)
  useEffect(() => {
    if (account) {
      setLocalSettings({
        tradingEnabled: account.tradingEnabled ?? DEFAULT_TRADING_ENABLED,
        leverage: account.leverage ?? DEFAULT_LEVERAGE,
        stopLoss: account.stopLoss ?? DEFAULT_STOP_LOSS,
        takeProfit: account.takeProfit ?? DEFAULT_TAKE_PROFIT,
        cooldownMinutes: account.cooldownMinutes ?? DEFAULT_COOLDOWN_MINUTES,
        allowMultiplePositions:
          account.allowMultiplePositions ?? DEFAULT_ALLOW_MULTIPLE_POSITIONS,
        positionSizePct: account.positionSizePct ?? DEFAULT_POSITION_SIZE_PCT,
        environment: account.environment ?? DEFAULT_ENVIRONMENT,
        mainWallet: account.mainWallet ?? "",
        agentWallet: account.agentWallet ?? "",
      });
    }
  }, [account]);

  const handleChange = (key, value) => {
    let parsedValue;
    if (typeof value === "boolean") {
      parsedValue = value;
    } else if (key === "environment") {
      parsedValue = value; // Keep string for environment
    } else if (key === "allowMultiplePositions") {
      parsedValue = value; // Keep boolean
    } else {
      parsedValue = parseFloat(value);
    }
    const newSettings = { ...localSettings, [key]: parsedValue };
    setLocalSettings(newSettings);
  };

  const handleSave = async () => {
    setSaving(true);
    await onUpdateSettings(localSettings);
    setSaving(false);
    // Auto-refresh page after successful save
    window.location.reload();
  };

  const formatAddress = (addr) => {
    if (!addr) return "Not connected";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const totalEquity = account?.balance || 0;
  const positionValue = account?.deployedCapital || 0;
  const available = account?.available || 0;
  const positionCount = account?.positionCount ?? 0;
  const unrealizedPnl = account?.unrealizedPnl ?? null;
  const totalMargin = account?.totalMargin ?? null;
  const pnl24h = account?.pnl24h ?? null;
  const pnl7d = account?.pnl7d ?? null;
  const pnl30d = account?.pnl30d ?? null;
  const mainWallet = account?.mainWallet || "";
  const agentWallet = account?.agentWallet || "";
  
  // Wallet separation - per-wallet balances
  const wallets = account?.wallets || {};
  const swingWallet = wallets?.swing || {};
  const scalpWallet = wallets?.scalp || {};

  const accountTradingEnabled = account?.tradingEnabled ?? DEFAULT_TRADING_ENABLED;
  const accountLeverage = account?.leverage ?? DEFAULT_LEVERAGE;
  const accountStopLoss = account?.stopLoss ?? DEFAULT_STOP_LOSS;
  const accountTakeProfit = account?.takeProfit ?? DEFAULT_TAKE_PROFIT;
  const accountCooldownMinutes =
    account?.cooldownMinutes ?? DEFAULT_COOLDOWN_MINUTES;
  const accountAllowMultiplePositions =
    account?.allowMultiplePositions ?? DEFAULT_ALLOW_MULTIPLE_POSITIONS;
  const accountPositionSizePct =
    account?.positionSizePct ?? DEFAULT_POSITION_SIZE_PCT;
  const accountEnvironment = account?.environment ?? DEFAULT_ENVIRONMENT;

  const hasChanges =
    localSettings.tradingEnabled !== accountTradingEnabled ||
    localSettings.leverage !== accountLeverage ||
    localSettings.stopLoss !== accountStopLoss ||
    localSettings.takeProfit !== accountTakeProfit ||
    localSettings.cooldownMinutes !== accountCooldownMinutes ||
    localSettings.allowMultiplePositions !== accountAllowMultiplePositions ||
    localSettings.positionSizePct !== accountPositionSizePct ||
    localSettings.environment !== accountEnvironment ||
    localSettings.mainWallet !== mainWallet ||
    localSettings.agentWallet !== agentWallet;

  const formatPnl = (val) => {
    if (val === null || val === undefined) return "—";
    const sign = val >= 0 ? "+" : "";
    return `${sign}$${Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const pnlStyle = (val) => ({
    color: val === null ? "#888" : val >= 0 ? "#4ade80" : "#f87171",
  });

  return (
    <div className="risk-summary-component">
      <div className="summary-header">
        <div className="summary-title-section">
          <h2 className="summary-title">Trading Status</h2>
          <span
            className={`trading-status ${accountEnvironment === "mainnet" ? "live" : "test"}`}
          >
            {accountEnvironment === "mainnet" ? "LIVE" : "TEST"}
          </span>
          {/* Trading Master Toggle */}
          <div className="trading-master-toggle">
            <span className="toggle-label">Trading</span>
            <button
              className={`toggle-switch ${localSettings.tradingEnabled ? "on" : "off"}`}
              onClick={() => handleChange("tradingEnabled", !localSettings.tradingEnabled)}
              title={localSettings.tradingEnabled ? "Trading is ON - signals and trades active" : "Trading is OFF - price collection only"}
            >
              <span className="toggle-knob" />
            </button>
            <span className={`toggle-status ${localSettings.tradingEnabled ? "enabled" : "disabled"}`}>
              {localSettings.tradingEnabled ? "ON" : "OFF"}
            </span>
          </div>
        </div>
        {/* Wallet Addresses with Balance Display */}
        <div className="wallets">
          {editingWallets ? (
            <>
              <div className="wallet-row editable">
                <span className="wallet-label">Swing</span>
                <input
                  type="text"
                  className="wallet-input"
                  value={localSettings.mainWallet}
                  onChange={(e) => handleChange("mainWallet", e.target.value)}
                  placeholder="0x..."
                />
              </div>
              <div className="wallet-row editable">
                <span className="wallet-label">Scalp</span>
                <input
                  type="text"
                  className="wallet-input"
                  value={localSettings.agentWallet}
                  onChange={(e) => handleChange("agentWallet", e.target.value)}
                  placeholder="0x..."
                />
              </div>
              <button
                className="wallet-edit-btn done"
                onClick={() => setEditingWallets(false)}
              >
                Done
              </button>
            </>
          ) : (
            <>
              {/* Swing Wallet */}
              <div className="wallet-row">
                <span className="wallet-label">Swing</span>
                <span className="wallet-addr" title={swingWallet.walletAddress || mainWallet}>
                  {formatAddress(swingWallet.walletAddress || mainWallet)}
                </span>
                <span className="wallet-balance">
                  ${(swingWallet.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {/* Scalp Wallet */}
              <div className="wallet-row">
                <span className="wallet-label">Scalp</span>
                <span className="wallet-addr" title={scalpWallet.walletAddress || agentWallet}>
                  {formatAddress(scalpWallet.walletAddress || agentWallet)}
                </span>
                <span className="wallet-balance">
                  ${(scalpWallet.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <button
                className="wallet-edit-btn"
                onClick={() => setEditingWallets(true)}
              >
                Edit
              </button>
            </>
          )}
        </div>
        <div className="exchange-info">
          <img src={hyperliquid} alt="Hyperliquid" />
        </div>
      </div>

      <div className="summary-grid">
        {/* Total Equity */}
        <div className="summary-section">
          <div className="metric d-flex f-dir-col f-justify-center">
            <p className="metric-label">Total Equity</p>
            <div className="d-flex">
              <span className="metric small mr-5">
                $
                {totalEquity.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span className="metric-sublabel">USDC</span>
            </div>
          </div>
          {totalMargin !== null && (
            <div className="metric small">
              <span className="metric-label">Total Margin: </span>
              <span>
                $
                {totalMargin.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          )}
          {/* PnL 24h / 7d / 30d side by side */}
          <div className="pnl-row" style={{ display: "flex", gap: "16px" }}>
            <div className="metric small">
              <span className="metric-label">PnL 24h: </span>
              <span style={pnlStyle(pnl24h)}>{formatPnl(pnl24h ?? 0)}</span>
            </div>
            <div className="metric small">
              <span className="metric-label">PnL 7d: </span>
              <span style={pnlStyle(pnl7d)}>{formatPnl(pnl7d ?? 0)}</span>
            </div>
            <div className="metric small">
              <span className="metric-label">PnL 30d: </span>
              <span style={pnlStyle(pnl30d)}>{formatPnl(pnl30d ?? 0)}</span>
            </div>
          </div>
        </div>

        {/* Position Value */}
        <div className="summary-section">
          <div className="d-flex f-dir-col f-justify-center">
            <h4 className="section-label">Position Value</h4>
            <div className="capital-bar">
              <div
                className="capital-used"
                style={{
                  width: `${totalEquity > 0 ? (positionValue / totalEquity) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
          <div className="metric-row">
            <div className="metric">
              <span className="metric-label">Available</span>
              <span className="metric-value">
                $
                {available.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Margin Used</span>
              <span className="metric-value">
                $
                {totalMargin?.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }) || "—"}
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Value</span>
              <span className="metric-value">
                $
                {positionValue.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">of Equity</span>
              <span className="metric-value">
                {totalMargin && totalEquity > 0
                  ? ((totalMargin / totalEquity) * 100).toFixed(1)
                  : "—"}
                %
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Open Positions</span>
              <span className="metric-value">{positionCount}</span>
            </div>
          </div>
        </div>

        {/* SL / TP / Leverage Controls */}
        <div className="summary-section settings">
          <h4 className="section-label">Strategy Settings</h4>

          <div className="setting-row">
            <label>Leverage</label>
            <div className="slider-group">
              <input
                type="range"
                min="1"
                max="50"
                value={localSettings.leverage}
                onChange={(e) => handleChange("leverage", e.target.value)}
              />
              <span className="slider-value">{localSettings.leverage}x</span>
            </div>
          </div>

          <div className="setting-row">
            <label>Stop Loss</label>
            <div className="slider-group">
              <input
                type="range"
                min="0.5"
                max="10"
                step="0.5"
                value={localSettings.stopLoss}
                onChange={(e) => handleChange("stopLoss", e.target.value)}
              />
              <span className="slider-value">{localSettings.stopLoss}%</span>
            </div>
          </div>

          <div className="setting-row">
            <label>Take Profit</label>
            <div className="slider-group">
              <input
                type="range"
                min="1"
                max="20"
                step="0.5"
                value={localSettings.takeProfit}
                onChange={(e) => handleChange("takeProfit", e.target.value)}
              />
              <span className="slider-value">{localSettings.takeProfit}%</span>
            </div>
          </div>

          <div className="setting-row">
            <label>Position Size</label>
            <div className="slider-group">
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.5"
                value={localSettings.positionSizePct}
                onChange={(e) =>
                  handleChange("positionSizePct", e.target.value)
                }
              />
              <span className="slider-value">
                {localSettings.positionSizePct}%
              </span>
            </div>
          </div>

          <div className="setting-row">
            <label>Cooldown Period</label>
            <div className="slider-group">
              <input
                type="range"
                min="0"
                max="120"
                step="5"
                value={localSettings.cooldownMinutes}
                onChange={(e) =>
                  handleChange("cooldownMinutes", e.target.value)
                }
              />
              <span className="slider-value">
                {localSettings.cooldownMinutes}m
              </span>
            </div>
          </div>

          <div className="setting-row checkbox-row">
            <label>Allow Multiple Positions</label>
            <input
              type="checkbox"
              checked={localSettings.allowMultiplePositions}
              onChange={(e) =>
                handleChange("allowMultiplePositions", e.target.checked)
              }
            />
          </div>

          <div className="setting-row environment-row">
            <label>Environment</label>
            <div className="environment-toggle">
              <button
                className={`env-btn ${localSettings.environment === "testnet" ? "active" : ""}`}
                onClick={() => handleChange("environment", "testnet")}
              >
                TESTNET
              </button>
              <button
                className={`env-btn ${localSettings.environment === "mainnet" ? "active" : ""}`}
                onClick={() => handleChange("environment", "mainnet")}
              >
                LIVE
              </button>
            </div>
          </div>

          {hasChanges && (
            <button
              className="save-settings-btn"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
