import { useState, useEffect } from "react";
import "./ModelUsageCard.css";

const PERIODS = [
  { key: "24h", label: "24h" },
  { key: "7d", label: "7d" },
  { key: "all", label: "All" },
];

function fmt(n) {
  return (n || 0).toLocaleString();
}
function cost(n, model) {
  // Only show "free" badge for ollama/ models (truly free local inference).
  // All cloud models (anthropic/, xai/, openai/, etc.) show dollar cost even if $0.00.
  if (n === 0 && (!model || model.startsWith("ollama/"))) {
    return <span className="free-badge">free</span>;
  }
  return `$${(n || 0).toFixed(4)}`;
}
function shortModel(m) {
  // "anthropic/claude-sonnet-4-6" → "claude-sonnet-4-6"
  return m.includes("/") ? m.split("/").slice(1).join("/") : m;
}

function UsageTable({ rows, columns }) {
  return (
    <div className="usage-table-wrapper">
      <table className="usage-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.cls}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key} className={c.cls}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ModelUsageCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState("24h");

  const fetchUsage = (p) => {
    setLoading(true);
    fetch(`/api/usage?period=${p}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
        setError(null);
      })
      .catch((err) => {
        setError(`Failed to load usage: ${err.message}`);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchUsage(period);
    const id = setInterval(() => fetchUsage(period), 30000);
    return () => clearInterval(id);
  }, [period]);

  const periodLabel = PERIODS.find((p) => p.key === period)?.label;

  const agentCols = [
    { key: "agent", label: "Agent", cls: "" },
    { key: "calls", label: "Calls", cls: "num-cell" },
    {
      key: "tokens_in",
      label: "Tokens In",
      cls: "num-cell",
      render: (r) => fmt(r.tokens_in),
    },
    {
      key: "tokens_out",
      label: "Tokens Out",
      cls: "num-cell",
      render: (r) => fmt(r.tokens_out),
    },
    {
      key: "cost",
      label: "Cost",
      cls: "num-cell cost-cell",
      render: (r) => cost(r.cost, r.primaryModel),
    },
  ];

  const modelCols = [
    {
      key: "model",
      label: "Model",
      cls: "model-cell",
      render: (r) => shortModel(r.model),
    },
    { key: "calls", label: "Calls", cls: "num-cell" },
    {
      key: "tokens_in",
      label: "Tokens In",
      cls: "num-cell",
      render: (r) => fmt(r.tokens_in),
    },
    {
      key: "tokens_out",
      label: "Tokens Out",
      cls: "num-cell",
      render: (r) => fmt(r.tokens_out),
    },
    {
      key: "cost",
      label: "Cost",
      cls: "num-cell cost-cell",
      render: (r) => cost(r.cost, r.model),
    },
  ];

  return (
    <div className="usage-card blur-card">
      <div className="usage-card-header">
        <span className="usage-card-title">Model Usage</span>
        <span className="usage-badge">30s refresh</span>
        <div className="usage-period-filters">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              className={`period-btn${period === p.key ? " active" : ""}`}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card-divider" />

      {loading && <p className="usage-loading">Loading...</p>}
      {error && <p className="usage-error">{error}</p>}

      {!loading && !error && data && (
        <>
          {/* ── Agents ── */}
          {data.byAgentOnly?.length === 0 ? (
            <p className="usage-empty">No agent activity in this period.</p>
          ) : (
            <UsageTable rows={data.byAgentOnly || []} columns={agentCols} />
          )}

          <div className="card-divider" />

          {/* ── Models ── */}
          {data.byModel?.length === 0 ? (
            <p className="usage-empty">No model activity in this period.</p>
          ) : (
            <UsageTable rows={data.byModel || []} columns={modelCols} />
          )}

          <div className="card-divider" />

          {/* ── Totals ── */}
          <div className="usage-total">
            <span className="row-label">Total Tokens ({periodLabel})</span>
            <span className="usage-total-value">
              {fmt(data.total_tokens_today)}
            </span>
          </div>
          <div className="usage-total usage-cost-total">
            <span className="row-label">Estimated Cost ({periodLabel})</span>
            <span className="usage-total-value cost-total-value">
              ${data.total_cost_today.toFixed(4)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
