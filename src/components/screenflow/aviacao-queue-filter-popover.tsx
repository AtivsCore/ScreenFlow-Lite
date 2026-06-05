"use client";

import { Filter } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type HangarOpt = { id: string; nome: string | null };

type AviacaoQueueFilterPopoverProps = {
  priorityOnly: boolean;
  onPriorityOnlyChange: (v: boolean) => void;
  hideAguardandoPecas: boolean;
  onHideAguardandoPecasChange: (v: boolean) => void;
  selectedHangarIds: string[];
  onSelectedHangarIdsChange: (ids: string[]) => void;
  hangarOptions: HangarOpt[];
};

export function AviacaoQueueFilterPopover({
  priorityOnly,
  onPriorityOnlyChange,
  hideAguardandoPecas,
  onHideAguardandoPecasChange,
  selectedHangarIds,
  onSelectedHangarIdsChange,
  hangarOptions,
}: AviacaoQueueFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const activeCount =
    (priorityOnly ? 1 : 0) +
    (hideAguardandoPecas ? 1 : 0) +
    (selectedHangarIds.length > 0 ? 1 : 0);

  const close = useCallback(() => {
    setOpen(false);
    setCoords(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      const panel = document.getElementById("sf-aviacao-filter-panel");
      if (panel?.contains(t)) return;
      close();
    };
    const onScroll = () => close();
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, close]);

  function toggleOpen() {
    if (open) {
      close();
      return;
    }
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({ top: rect.bottom + 4, left: Math.max(8, rect.left) });
    setOpen(true);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title="Filtros da fila"
        aria-label="Filtros da fila"
        aria-expanded={open}
        onClick={toggleOpen}
        className={`relative flex size-6 shrink-0 items-center justify-center rounded-md border transition ${
          activeCount > 0
            ? "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
            : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
        }`}
      >
        <Filter className="size-3.5" strokeWidth={2} aria-hidden />
        {activeCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-sky-600 text-[8px] font-bold text-white">
            {activeCount}
          </span>
        ) : null}
      </button>

      {open && coords
        ? createPortal(
            <div
              id="sf-aviacao-filter-panel"
              role="dialog"
              aria-label="Filtros da fila de rampa"
              className="fixed z-[200] w-56 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
              style={{ top: coords.top, left: coords.left }}
            >
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Filtros
              </p>
              <div className="flex flex-col gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={priorityOnly}
                    onChange={(e) => onPriorityOnlyChange(e.target.checked)}
                    className="size-3.5 rounded border-zinc-300"
                  />
                  Exibir Apenas Prioritários
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={hideAguardandoPecas}
                    onChange={(e) => onHideAguardandoPecasChange(e.target.checked)}
                    className="size-3.5 rounded border-zinc-300"
                  />
                  Esconder &quot;Aguardando Peças&quot;
                </label>
                {hangarOptions.length > 0 ? (
                  <div className="border-t border-zinc-100 pt-2 dark:border-zinc-800">
                    <p className="mb-1 text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
                      Hangares
                    </p>
                    <div className="flex max-h-28 flex-col gap-1 overflow-y-auto">
                      {hangarOptions.map((h) => {
                        const checked = selectedHangarIds.includes(h.id);
                        return (
                          <label
                            key={h.id}
                            className="inline-flex cursor-pointer items-center gap-2 text-[11px] font-normal text-zinc-700 dark:text-zinc-300"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...selectedHangarIds, h.id]
                                  : selectedHangarIds.filter((id) => id !== h.id);
                                onSelectedHangarIdsChange(next);
                              }}
                              className="size-3.5 rounded border-zinc-300"
                            />
                            <span className="truncate">{h.nome ?? h.id}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
