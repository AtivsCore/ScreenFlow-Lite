"use client";

import { AVIACAO_HANGAR_TAG_WIDTH_CLASS } from "@/lib/aviacao-logistics";
import { ChevronLeft, ChevronRight } from "lucide-react";

type AviacaoHangarStepperProps = {
  hangarLabel: string;
  canGoPrev: boolean;
  canGoNext: boolean;
  disabled?: boolean;
  onPrev: () => void;
  onNext: () => void;
};

export function AviacaoHangarStepper({
  hangarLabel,
  canGoPrev,
  canGoNext,
  disabled = false,
  onPrev,
  onNext,
}: AviacaoHangarStepperProps) {
  return (
    <div
      className="flex w-full shrink-0 items-center justify-center gap-0.5 rounded-md border border-sky-200 bg-sky-50/80 p-0.5 dark:border-sky-900/60 dark:bg-sky-950/30"
      role="group"
      aria-label="Navegação do fluxo de hangaragem"
    >
      <button
        type="button"
        title="Coluna anterior"
        aria-label="Retroceder coluna"
        disabled={disabled || !canGoPrev}
        onClick={onPrev}
        className="flex size-7 shrink-0 items-center justify-center rounded text-sky-800 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-35 dark:text-sky-200 dark:hover:bg-sky-950/50"
      >
        <ChevronLeft className="size-4" strokeWidth={2} aria-hidden />
      </button>

      <span
        className={`${AVIACAO_HANGAR_TAG_WIDTH_CLASS} flex h-7 shrink-0 items-center justify-center px-1 text-center text-[9px] font-bold uppercase leading-tight tracking-wide text-sky-900 dark:text-sky-100`}
        title={hangarLabel}
      >
        <span className="block w-full truncate">{hangarLabel}</span>
      </span>

      <button
        type="button"
        title="Próxima coluna"
        aria-label="Avançar coluna"
        disabled={disabled || !canGoNext}
        onClick={onNext}
        className="flex size-7 shrink-0 items-center justify-center rounded text-sky-800 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-35 dark:text-sky-200 dark:hover:bg-sky-950/50"
      >
        <ChevronRight className="size-4" strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
