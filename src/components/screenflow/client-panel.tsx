"use client";

import type { AtendimentoLite } from "@/lib/atendimentos-lite";
import { classificacaoBadgeStyle } from "@/lib/classificacao-prioridade";
import { SERVICES_CRUD_TABLE } from "@/lib/db-tables";
import { fetchServicos } from "@/lib/fetch-servicos";
import { formatProfissionalLabel, type ProfissionalRow } from "@/lib/profissionais-display";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { CrudEntityModal } from "@/components/screenflow/crud-entity-modal";

type Opt = { id: string; nome: string | null };
type ProfOpt = ProfissionalRow;

type QuickCrud = { title: string; table: string };

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
  tenantId?: string | null;
};

function SelectWithQuickAdd({
  label,
  value,
  options,
  disabled,
  quickAddDisabled,
  onChange,
  onQuickAdd,
}: {
  label: string;
  value: string;
  options: Opt[];
  disabled: boolean;
  quickAddDisabled?: boolean;
  onChange: (v: string) => void;
  onQuickAdd: () => void;
}) {
  return (
    <label className="block text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
      <span className="flex items-center justify-between gap-1">
        {label}
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
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-[11px] text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
      >
        <option value="">—</option>
        {options.map((x) => (
          <option key={x.id} value={x.id}>
            {x.nome ?? x.id}
          </option>
        ))}
      </select>
    </label>
  );
}

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
  tenantId,
}: ClientPanelProps) {
  const [profissionais, setProfissionais] = useState<ProfOpt[]>([]);
  const [locais, setLocais] = useState<Opt[]>([]);
  const [servicos, setServicos] = useState<Opt[]>([]);
  const [tvs, setTvs] = useState<Opt[]>([]);
  const [quickCrud, setQuickCrud] = useState<QuickCrud | null>(null);

  const loadOptions = useCallback(async () => {
    if (!supabase) return;
    const tid = tenantId?.trim();
    const [p, l, sResult, t] = await Promise.all([
      tid
        ? supabase.from("profissionais").select("id,nome,especialidade").eq("tenant_id", tid).order("nome")
        : supabase.from("profissionais").select("id,nome,especialidade").order("nome"),
      tid
        ? supabase.from("locais").select("id,nome").eq("tenant_id", tid).order("nome")
        : supabase.from("locais").select("id,nome").order("nome"),
      fetchServicos(supabase, tid),
      supabase.from("tvs").select("id,nome").order("nome"),
    ]);
    setProfissionais(((p.error ? null : p.data) as ProfOpt[] | null) ?? []);
    setLocais(((l.error ? null : l.data) as Opt[] | null) ?? []);
    setServicos(sResult.data);
    setTvs(((t.error ? null : t.data) as Opt[] | null) ?? []);
  }, [supabase, tenantId]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  const profissionalValue = selected?.profissional_id ?? "";
  const localValue = selected?.local_id ?? "";
  const servicoValue = selected?.especialidade_id ?? "";
  const tvValue = selected?.tv_id ?? "";
  const selectDisabled = !selected || !canMutate || pending;
  const quickAddDisabled = !supabase;
  const prioStyle = selected
    ? classificacaoBadgeStyle(selected.classificacao_prioridade, selected.prioridade)
    : null;

  return (
    <>
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
                {priorityLawEnabled && prioStyle ? (
                  <p className={`mt-1.5 inline-flex px-2 py-0.5 text-[10px] ${prioStyle.badge}`}>
                    {prioStyle.label}
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
          <SelectWithQuickAdd
            label="Local / ponto de atendimento"
            value={localValue}
            options={locais}
            disabled={selectDisabled}
            quickAddDisabled={quickAddDisabled}
            onChange={(v) => void onPatch({ local_id: v || null })}
            onQuickAdd={() => setQuickCrud({ title: "Locais / pontos de atendimento", table: "locais" })}
          />

          <SelectWithQuickAdd
            label="Profissional"
            value={profissionalValue}
            options={profissionais.map((p) => ({
              id: p.id,
              nome: formatProfissionalLabel(p),
            }))}
            disabled={selectDisabled}
            quickAddDisabled={quickAddDisabled}
            onChange={(v) => void onPatch({ profissional_id: v || null })}
            onQuickAdd={() => setQuickCrud({ title: "Equipe (profissionais)", table: "profissionais" })}
          />

          <SelectWithQuickAdd
            label="Serviço"
            value={servicoValue}
            options={servicos}
            disabled={selectDisabled}
            quickAddDisabled={quickAddDisabled}
            onChange={(v) => void onPatch({ especialidade_id: v || null })}
            onQuickAdd={() => setQuickCrud({ title: "Serviços", table: SERVICES_CRUD_TABLE })}
          />

          <label className="block text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
            TV
            <select
              value={tvValue}
              disabled={selectDisabled}
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

      {quickCrud && (
        <CrudEntityModal
          open
          supabase={supabase}
          title={quickCrud.title}
          table={quickCrud.table}
          tenantId={tenantId}
          onClose={() => setQuickCrud(null)}
          onSaved={() => void loadOptions()}
        />
      )}
    </>
  );
}
