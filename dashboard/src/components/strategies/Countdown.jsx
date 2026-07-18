import "./Countdown.css";

export default function Countdown({ remainingMs, sourceName = "HyperLiquid" }) {
  if (remainingMs == null) return null;

  const totalSec = Math.max(0, Math.floor(remainingMs / 1000));
  const m = Math.floor(totalSec / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");

  return (
    <span className="strategies-countdown">
      Next update in{" "}
      <span className="countdown-value">
        {m}:{s}
      </span>
      <span className="countdown-source"> · via {sourceName}</span>
    </span>
  );
}
