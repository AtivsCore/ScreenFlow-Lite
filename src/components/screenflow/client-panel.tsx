"use client";

import type { AtendimentoLite } from "@/lib/atendimentos-lite";
import { SERVICES_TABLE } from "@/lib/db-tables";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

type Opt = { id: string; nome: string | null };

type ClientPanelProps = {
  selected: AtendimentoLite | null;
  loading: boolean;
  supabase: SupabaseClient | null;
  canMutate: boolean;
  pending: boolean;
  priorityLawEnabled: boolean;
  onChamar: () => void;
  onRechamar: () => void;
  onFinalizar: () => void;
  onLimpar: () => void;
  onPatch: (patch: {
    profissional_id?: string | null;
    local_id?: string | null;
    especialidade_id?: string | null;
    tv_id?: string | null;
    observacao?: string | null;
  }) => Promise<void>;
};

export function ClientPanel({
  selected,
  loading,
  supabase,
  canMutate,
  pending,
  priorityLawEnabled,
  onChamar,
  onRechamar,
  onFinalizar,
  onLimpar,
  onPatch,
}: ClientPanelProps) {
  const [profissionais, setProfissionais] = useState<Opt[]>([]);
  const [locais, setLocais] = useState<Opt[]>([]);
  const [servicos, setServicos] = useState<Opt[]>([]);
  const [tvs, setTvs] = useState<Opt[]>([]);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    void (async () => {
      const [p, l, s, t] = await Promise.all([
        supabase.from("profissionais").select("id,nome").order("nome"),
        supabase.from("locais").select("id,nome").order("nome"),
        supabase.from(SERVICES_TABLE).select("id,nome").order("nome"),
        supabase.from("tvs").select("id,nome").order("nome"),
      ]);
      if (cancelled) return;
      setProfissionais(((p.error ? null : p.data) as Opt[] | null) ?? []);
      setLocais(((l.error ? null : l.data) as Opt[] | null) ?? []);
      setServicos(((s.error ? null : s.data) as Opt[] | null) ?? []);
      setTvs(((t.error ? null : t.data) as Opt[] | null) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const profissionalValue = selected?.profissional_id ?? "";
  const localValue = selected?.local_id ?? "";
  const servicoValue = selected?.especialidade_id ?? "";
  const tvValue = selected?.tv_id ?? "";

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Cliente selecionado
          </p>
          {selected ? (
            <>
              <p className="mt-0.5 truncate text-base font-semibold leading-tight text-zinc-900 dark:text-zinc-50">
                {selected.nome ?? "—"}
              </p>
              {priorityLawEnabled ? (
                <p className="mt-1.5 inline-flex rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-950/80 dark:text-amber-200">
                  {selected.prioridade === true ? "Prioritário" : "Regular"}
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {loading ? "Carregando fila…" : "Clique em uma linha na fila para chamar."}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
          Local / ponto de atendimento
          <select
            value={localValue}
            disabled={!selected || !canMutate || pending}
            onChange={(e) => {
              const v = e.target.value;
              void onPatch({ local_id: v || null });
            }}
            className="mt-0.5 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-[11px] text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="">—</option>
            {locais.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome ?? x.id}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
          Profissional
          <select
            value={profissionalValue}
            disabled={!selected || !canMutate || pending}
            onChange={(e) => {
              const v = e.target.value;
              void onPatch({ profissional_id: v || null });
            }}
            className="mt-0.5 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-[11px] text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="">—</option>
            {profissionais.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome ?? x.id}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
          Serviço
          <select
            value={servicoValue}
            disabled={!selected || !canMutate || pending}
            onChange={(e) => {
              const v = e.target.value;
              void onPatch({ especialidade_id: v || null });
            }}
            className="mt-0.5 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-[11px] text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="">—</option>
            {servicos.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome ?? x.id}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
          TV
          <select
            value={tvValue}
            disabled={!selected || !canMutate || pending}
            onChange={(e) => {
              const v = e.target.value;
              void onPatch({ tv_id: v || null });
            }}
            className="mt-0.5 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-[11px] text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="">—</option>
            {tvs.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome ?? x.id}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={!canMutate}
          onClick={onChamar}
          className="min-h-9 min-w-[6.5rem] flex-1 rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Chamar
        </button>
        <button
          type="button"
          disabled={!canMutate}
          onClick={onRechamar}
          className="min-h-9 min-w-[6.5rem] flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
        >
          Rechamar
        </button>
        <button
          type="button"
          disabled={!canMutate}
          onClick={onLimpar}
          className="min-h-9 min-w-[6.5rem] flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
        >
          Limpar dados
        </button>
        <button
          type="button"
          disabled={!canMutate}
          onClick={onFinalizar}
          className="min-h-9 min-w-[6.5rem] flex-1 rounded-lg border border-emerald-600 bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Finalizar
        </button>
      </div>
    </section>
  );
}
