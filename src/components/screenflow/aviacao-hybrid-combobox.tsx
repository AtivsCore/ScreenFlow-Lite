"use client";

import type { AviacaoComboboxOption } from "@/lib/aviacao-logistics";
import { Plus, X } from "lucide-react";
import { useMemo } from "react";

export type { AviacaoComboboxOption };

type AviacaoHybridComboboxProps = {
  instanceId: string;
  label: string;
  value: string;
  options: AviacaoComboboxOption[];
  disabled?: boolean;
  showQuickAdd?: boolean;
  quickAddDisabled?: boolean;
  onChange: (value: string) => void;
  onQuickAdd?: () => void;
  size?: "compact" | "modal";
  wrapperClassName?: string;
  requiredMark?: React.ReactNode;
};

export function AviacaoHybridCombobox({
  instanceId,
  label,
  value,
  options,
  disabled = false,
  showQuickAdd = true,
  quickAddDisabled = false,
  onChange,
  onQuickAdd,
  size = "compact",
  wrapperClassName,
  requiredMark,
}: AviacaoHybridComboboxProps) {
  const listId = `sf-datalist-${instanceId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const isCompact = size === "compact";

  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const opt of options) {
      const text = opt.label.trim();
      if (!text || seen.has(text.toLowerCase())) continue;
      seen.add(text.toLowerCase());
      out.push(text);
    }
    return out;
  }, [options]);

  const wrapper =
    wrapperClassName ??
    (isCompact
      ? "col-span-1 min-w-0 block text-[10px] font-medium text-zinc-600 dark:text-zinc-400"
      : "block text-xs font-medium text-zinc-600 dark:text-zinc-400");

  const controlClass = isCompact
    ? "w-full rounded-md border border-zinc-300 bg-white py-1.5 pl-2 pr-7 text-[11px] text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
    : "mt-1 w-full rounded-lg border border-zinc-300 bg-white py-2 pl-3 pr-8 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50";

  return (
    <label className={wrapper}>
      {showQuickAdd ? (
        <span
          className={
            isCompact
              ? "flex h-4 items-center justify-between gap-1"
              : "flex items-center justify-between gap-1"
          }
        >
          <span className={isCompact ? "min-w-0 truncate leading-4" : undefined}>
            {label}
            {requiredMark}
          </span>
          <button
            type="button"
            title={`Cadastrar ${label.toLowerCase()}`}
            disabled={quickAddDisabled}
            onClick={onQuickAdd}
            className="inline-flex size-5 shrink-0 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-600 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Plus className="size-3" strokeWidth={2} aria-hidden />
            <span className="sr-only">Cadastrar {label}</span>
          </button>
        </span>
      ) : (
        <span className={isCompact ? "block h-4 truncate leading-4" : undefined}>
          {label}
          {requiredMark}
        </span>
      )}

      <div className={isCompact ? "relative mt-0.5" : "relative"}>
        <input
          type="text"
          list={listId}
          value={value}
          disabled={disabled}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
          className={controlClass}
        />
        {value && !disabled ? (
          <button
            type="button"
            title="Limpar campo"
            aria-label="Limpar campo"
            onClick={() => onChange("")}
            className={`absolute top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 ${
              isCompact ? "right-1" : "right-2"
            }`}
          >
            <X className={isCompact ? "size-3" : "size-3.5"} strokeWidth={2} aria-hidden />
          </button>
        ) : null}
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
    </label>
  );
}
