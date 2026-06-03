"use client";

import { Lock } from "lucide-react";

type ProFutureScheduleSectionProps = {
  proActive: boolean;
  value: string;
  onChange: (value: string) => void;
  onRequestUpgrade: () => void;
  disabled?: boolean;
};

export function ProFutureScheduleSection({
  proActive,
  value,
  onChange,
  onRequestUpgrade,
  disabled = false,
}: ProFutureScheduleSectionProps) {
  if (proActive) {
    return (
      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Agendamento futuro (data/hora marcada)
        <input
          type="datetime-local"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
        />
      </label>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onRequestUpgrade}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onRequestUpgrade();
        }
      }}
      className="cursor-pointer rounded-lg border border-zinc-200 bg-zinc-100/80 p-3 opacity-60 dark:border-zinc-700 dark:bg-zinc-800/50"
    >
      <div className="mb-2 flex items-center gap-2">
        <Lock className="size-4 shrink-0 text-zinc-500" strokeWidth={1.75} aria-hidden />
        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          Agendamento futuro (data/hora marcada)
        </span>
        <span className="ml-auto rounded-full border border-zinc-300 bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-zinc-500 dark:border-zinc-600 dark:bg-zinc-900">
          Plano PRO
        </span>
      </div>
      <input
        type="datetime-local"
        disabled
        value=""
        readOnly
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900/60"
      />
      <p className="mt-1.5 text-[10px] text-zinc-500 dark:text-zinc-500">
        Toque para conhecer o Plano PRO e agendar atendimentos futuros.
      </p>
    </div>
  );
}
