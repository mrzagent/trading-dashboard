import { useState, useEffect } from "react";
import "./Home.css";
import { RiskSummary } from "../components/strategies";
import { HealthMonitor } from "../components/strategies";
import PositionsTable from "../components/strategies/PositionsTable";
import CoinCard from "../components/strategies/CoinCard";

import hyperliquid from "../assets/hyperliquid-dark.png";

export default function Home() {
  const [account, setAccount] = useState(null);
  const [positions, setPositions] = useState([]);
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch account info
  const fetchAccount = async () => {
    try {
      const response = await fetch("http://localhost:3001/api/trading/account");
      if (!response.ok) throw new Error("Failed to fetch account");
      const data = await response.json();
      setAccount(data);
    } catch (err) {
      console.error("Account fetch error:", err);
    }
  };

  // Fetch positions
  const fetchPositions = async () => {
    try {
      const response = await fetch(
        "http://localhost:3001/api/trading/positions",
      );
      if (!response.ok) throw new Error("Failed to fetch positions");
      const data = await response.json();
      setPositions(data.positions || []);
    } catch (err) {
      console.error("Positions fetch error:", err);
    }
  };

  // Fetch prices
  const fetchPrices = async () => {
    try {
      const response = await fetch("http://localhost:3001/api/trading");
      if (!response.ok) throw new Error("Failed to fetch prices");
      const data = await response.json();
      setPrices(data.latest || []);
    } catch (err) {
      console.error("Prices fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Update settings
  const handleUpdateSettings = async (settings) => {
    try {
      const response = await fetch(
        "http://localhost:3001/api/trading/account",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings),
        },
      );
      if (!response.ok) throw new Error("Failed to update settings");
      await fetchAccount();
    } catch (err) {
      console.error("Settings update error:", err);
    }
  };

  useEffect(() => {
    fetchAccount();
    fetchPositions();
    fetchPrices();

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchAccount();
      fetchPositions();
      fetchPrices();
    }, 30000);

    // Also refresh when tab becomes visible (handles browser throttling)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchAccount();
        fetchPositions();
        fetchPrices();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  if (loading) {
    return <div className="home-wrapper loading">Loading dashboard...</div>;
  }

  return (
    <div className="home-wrapper">
      <div className="d-flex f-align-center f-justify-between">
        <h1 className="page-title">Trading Dashboard</h1>
        <div className="exchange-info">
          <img src={hyperliquid} alt="Hyperliquid" />
        </div>
      </div>

      {/* Risk Summary / Trading Status */}
      <section className="home-section">
        <RiskSummary
          account={account}
          onUpdateSettings={handleUpdateSettings}
        />
      </section>

      {/* Market Overview */}
      <section className="home-section">
        <h2 className="section-title">Market Overview</h2>
        <div className="market-overview">
          <HealthMonitor />
          <div className="market-grid">
            {prices.map((coin) => (
              <CoinCard key={coin.coin} row={coin} />
            ))}
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section className="home-section">
        <h2 className="section-title">Open Positions</h2>
        <PositionsTable positions={positions} />
      </section>
    </div>
  );
}
