"use client";

import {
  DOCAS_STATUS_TAG_WIDTH_CLASS,
  type DocasQueueTabId,
} from "@/lib/docas-logistics";
import { ChevronLeft, ChevronRight } from "lucide-react";

type DocasStatusStepperProps = {
  stepLabel: string;
  currentStep: DocasQueueTabId;
  canGoPrev: boolean;
  canGoNext: boolean;
  disabled?: boolean;
  onPrev: () => void;
  onNext: () => void;
};

export function DocasStatusStepper({
  stepLabel,
  canGoPrev,
  canGoNext,
  disabled = false,
  onPrev,
  onNext,
}: DocasStatusStepperProps) {
  return (
    <div
      className="ml-1 flex shrink-0 items-center gap-0.5 rounded-md border border-orange-200 bg-orange-50/80 p-0.5 dark:border-orange-900/60 dark:bg-orange-950/30"
      role="group"
      aria-label="Controle de status da esteira logística"
    >
      <button
        type="button"
        title="Etapa anterior"
        aria-label="Retroceder etapa"
        disabled={disabled || !canGoPrev}
        onClick={onPrev}
        className="flex size-7 shrink-0 items-center justify-center rounded text-orange-800 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-35 dark:text-orange-200 dark:hover:bg-orange-950/50"
      >
        <ChevronLeft className="size-4" strokeWidth={2} aria-hidden />
      </button>

      <span
        className={`${DOCAS_STATUS_TAG_WIDTH_CLASS} flex h-7 shrink-0 items-center justify-center px-1 text-center text-[9px] font-bold uppercase leading-tight tracking-wide text-orange-900 dark:text-orange-100`}
        title={stepLabel}
      >
        <span className="block w-full truncate">{stepLabel}</span>
      </span>

      <button
        type="button"
        title="Próxima etapa"
        aria-label="Avançar etapa"
        disabled={disabled || !canGoNext}
        onClick={onNext}
        className="flex size-7 shrink-0 items-center justify-center rounded text-orange-800 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-35 dark:text-orange-200 dark:hover:bg-orange-950/50"
      >
        <ChevronRight className="size-4" strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
