import { COIN_ICON, COIN_COLOR, COIN_ORDER } from "./constants";
import { formatPrice, formatRSI, formatVolume, formatTime } from "./utils";
import ChangeBadge from "./ChangeBadge";
import "./CoinCard.css";

export default function CoinCard({ row }) {
  const coin = row.coin;
  const icon = COIN_ICON[coin];
  const color = COIN_COLOR[coin];
  const rsi = formatRSI(row.rsi);

  return (
    <div
      className={`coin-card ${row.alert_triggered ? "coin-card--alert" : ""}`}
    >
      {row.alert_triggered && <div className="alert-badge">Alert</div>}
      <div className="coin-header">
        <div className="d-flex f-align-center">
          <span className="coin-symbol" style={{ color }}>
            {icon ? <img src={icon} alt={coin} className="coin-icon" /> : coin}
          </span>
          <span className="coin-name">{coin}</span>
        </div>

        <div className="coin-time">Updated {formatTime(row.captured_at)}</div>
      </div>
      <div className="coin-price">{formatPrice(row.price)}</div>
      <div className="change-summary">
        <ChangeBadge label="1h" value={row.change_1h} />
        <ChangeBadge label="24h" value={row.change_24h} />
        <ChangeBadge label="7d" value={row.change_7d} />
      </div>
      <div className="coin-meta">
        <div className="coin-meta-item">
          <span className="meta-label">RSI</span>
          <span className={`meta-value rsi-${rsi.className}`}>{rsi.text}</span>
        </div>
        <div className="coin-meta-item">
          <span className="meta-label">Vol</span>
          <span className="meta-value">{formatVolume(row.volume_24h)}</span>
        </div>
        <div className="coin-meta-item">
          <span className="meta-label">Momentum</span>
          <span className="meta-value">{row.momentum ?? "--"}</span>
        </div>
      </div>
    </div>
  );
}
