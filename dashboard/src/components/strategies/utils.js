// Schedule (5-min window) - same as Trading page
//   :00 -> Data fetch fires (second 0)
//   :01 -> Analysts fire   (second 60)
//   :04 -> Orchestrator fires (second 240)
export function getSecsUntilFire(fireSecInWindow) {
  const now = new Date();
  const totalSec = now.getMinutes() * 60 + now.getSeconds();
  const windowSec = 300; // 5 min
  const posInWindow = totalSec % windowSec;

  let secsUntil;
  if (posInWindow < fireSecInWindow) {
    secsUntil = fireSecInWindow - posInWindow;
  } else if (posInWindow === fireSecInWindow) {
    secsUntil = windowSec; // just fired, next window
  } else {
    secsUntil = windowSec - posInWindow + fireSecInWindow;
  }
  return secsUntil;
}

export function formatSecsCountdown(secs) {
  const s = Math.max(0, Math.floor(secs));
  const m = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

export function formatPrice(price) {
  if (price == null) return "--";
  return (
    "$" +
    Number(price).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function formatRSI(rsi) {
  if (rsi == null) return "--";
  const val = Number(rsi).toFixed(1);
  let cls = "neutral";
  if (rsi > 70) cls = "high";
  if (rsi < 30) cls = "low";
  return { text: val, className: cls };
}

export function formatVolume(vol) {
  if (vol == null) return "--";
  const v = Number(vol);
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(2) + "K";
  return v.toFixed(2);
}

export function formatTime(ts) {
  if (!ts) return "--";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
