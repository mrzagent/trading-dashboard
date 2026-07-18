import { useState } from "react";
import { formatSecsCountdown } from "./utils";
import { TYPE_COLORS, STYLE_BADGES } from "./constants";
import "./StrategyCard.css";

function CoreLogicSection({ coreLogic }) {
  if (!coreLogic) return null;

  // Handle object format with entry, exit, filters
  if (typeof coreLogic === "object" && !Array.isArray(coreLogic)) {
    const { entry, exit, filters } = coreLogic;
    return (
      <div className="detail-section">
        {entry && entry.length > 0 && (
          <>
            <h4 className="detail-section-title">Entry Rules</h4>
            <ul className="core-logic-list">
              {entry.map((item, idx) => (
                <li key={`entry-${idx}`}>{item}</li>
              ))}
            </ul>
          </>
        )}
        {exit && exit.length > 0 && (
          <>
            <h4 className="detail-section-title">Exit Rules</h4>
            <ul className="core-logic-list">
              {exit.map((item, idx) => (
                <li key={`exit-${idx}`}>{item}</li>
              ))}
            </ul>
          </>
        )}
        {filters && filters.length > 0 && (
          <>
            <h4 className="detail-section-title">Filters</h4>
            <ul className="core-logic-list">
              {filters.map((item, idx) => (
                <li key={`filter-${idx}`}>{item}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    );
  }

  // Handle array format (legacy)
  if (Array.isArray(coreLogic) && coreLogic.length > 0) {
    return (
      <div className="detail-section">
        <h4 className="detail-section-title">Core Logic</h4>
        <ul className="core-logic-list">
          {coreLogic.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      </div>
    );
  }

  return null;
}

function ConfigSection({ config }) {
  if (!config || Object.keys(config).length === 0) return null;
  return (
    <div className="detail-section">
      <h4 className="detail-section-title">Configuration</h4>
      <div className="config-grid">
        {Object.entries(config).map(([key, value]) => (
          <div key={key} className="config-item">
            <span className="config-key">{key.replace(/_/g, " ")}</span>
            <span className="config-value">
              {typeof value === "number" ? value.toFixed(2) : String(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsSection({
  winRate,
  tradesCount,
  profitFactor,
  returnPct,
  maxDrawdown,
  avgHoldHours,
}) {
  const hasStats =
    winRate != null || tradesCount != null || profitFactor != null;
  if (!hasStats) return null;

  return (
    <div className="detail-section">
      <h4 className="detail-section-title">Performance</h4>
      <div className="stats-grid">
        {returnPct != null && (
          <div className="stat-item">
            <span className="stat-label">Return</span>
            <span
              className={`stat-value ${returnPct >= 0 ? "positive" : "negative"}`}
            >
              {returnPct >= 0 ? "+" : ""}
              {returnPct.toFixed(1)}%
            </span>
          </div>
        )}
        {winRate != null && (
          <div className="stat-item">
            <span className="stat-label">Win Rate</span>
            <span
              className={`stat-value ${winRate >= 50 ? "positive" : "negative"}`}
            >
              {winRate.toFixed(1)}%
            </span>
          </div>
        )}
        {tradesCount != null && (
          <div className="stat-item">
            <span className="stat-label">Trades</span>
            <span className="stat-value">{tradesCount}</span>
          </div>
        )}
        {profitFactor != null && (
          <div className="stat-item">
            <span className="stat-label">Profit Factor</span>
            <span
              className={`stat-value ${profitFactor >= 1.5 ? "positive" : ""}`}
            >
              {profitFactor.toFixed(2)}
            </span>
          </div>
        )}

        {maxDrawdown != null && (
          <div className="stat-item">
            <span className="stat-label">Max Drawdown</span>
            <span className="stat-value negative">
              -{maxDrawdown.toFixed(1)}%
            </span>
          </div>
        )}
        {avgHoldHours != null && (
          <div className="stat-item">
            <span className="stat-label">Avg Hold</span>
            <span className="stat-value">{avgHoldHours.toFixed(1)}h</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StrategyCard({
  strategy,
  active,
  onToggle,
  dynamicMeta,
  countdownSec,
}) {
  const [expanded, setExpanded] = useState(false);

  const meta = dynamicMeta || null;
  const displayType = meta ? meta.type : strategy.type;
  const displayTimeframes = meta
    ? meta.timeframes.join(", ")
    : strategy.timeframe;
  const displayDescription = meta ? meta.description : strategy.description;

  return (
    <div
      className={`strategy-card${active ? "" : " inactive"}${expanded ? " expanded" : ""}`}
    >
      <div className="strategy-header">
        <div className="strategy-identity">
          <div className="strategy-img">
            {strategy.img && <img src={strategy.img} alt={strategy.name} />}
          </div>
          <div className="strategy-title-block">
            <div className="d-flex">
              <h3 className="strategy-name">{strategy.name}</h3>
              {countdownSec !== null && countdownSec > 0 && (
                <span className="strategy-countdown">
                  {formatSecsCountdown(countdownSec)}
                </span>
              )}
            </div>
            <div className="strategy-badges">
              <span className={`style-badge ${strategy.style}`}>
                {STYLE_BADGES[strategy.style]?.label || strategy.style}
              </span>
              <span className="type-badge">
                {displayType.replace(/_/g, " ")}
              </span>
              <span className="timeframe-badge">{displayTimeframes}</span>
            </div>
          </div>
        </div>

        <div className="d-flex f-dir-col f-align-end">
          <button
            className="expand-btn"
            onClick={() => setExpanded(!expanded)}
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? "−" : "+"}
          </button>
          <label className="strategy-toggle">
            <input
              type="checkbox"
              checked={active}
              onChange={() => onToggle(strategy.id)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

      <div className="strategy-meta">
        <div className="strategy-meta-row">
          <span className="strategy-meta-label">Timeframe</span>
          <span className="strategy-meta-value">{displayTimeframes}</span>
        </div>
        <div className="strategy-meta-row">
          <span className="strategy-meta-label">Schedule</span>
          <span className="strategy-meta-value">Every 5 min </span>
        </div>
        <div className="strategy-meta-row">
          <span className="strategy-meta-label">Delivery</span>
          <span className="strategy-meta-value">Signal to DB</span>
        </div>
      </div>

      {expanded && (
        <div className="strategy-details">
          <p className="strategy-description">{displayDescription}</p>
          <div className="detail-wrapper">
            <div className="detail-row">
              <span className="detail-label">Strategy ID</span>
              <span className="detail-value">{strategy.id}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Timeframe</span>
              <span className="detail-value">{displayTimeframes}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Style</span>
              <span className="detail-value">{strategy.style}</span>
            </div>
          </div>

          {(meta?.core_logic || strategy.coreLogic) && (
            <CoreLogicSection
              coreLogic={meta?.core_logic || strategy.coreLogic}
            />
          )}
          {meta?.config && <ConfigSection config={meta.config} />}
          <StatsSection
            winRate={meta?.performance?.win_rate ?? strategy.backtest?.win_rate}
            tradesCount={
              meta?.performance?.trades_count ?? strategy.backtest?.total_trades
            }
            profitFactor={
              meta?.performance?.profit_factor ??
              strategy.backtest?.profit_factor
            }
            returnPct={strategy.backtest?.return_pct}
            maxDrawdown={strategy.backtest?.max_drawdown_pct}
            avgHoldHours={strategy.backtest?.avg_hold_hours}
          />
          {!meta && (
            <p className="no-meta-note">
              Dynamic metadata not available for this strategy.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
