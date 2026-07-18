import { useState, useEffect, useCallback } from "react";
import { COIN_ICON, COIN_COLOR, COIN_ORDER } from "./constants";
import { formatPrice, formatRSI, formatVolume, formatTime } from "./utils";
import "./HistoryTabs.css";

export default function HistoryTabs() {
  const [activeTab, setActiveTab] = useState("last");
  const [tabHistory, setTabHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchTabHistory = useCallback(async (tab) => {
    setLoading(true);
    try {
      const url =
        tab === "last"
          ? "http://localhost:3001/api/trading/history"
          : `http://localhost:3001/api/trading/history?minutes=${tab}`;
      const res = await fetch(url);
      const data = await res.json();
      setTabHistory(Array.isArray(data) ? data : []);
    } catch (e) {
      setTabHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTabHistory(activeTab);
  }, [activeTab, fetchTabHistory]);

  const tabs = [
    { key: "last", label: "Latest" },
    { key: "5", label: "5 min" },
    { key: "10", label: "10 min" },
    { key: "15", label: "15 min" },
    { key: "30", label: "30 min" },
    { key: "60", label: "1h" },
    { key: "240", label: "4h" },
    { key: "1440", label: "24h" },
  ];

  return (
    <div className="history-tabs-wrapper">
      <div className="history-tab-bar">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            className={`history-tab-btn${activeTab === key ? " active" : ""}`}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="history-tab-content">
        {loading && <p className="strategies-loading">Loading...</p>}
        {!loading && tabHistory.length === 0 && (
          <p className="strategies-empty">No data for this time window.</p>
        )}
        {!loading &&
          COIN_ORDER.map((coin) => {
            const rows = tabHistory.filter((r) => r.coin === coin);
            if (!rows.length) return null;
            return (
              <div key={coin} className="history-coin-section">
                <div>
                  <table className="history-table">
                    <tbody>
                      {rows.map((r, i) => (
                        <tr
                          key={i}
                          className={r.alert_triggered ? "row-alert" : ""}
                        >
                          <td>
                            {" "}
                            <span className="history-coin-symbol">
                              {COIN_ICON[coin] ? (
                                <img
                                  src={COIN_ICON[coin]}
                                  alt={coin}
                                  className="coin-icon"
                                />
                              ) : (
                                coin
                              )}
                            </span>
                            <span className="history-coin-name">{coin}</span>
                          </td>
                          <td className="col-time">
                            {formatTime(r.captured_at)}
                          </td>
                          <td className="col-price">{formatPrice(r.price)}</td>
                          <td
                            className={`col-change ${Number(r.change_24h) >= 0 ? "positive" : "negative"}`}
                          >
                            {r.change_24h > 0 ? "+" : ""}
                            {Number(r.change_24h).toFixed(2)}%
                          </td>
                          <td className="col-rsi">{formatRSI(r.rsi).text}</td>
                          <td className="col-momentum">{r.momentum ?? "--"}</td>
                          <td className="col-vol">
                            {formatVolume(r.volume_24h)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
