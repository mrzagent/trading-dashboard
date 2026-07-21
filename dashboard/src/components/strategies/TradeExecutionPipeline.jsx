import { useState, useEffect, useCallback } from "react";
import "./TradeExecutionPipeline.css";

// PageNumbers component - shows sliding window of 10 pages around current page
function PageNumbers({ currentPage, totalPages, onPageChange, disabled }) {
  const getPageNumbers = () => {
    const maxVisible = 10;
    let startPage, endPage;
    
    if (totalPages <= maxVisible) {
      startPage = 1;
      endPage = totalPages;
    } else {
      const halfVisible = Math.floor(maxVisible / 2);
      
      if (currentPage <= halfVisible) {
        startPage = 1;
        endPage = maxVisible;
      } else if (currentPage + halfVisible >= totalPages) {
        startPage = totalPages - maxVisible + 1;
        endPage = totalPages;
      } else {
        startPage = currentPage - halfVisible;
        endPage = currentPage + halfVisible - 1;
      }
    }
    
    const pages = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div className="page-numbers">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1 || disabled}
        className="page-btn nav"
      >
        ←
      </button>

      {pages.map((pageNum) => (
        <button
          key={pageNum}
          onClick={() => onPageChange(pageNum)}
          disabled={disabled}
          className={`page-btn ${pageNum === currentPage ? "active" : ""}`}
        >
          {pageNum}
        </button>
      ))}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages || disabled}
        className="page-btn nav"
      >
        →
      </button>
    </div>
  );
}

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
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  const fetchExecutions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `http://localhost:3001/api/trading/executions?page=${page}&limit=${limit}&status=${filter}`,
      );
      if (res.ok) {
        const data = await res.json();
        setExecutions(data.executions || []);
        setPagination(data.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
        setError(null);
      } else {
        setError("Failed to fetch executions");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, filter]);

  // Initial fetch and when params change
  useEffect(() => {
    fetchExecutions();
  }, [fetchExecutions]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchExecutions, 10000);
    return () => clearInterval(interval);
  }, [fetchExecutions]);

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setPage(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPage(newPage);
    }
  };

  const handleLimitChange = (newLimit) => {
    setLimit(parseInt(newLimit));
    setPage(1);
  };

  const getStats = () => {
    const total = pagination.total;
    // These would ideally come from a separate stats endpoint
    // For now, calculate from visible executions
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
            onChange={(e) => handleFilterChange(e.target.value)}
            className="filter-select"
          >
            <option value="all">All ({pagination.total})</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
            <option value="pending">Pending</option>
          </select>
          <select
            className="limit-select"
            value={limit}
            onChange={(e) => handleLimitChange(e.target.value)}
          >
            <option value="10">10 / page</option>
            <option value="25">25 / page</option>
            <option value="50">50 / page</option>
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
        {executions.length === 0 ? (
          <div className="no-executions">
            {loading ? "Loading..." : "No executions found"}
          </div>
        ) : (
          executions.map((execution) => (
            <ExecutionRow key={execution.id} execution={execution} />
          ))
        )}
      </div>

      <div className="pipeline-footer">
        <div className="pagination-info">
          Page {pagination?.page ?? 1} of {pagination?.totalPages ?? 1}
        </div>
        <PageNumbers
          currentPage={page}
          totalPages={pagination?.totalPages ?? 1}
          onPageChange={handlePageChange}
          disabled={loading}
        />
        <div className="pagination-summary">
          Showing {((pagination?.page ?? 1) - 1) * (pagination?.limit ?? 10) + 1} -{" "}
          {Math.min((pagination?.page ?? 1) * (pagination?.limit ?? 10), pagination?.total ?? 0)}{" "}
          of {pagination?.total ?? 0} executions
        </div>
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
