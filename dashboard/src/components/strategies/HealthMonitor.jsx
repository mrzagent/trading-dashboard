import { useState, useEffect } from "react";
import "./HealthMonitor.css";

export function HealthMonitor() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHealth = async () => {
    try {
      const response = await fetch("http://localhost:3001/api/trading/health");
      if (!response.ok) throw new Error("Failed to fetch health");
      const data = await response.json();
      setHealth(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading)
    return (
      <div className="health-monitor loading">Checking system health...</div>
    );
  if (error)
    return (
      <div className="health-monitor error">Health check failed: {error}</div>
    );
  if (!health) return null;

  const getStatusIcon = () => {
    switch (health.status) {
      case "healthy":
        return "✓";
      case "warning":
        return "⚠";
      case "error":
        return "✗";
      default:
        return "?";
    }
  };

  const getStatusClass = () => {
    switch (health.status) {
      case "healthy":
        return "status-healthy";
      case "warning":
        return "status-warning";
      case "error":
        return "status-error";
      default:
        return "status-unknown";
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000 / 60); // minutes
    if (diff < 1) return "Just now";
    if (diff === 1) return "1 minute ago";
    if (diff < 60) return `${diff} minutes ago`;
    const hours = Math.floor(diff / 60);
    if (hours === 1) return "1 hour ago";
    return `${hours} hours ago`;
  };

  return (
    <div>
      <div className={`health-monitor ${getStatusClass()}`}>
        <div className="health-header">
          <span className={`health-status ${getStatusClass()}`}>
            {(health.status || "unknown").toUpperCase()}
            <span className="health-icon">{getStatusIcon()}</span>
          </span>
        </div>

        {health.issues && health.issues.length > 0 && (
          <div className="health-issues">
            {health.issues.map((issue, i) => (
              <div key={i} className="health-issue">
                ⚠ {issue}
              </div>
            ))}
          </div>
        )}

        <div className="health-details">
          <div className="health-row">
            <span className="health-label">Last Orchestrator Run:</span>
            <span className="health-value">
              {health.orchestrator?.taskStatus?.LastRunTime
                ? formatTime(
                    new Date(
                      parseInt(
                        health.orchestrator.taskStatus.LastRunTime.replace(
                          /\/Date\((\d+)\)\//,
                          "$1",
                        ),
                      ),
                    ),
                  )
                : "Unknown"}
            </span>
          </div>

          <div className="health-row">
            <span className="health-label">Trade State:</span>
            <span className="health-value">
              {health.tradeState?.minutesSinceUpdate !== undefined
                ? `${health.tradeState.minutesSinceUpdate} min ago`
                : "Unknown"}
            </span>
          </div>

          {health.lastSignal && (
            <div className="health-row">
              <span className="health-label">Last Signal:</span>
              <span className="health-value">
                {health.lastSignal.coin} {health.lastSignal.action}(
                {formatTime(health.lastSignal.created_at)})
              </span>
            </div>
          )}
        </div>

        <div className="health-footer">
          <button onClick={fetchHealth} className="health-refresh">
            Refresh
          </button>
          <span className="health-timestamp">
            Updated: {new Date(health.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
}
