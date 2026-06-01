"use client";

import {
  CLASSIFICACAO_SELECTOR_OPTIONS,
  type ClassificacaoPrioridade,
} from "@/lib/classificacao-prioridade";

type PriorityClassSelectorProps = {
  value: ClassificacaoPrioridade;
  onChange: (value: ClassificacaoPrioridade) => void;
  disabled?: boolean;
  label?: string;
};

export function PriorityClassSelector({
  value,
  onChange,
  disabled,
  label = "Classificação (lei de prioridade)",
}: PriorityClassSelectorProps) {
  return (
    <fieldset className="block">
      <legend className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</legend>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {CLASSIFICACAO_SELECTOR_OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={`rounded-lg px-2 py-2 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                active ? opt.activeClass : opt.idleClass
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
