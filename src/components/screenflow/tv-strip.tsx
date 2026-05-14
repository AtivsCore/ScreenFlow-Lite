"use client";

import { Monitor, Tv, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

const tvMonitors = [
  { id: "tv-1", label: "Recepção", status: "online" as const },
  { id: "tv-2", label: "Sala A", status: "online" as const },
  { id: "tv-3", label: "Sala B", status: "offline" as const },
];

/** Painel de status das TVs (mock até existir tabela de estado / Realtime). */
export function TvStrip() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (tvMonitors.length <= 1) return;
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % tvMonitors.length);
    }, 5000);
    return () => window.clearInterval(t);
  }, []);

  const visible = tvMonitors.length <= 1 ? tvMonitors : [tvMonitors[idx]!];

  return (
    <section className="flex min-h-[120px] flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
      <div className="flex items-center gap-2">
        <Monitor className="size-4 shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden />
        <h2 className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">TVs conectadas</h2>
        {tvMonitors.length > 1 && (
          <span className="ml-auto text-[10px] text-zinc-400">Alternância automática</span>
        )}
      </div>
      <ul className={`grid flex-1 gap-2 ${tvMonitors.length <= 1 ? "sm:grid-cols-3" : "grid-cols-1"}`}>
        {visible.map((tv) => (
          <li
            key={tv.id}
            className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-2 dark:border-zinc-600 dark:bg-zinc-800"
          >
            <Tv className="size-4 shrink-0 text-zinc-400" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium text-zinc-800 dark:text-zinc-100">{tv.label}</p>
              <p className="flex items-center gap-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                {tv.status === "online" ? (
                  <>
                    <Wifi className="size-3 text-emerald-600 dark:text-emerald-400" />
                    <span>Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="size-3 text-red-500" />
                    <span>Offline</span>
                  </>
                )}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
