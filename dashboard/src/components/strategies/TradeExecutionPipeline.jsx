import { useState, useEffect, useCallback } from "react";
import "./TradeExecutionPipeline.css";

// Status icons
const StatusIcon = ({ status }) => {
  if (status === "success") {
    return (
      <svg
        className="status-icon success"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M8 12l3 3 5-6" />
      </svg>
    );
  }
  if (status === "failed") {
    return (
      <svg
        className="status-icon failed"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M8 8l8 8M16 8l-8 8" />
      </svg>
    );
  }
  if (status === "skipped") {
    return (
      <svg
        className="status-icon skipped"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M8 12h8" />
      </svg>
    );
  }
  // pending
  return (
    <svg
      className="status-icon pending"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" strokeDasharray="4 4" />
    </svg>
  );
};

// Pipeline stage component
const PipelineStage = ({ label, stage, showConnector }) => {
  const getStatusText = () => {
    if (stage.status === "success") return "Success";
    if (stage.status === "failed") return "Failed";
    if (stage.status === "skipped")
      return `Skipped${stage.reason ? `: ${stage.reason}` : ""}`;
    return "Pending";
  };

  const getStatusClass = () => {
    if (stage.status === "success") return "stage-success";
    if (stage.status === "failed") return "stage-failed";
    if (stage.status === "skipped") return "stage-skipped";
    return "stage-pending";
  };

  return (
    <div className={`pipeline-stage ${getStatusClass()}`}>
      <div className="stage-header">
        <StatusIcon status={stage.status} />
        <span className="stage-label">{label}</span>
      </div>
      <div className="stage-status">{getStatusText()}</div>
      {stage.error && (
        <div className="stage-error" title={stage.error}>
          {stage.error.length > 40
            ? stage.error.substring(0, 40) + "..."
            : stage.error}
        </div>
      )}
      {showConnector && <div className="stage-connector" />}
    </div>
  );
};

// Execution row component
const ExecutionRow = ({ execution }) => {
  const {
    coin,
    strategy,
    action,
    confidence,
    style,
    stages,
    timeAgo,
    overallStatus,
  } = execution;

  const getRowClass = () => {
    if (overallStatus === "success") return "execution-row success";
    if (overallStatus === "failed") return "execution-row failed";
    if (overallStatus === "skipped") return "execution-row skipped";
    return "execution-row pending";
  };

  const getActionClass = () => {
    return action === "BUY" ? "action-buy" : "action-sell";
  };

  return (
    <div className={getRowClass()}>
      <div className="execution-info">
        <div className="execution-header">
          <span className={`execution-action ${getActionClass()}`}>
            {action}
          </span>
          <span className="execution-coin">{coin}</span>
          <span className="execution-strategy">{strategy}</span>
          {style && (
            <span className={`execution-style style-${style}`}>{style}</span>
          )}
          <span className="execution-confidence">
            {(confidence * 100).toFixed(0)}%
          </span>
          <span className="execution-time">{timeAgo}</span>
        </div>
      </div>
      <div className="execution-pipeline">
        <PipelineStage
          label="Signal"
          stage={stages.signal}
          showConnector={true}
        />
        <PipelineStage
          label="Orchestrator"
          stage={stages.orchestrator}
          showConnector={true}
        />
        <PipelineStage
          label="HyperLiquid"
          stage={stages.hyperliquid}
          showConnector={false}
        />
      </div>
    </div>
  );
};

// Main component
export default function TradeExecutionPipeline() {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all"); // all, success, failed, pending

  const fetchExecutions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        "http://localhost:3001/api/trading/executions?limit=20",
      );
      if (res.ok) {
        const data = await res.json();
        setExecutions(data.executions || []);
        setError(null);
      } else {
        setError("Failed to fetch executions");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchExecutions();
  }, [fetchExecutions]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchExecutions, 10000);
    return () => clearInterval(interval);
  }, [fetchExecutions]);

  const filteredExecutions = executions.filter((exec) => {
    if (filter === "all") return true;
    if (filter === "success") return exec.overallStatus === "success";
    if (filter === "failed") return exec.overallStatus === "failed";
    if (filter === "pending") return exec.overallStatus === "pending";
    return true;
  });

  const getStats = () => {
    const total = executions.length;
    const success = executions.filter(
      (e) => e.overallStatus === "success",
    ).length;
    const failed = executions.filter(
      (e) => e.overallStatus === "failed",
    ).length;
    const skipped = executions.filter(
      (e) => e.overallStatus === "skipped",
    ).length;
    const pending = executions.filter(
      (e) => e.overallStatus === "pending",
    ).length;
    return { total, success, failed, skipped, pending };
  };

  const stats = getStats();

  return (
    <div className="trade-execution-pipeline">
      <div className="pipeline-header">
        <div className="pipeline-stats">
          <span className="stat success" title="Successful executions">
            ✓ {stats.success}
          </span>
          <span className="stat failed" title="Failed executions">
            ✗ {stats.failed}
          </span>
          <span className="stat skipped" title="Skipped executions">
            − {stats.skipped}
          </span>
          <span className="stat pending" title="Pending executions">
            ○ {stats.pending}
          </span>
        </div>
        <div className="pipeline-filters">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All ({stats.total})</option>
            <option value="success">Success ({stats.success})</option>
            <option value="failed">Failed ({stats.failed})</option>
            <option value="pending">Pending ({stats.pending})</option>
          </select>
          <button
            onClick={fetchExecutions}
            className="refresh-btn"
            disabled={loading}
          >
            {loading ? "↻" : "↻ Refresh"}
          </button>
        </div>
      </div>

      {error && <div className="pipeline-error">{error}</div>}

      <div className="executions-list">
        {filteredExecutions.length === 0 ? (
          <div className="no-executions">
            {loading ? "Loading..." : "No executions found"}
          </div>
        ) : (
          filteredExecutions.map((execution) => (
            <ExecutionRow key={execution.id} execution={execution} />
          ))
        )}
      </div>

      <div className="pipeline-legend">
        <div className="legend-item">
          <StatusIcon status="success" />
          <span>Success</span>
        </div>
        <div className="legend-item">
          <StatusIcon status="failed" />
          <span>Failed</span>
        </div>
        <div className="legend-item">
          <StatusIcon status="skipped" />
          <span>Skipped</span>
        </div>
        <div className="legend-item">
          <StatusIcon status="pending" />
          <span>Pending</span>
        </div>
      </div>
    </div>
  );
}
