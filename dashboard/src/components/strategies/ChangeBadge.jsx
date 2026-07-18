import "./ChangeBadge.css";

export default function ChangeBadge({ label, value }) {
  const num = Number(value);
  const cls =
    num > 0 ? "positive" : num < 0 ? "negative" : "neutral";
  const sign = num > 0 ? "+" : "";
  return (
    <span className={`change-badge ${cls}`}>
      {label}: {sign}
      {num.toFixed(2)}%
    </span>
  );
}
