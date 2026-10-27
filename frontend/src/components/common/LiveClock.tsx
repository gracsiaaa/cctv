import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface LiveClockProps {
  showDate?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const LiveClock: React.FC<LiveClockProps> = ({
  showDate = true,
  className = "",
  size = "md"
}) => {
  const [time, setTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = time.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const dateString = time.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  if (size === "sm") {
    return (
      <div className={`flex items-center gap-2 font-mono text-xs text-zinc-300 ${className}`}>
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span className="font-semibold text-white">{timeString}</span>
        {showDate && <span className="text-zinc-400">({dateString})</span>}
      </div>
    );
  }

  if (size === "lg") {
    return (
      <div className={`p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-xl ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
            <Clock className="w-4 h-4 text-indigo-400" />
            <span>Waktu Server CCTV</span>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/40">
            WIB
          </span>
        </div>
        <div className="mt-2 text-3xl md:text-4xl font-extrabold font-mono tracking-tight text-white">
          {timeString}
        </div>
        {showDate && (
          <div className="text-xs text-zinc-400 font-medium mt-1">
            {dateString}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 shadow-sm ${className}`}>
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
      </span>
      <div className="flex flex-col">
        <span className="font-mono font-bold text-sm text-white tracking-wide leading-tight">
          {timeString}
        </span>
        {showDate && (
          <span className="text-[10px] text-zinc-400 leading-tight">
            {dateString}
          </span>
        )}
      </div>
    </div>
  );
};
