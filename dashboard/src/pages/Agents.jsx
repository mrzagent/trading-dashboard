import { useState, useEffect } from "react";
import AgentCard from "../components/AgentCard";
import "./Agents.css";

export default function Agents() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchAgents = () => {
    fetch("http://localhost:3001/api/agents")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setAgents(data);
        setLastUpdated(new Date());
        setLoading(false);
      })
      .catch((err) => {
        setError(`Failed to load agents: ${err.message}`);
        setLoading(false);
      });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // First refresh metadata from IDENTITY.md files
      const refreshRes = await fetch("http://localhost:3001/api/agents/refresh", {
        method: "POST"
      });
      if (!refreshRes.ok) throw new Error(`Refresh failed: ${refreshRes.status}`);
      
      // Then fetch the updated agent list
      await fetchAgents();
    } catch (err) {
      setError(`Refresh failed: ${err.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 30000);
    return () => clearInterval(interval);
  }, []);

  const activeAgents = agents.filter(a => a.current_task).length;
  const totalAgents = agents.length;

  return (
    <div className="container agents-wrapper">
      <div className="agents-header">
        <h1 className="agents-title">
          Agents
          {!loading && !error && (
            <span className="agent-count-badge">
              {activeAgents}/{totalAgents} active
            </span>
          )}
        </h1>
        <div className="agents-actions">
          {lastUpdated && (
            <span className="last-updated">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button 
            className="refresh-btn" 
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh agent metadata from IDENTITY.md files"
          >
            {refreshing ? "Refreshing..." : "🔄 Refresh"}
          </button>
        </div>
      </div>

      {loading && <p className="agents-loading">Loading agents...</p>}
      {error && <p className="agents-error">{error}</p>}

      {!loading && !error && (
        <div className="agent-grid">
          {agents.map((agent) => (
            <AgentCard key={agent.agent_name} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}
