import { useState, useEffect } from "react";
import "./CostSummary.css";

const PERIODS = [
  { key: "24h", label: "24h" },
  { key: "7d",  label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "all", label: "All time" },
];

function formatCost(n) {
  if (n === null || n === undefined) return "—";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function formatTokens(n) {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString();
}

export default function CostSummary() {
  const [stats, setStats] = useState(PERIODS.map(() => null));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all(
      PERIODS.map((p) =>
        fetch(`http://localhost:3001/api/usage?period=${p.key}`)
          .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
          .catch(() => null)
      )
    ).then((results) => {
      setStats(results);
      setLoading(false);
    });
  }, []);

  function getStat(data) {
    if (!data || !data.byModel) return { tokens: null, cost: null };
    const tokens = data.byModel.reduce((sum, m) => sum + (m.tokens_in || 0) + (m.tokens_out || 0), 0);
    const cost = data.byModel.reduce((sum, m) => sum + (m.cost || 0), 0);
    return { tokens, cost };
  }

  return (
    <div className="cost-summary-section">
      <h2 className="cost-summary-heading">Costs</h2>
      <div className="cost-summary-boxes">
        {PERIODS.map((p, i) => {
          const stat = loading ? { tokens: null, cost: null } : getStat(stats[i]);
          return (
            <div key={p.key} className="cost-box">
              <span className="cost-box-period">{p.label}</span>
              <span className="cost-box-tokens">
                {stat.tokens === null ? "—" : formatTokens(stat.tokens)}
              </span>
              <span className="cost-box-label">tokens</span>
              <span className="cost-box-cost">
                {stat.cost === null ? "—" : formatCost(stat.cost)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
