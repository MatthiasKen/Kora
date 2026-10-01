"use client";
import { useEffect, useState } from "react";
export function Countdown({
  endsAt,
  compact = false,
  onExpire,
}: {
  endsAt: string;
  compact?: boolean;
  onExpire?: () => void;
}) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const next = Math.max(0, new Date(endsAt).getTime() - Date.now());
      setRemaining(next);
      if (next === 0) onExpire?.();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt, onExpire]);
  const seconds = Math.floor((remaining ?? 0) / 1000);
  const parts = [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ];
  if (compact)
    return (
      <span className="font-mono text-xs tabular-nums">
        {remaining === null
          ? "--:--:--"
          : remaining === 0
            ? "Deal ended"
            : parts.map((p) => String(p).padStart(2, "0")).join(":")}
      </span>
    );
  return (
    <div
      className="countdown"
      aria-label={
        remaining === 0 ? "Deals have ended" : "Time left in today's deals"
      }
    >
      {parts.map((part, i) => (
        <span key={i} className="contents">
          {i > 0 && <span className="countdown-colon">:</span>}
          <span className="countdown-box">
            <b>{remaining === null ? "--" : String(part).padStart(2, "0")}</b>
            <small>{["HOURS", "MINS", "SECS"][i]}</small>
          </span>
        </span>
      ))}
    </div>
  );
}
