import { useState, useEffect, useCallback, useRef } from "react";
import { COIN_ICON, COIN_COLOR } from "./constants";
import "./SignalsList.css";

// PageNumbers component - shows max 10 pages (1-10), no ellipsis
function PageNumbers({ currentPage, totalPages, onPageChange, disabled }) {
  const getPageNumbers = () => {
    const maxPages = Math.min(10, totalPages);
    const pages = [];
    for (let i = 1; i <= maxPages; i++) {
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
          className={`page-btn number ${currentPage === pageNum ? "active" : ""}`}
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

export default function SignalsList({ initialSignals }) {
  // Handle both old format (array) and new format (object with signals/pagination)
  const isNewFormat =
    initialSignals &&
    typeof initialSignals === "object" &&
    !Array.isArray(initialSignals);
  const initialSignalsList = isNewFormat
    ? initialSignals.signals
    : Array.isArray(initialSignals)
      ? initialSignals
      : [];
  const initialPagination = isNewFormat
    ? initialSignals.pagination
    : { page: 1, limit: 10, total: 0, totalPages: 1 };

  const [signals, setSignals] = useState(initialSignalsList || []);
  const [pagination, setPagination] = useState(
    initialPagination || { page: 1, limit: 10, total: 0, totalPages: 1 },
  );
  const [filters, setFilters] = useState({ action: "ALL", minConfidence: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [hasFetched, setHasFetched] = useState(false);

  // Fetch signals with pagination - use refs to avoid circular dependencies
  const pageRef = useRef(page);
  const limitRef = useRef(limit);
  const filtersRef = useRef(filters);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);
  useEffect(() => {
    limitRef.current = limit;
  }, [limit]);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const fetchSignals = useCallback(
    async (
      newPage = pageRef.current,
      newLimit = limitRef.current,
      newFilters = filtersRef.current,
    ) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: newPage.toString(),
          limit: newLimit.toString(),
          action: newFilters.action,
          minConfidence: newFilters.minConfidence.toString(),
        });

        const res = await fetch(`/api/trading/signals?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        // Handle both old format (array) and new format (object)
        const signalData = Array.isArray(data) ? data : data.signals || [];
        const paginationData = Array.isArray(data)
          ? {
              page: newPage,
              limit: newLimit,
              total: signalData.length,
              totalPages: 1,
            }
          : data.pagination || {
              page: newPage,
              limit: newLimit,
              total: 0,
              totalPages: 1,
            };

        setSignals(signalData);
        setPagination(paginationData);
      } catch (err) {
        console.error("Failed to fetch signals:", err);
      } finally {
        setLoading(false);
        setHasFetched(true);
      }
    },
    [], // No dependencies - uses refs
  );

  // Initial load - fetch immediately on mount
  useEffect(() => {
    if (!hasFetched) {
      fetchSignals(1, 10, { action: "ALL", minConfidence: 0 });
    }
  }, [hasFetched, fetchSignals]);

  // Update when filters/page change
  useEffect(() => {
    if (hasFetched) {
      fetchSignals(page, limit, filters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, filters, hasFetched]); // fetchSignals excluded - uses refs

  // Update when initialSignals prop changes (from parent refresh)
  useEffect(() => {
    if (initialSignals) {
      const newIsNewFormat =
        typeof initialSignals === "object" && !Array.isArray(initialSignals);
      const newSignals = newIsNewFormat
        ? initialSignals.signals
        : Array.isArray(initialSignals)
          ? initialSignals
          : [];
      const newPagination = newIsNewFormat
        ? initialSignals.pagination
        : { page: 1, limit: 10, total: 0, totalPages: 1 };

      if (newSignals && newSignals.length > 0) {
        setSignals(newSignals);
        setPagination(newPagination);
      }
    }
  }, [initialSignals]);

  const handleFilterChange = (newAction) => {
    setFilters((prev) => ({ ...prev, action: newAction }));
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

  // Style comes from API (sig.style), fallback to extracting from notes for legacy
  const extractStyle = (sig) => {
    if (sig.style) return sig.style.toLowerCase();
    if (!sig.notes) return null;
    const match = sig.notes.match(/\[(SWING|SCALP)\]/i);
    return match ? match[1].toLowerCase() : null;
  };

  return (
    <div className="signals-list-container">
      <div className="signals-header">
        <div className="signals-filter">
          <button
            className={filters.action === "ALL" ? "active" : ""}
            onClick={() => handleFilterChange("ALL")}
          >
            All ({pagination.total})
          </button>
          <button
            className={filters.action === "BUY" ? "active" : ""}
            onClick={() => handleFilterChange("BUY")}
          >
            Buy
          </button>
          <button
            className={filters.action === "SELL" ? "active" : ""}
            onClick={() => handleFilterChange("SELL")}
          >
            Sell
          </button>
          <button
            className={filters.action === "HOLD" ? "active" : ""}
            onClick={() => handleFilterChange("HOLD")}
          >
            Hold
          </button>
        </div>

        <div className="signals-pagination-controls">
          <select
            className="limit-select"
            value={limit}
            onChange={(e) => handleLimitChange(e.target.value)}
          >
            <option value="10">10 / page</option>
            <option value="25">25 / page</option>
            <option value="50">50 / page</option>
            <option value="100">100 / page</option>
          </select>

          <div className="pagination-info">
            Page {pagination.page} of {Math.min(10, pagination.totalPages)}
          </div>

          <PageNumbers
            currentPage={page}
            totalPages={pagination.totalPages}
            onPageChange={handlePageChange}
            disabled={loading}
          />
        </div>
      </div>

      {loading && <div className="signals-loading">Loading signals...</div>}

      {!loading && signals.length === 0 ? (
        <div className="signals-empty">No signals match your filter.</div>
      ) : (
        <>
          <div className="signals-list">
            {signals.map((sig, idx) => {
              const style = extractStyle(sig);
              return (
                <div
                  key={idx}
                  className={`signal-row ${sig.action?.toLowerCase()}`}
                >
                  <div className="signal-coin">
                    {COIN_ICON[sig.coin] && (
                      <img
                        src={COIN_ICON[sig.coin]}
                        alt={sig.coin}
                        className="signal-coin-icon"
                      />
                    )}
                    <span>{sig.coin}</span>
                    {style && (
                      <span className={`signal-style-badge ${style}`}>
                        {style}
                      </span>
                    )}
                  </div>
                  <span
                    className={`signal-action ${sig.action?.toLowerCase()}`}
                  >
                    {sig.action}
                  </span>
                  <div className="signal-confidence">
                    <div className="confidence-bar">
                      <div
                        className="confidence-fill"
                        style={{ width: `${(sig.confidence || 0) * 100}%` }}
                      ></div>
                    </div>
                    <span className="confidence-value">
                      {((sig.confidence || 0) * 100).toFixed(0)}%
                    </span>
                  </div>

                  <span className="signal-strategy">{sig.strategy}</span>
                  <span className="signal-time">{sig.timeAgo || sig.time}</span>

                  {sig.notes && (
                    <div className="signal-notes" title={sig.notes}>
                      {sig.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="signals-footer">
            <div className="pagination-summary">
              Showing {(pagination.page - 1) * pagination.limit + 1} -{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
              of {pagination.total} signals
            </div>
          </div>
        </>
      )}
    </div>
  );
}
