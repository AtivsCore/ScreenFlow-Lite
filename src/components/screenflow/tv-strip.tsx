"use client";

import { Monitor, Tv, Wifi, WifiOff } from "lucide-react";
import { useEffect } from "react";

export type TvRow = { id: string; nome: string | null };

export type TvStripProps = {
  tvs: TvRow[];
  selectedIndex: number;
  onSelectIndex: (i: number) => void;
  autoRotate: boolean;
  onAutoRotate: (v: boolean) => void;
  /** Intervalo em ms quando automático (10–15s recomendado). */
  rotateMs?: number;
};

/** Painel de telas ativas + alternância manual/automática (estilo painel). */
export function TvStrip({
  tvs,
  selectedIndex,
  onSelectIndex,
  autoRotate,
  onAutoRotate,
  rotateMs = 12_000,
}: TvStripProps) {
  const list = tvs.length ? tvs : [{ id: "placeholder", nome: null }];
  const idx = Math.min(Math.max(0, selectedIndex), Math.max(0, list.length - 1));
  const current = list[idx] ?? list[0];

  useEffect(() => {
    if (!autoRotate || list.length <= 1) return;
    const t = window.setInterval(() => {
      onSelectIndex((selectedIndex + 1) % list.length);
    }, rotateMs);
    return () => window.clearInterval(t);
  }, [autoRotate, list.length, rotateMs, selectedIndex, onSelectIndex]);

  const label = current?.nome?.trim() || (tvs.length ? `TV ${idx + 1}` : "Nenhuma TV cadastrada");

  return (
    <section className="flex min-h-[120px] flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
      <div className="flex flex-wrap items-center gap-2">
        <Monitor className="size-4 shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden />
        <h2 className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">Telas ativas</h2>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Alternância</span>
          <button
            type="button"
            onClick={() => onAutoRotate(!autoRotate)}
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              autoRotate
                ? "bg-sky-600 text-white dark:bg-sky-500"
                : "border border-zinc-300 bg-white text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
            }`}
          >
            {autoRotate ? "Auto" : "Manual"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {list.map((tv, i) => (
          <button
            key={`${tv.id}-${i}`}
            type="button"
            onClick={() => onSelectIndex(i)}
            disabled={!tvs.length}
            className={`rounded-md px-2 py-1 text-[10px] font-medium transition disabled:opacity-40 ${
              i === idx
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-200/80 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            {tv.nome?.trim() || `TV ${i + 1}`}
          </button>
        ))}
      </div>

      <ul className="grid flex-1 gap-2 sm:grid-cols-1">
        <li className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-2 dark:border-zinc-600 dark:bg-zinc-800">
          <Tv className="size-4 shrink-0 text-zinc-400" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium text-zinc-800 dark:text-zinc-100">{label}</p>
            <p className="flex items-center gap-1 text-[10px] text-zinc-500 dark:text-zinc-400">
              {tvs.length > 0 ? (
                <>
                  <Wifi className="size-3 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    Modo painel • {autoRotate ? `troca a cada ${rotateMs / 1000}s` : "troca manual pelas abas"}
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="size-3 text-amber-600" />
                  <span>Cadastre linhas na tabela `tvs` no Supabase</span>
                </>
              )}
            </p>
          </div>
        </li>
      </ul>
    </section>
  );
}
