import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import homeIcon from "../assets/home.svg";
import tradeIcon from "../assets/trade.svg";
import "./Sidebar.css";

const NAV_ITEMS = [
  { icon: homeIcon, label: "Home", to: "/" },
  { icon: tradeIcon, label: "Strategies", to: "/strategies" },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebar_collapsed") === "true",
  );
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar_collapsed", String(next));
      return next;
    });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <nav className={`sidebar${collapsed ? " sidebar--collapsed" : ""}`}>
      <button
        className="sidebar-toggle"
        onClick={toggle}
        title={collapsed ? "Expand" : "Collapse"}
      >
        {collapsed ? "☰" : "✕"}
      </button>

      <ul className="sidebar-nav">
        {NAV_ITEMS.map(({ icon, label, to }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `sidebar-link${isActive ? " active" : ""}`
              }
              title={collapsed ? label : undefined}
            >
              <img src={icon} alt={label} className="sidebar-icon" />
              {!collapsed && <span className="sidebar-label">{label}</span>}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="sidebar-footer">
        <button
          className="sidebar-fullscreen-btn"
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        >
          <span className="fullscreen-icon">{isFullscreen ? "⛶" : "⛶"}</span>
          {!collapsed && <span className="fullscreen-label">{isFullscreen ? "Exit" : "Fullscreen"}</span>}
        </button>
      </div>
    </nav>
  );
}
