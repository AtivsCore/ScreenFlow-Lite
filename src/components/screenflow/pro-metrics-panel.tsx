"use client";

import { ProFeatureLock } from "@/components/screenflow/pro-feature-lock";
import { ArrowDownLeft, ArrowUpRight, Clock, UserMinus } from "lucide-react";

const METRICS = [
  { label: "Entradas", value: "—", icon: ArrowDownLeft },
  { label: "Saídas", value: "—", icon: ArrowUpRight },
  { label: "Desistências", value: "—", icon: UserMinus },
  { label: "Tempo médio", value: "—", icon: Clock },
] as const;

export function ProMetricsPanel() {
  return (
    <ProFeatureLock className="shrink-0">
      <section
        className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-200 bg-zinc-50/90 px-2 py-1.5 sm:grid-cols-4 dark:border-zinc-700 dark:bg-zinc-900/50"
        aria-label="Estatísticas do dia"
      >
        {METRICS.map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex min-w-0 items-center gap-1.5">
            <Icon className="size-3.5 shrink-0 text-zinc-400" strokeWidth={1.75} aria-hidden />
            <div className="min-w-0">
              <p className="truncate text-[8px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {label}
              </p>
              <p className="font-mono text-xs font-semibold tabular-nums text-zinc-800 dark:text-zinc-100">{value}</p>
            </div>
          </div>
        ))}
      </section>
    </ProFeatureLock>
  );
}
