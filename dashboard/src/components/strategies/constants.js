import btcSvg from "../../assets/btc.svg";
import ethSvg from "../../assets/eth.svg";
import solSvg from "../../assets/sol.svg";

export const COIN_ICON = { BTC: btcSvg, ETH: ethSvg, SOL: solSvg };
export const COIN_COLOR = { BTC: "#f7931a", ETH: "#627eea", SOL: "#9945ff" };
export const COIN_ORDER = ["BTC", "ETH", "SOL"];

export const TYPE_COLORS = {
  scalp: "#7dd4b0",
  swing: "#60a5fa",
  trend: "#fbbf24",
  mean: "#f87171",
  momentum: "#a78bfa",
  breakout: "#f472b6",
  default: "#9ca3af",
};

export const STYLE_BADGES = {
  scalp: { label: " scalp", color: "#7dd4b0" },
  swing: { label: "swing", color: "#60a5fa" },
  trend: { label: "trend", color: "#fbbf24" },
  mean: { label: "mean", color: "#f87171" },
  momentum: { label: " momentum", color: "#a78bfa" },
  breakout: { label: "break", color: "#f472b6" },
};
