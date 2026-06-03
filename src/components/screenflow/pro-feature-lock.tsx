"use client";

import { Lock } from "lucide-react";
import type { ReactNode } from "react";

type ProFeatureLockProps = {
  children: ReactNode;
  label?: string;
  className?: string;
};

/** Overlay discreto para recursos exclusivos do Plano PRO. */
export function ProFeatureLock({
  children,
  label = "Disponível no Plano PRO",
  className = "",
}: ProFeatureLockProps) {
  return (
    <div className={`relative ${className}`}>
      {children}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-zinc-900/5 backdrop-blur-[1px] dark:bg-zinc-950/30"
        aria-hidden
      >
        <span className="flex items-center gap-1 rounded-full border border-zinc-200/80 bg-white/90 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-zinc-600 shadow-sm dark:border-zinc-600 dark:bg-zinc-900/90 dark:text-zinc-300">
          <Lock className="size-3 opacity-70" strokeWidth={2} aria-hidden />
          {label}
        </span>
      </div>
    </div>
  );
}
