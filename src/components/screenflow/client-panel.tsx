"use client";

import { buildCadastroPayload, type CadastroValores } from "@/lib/cadastro-valores";
import { fetchServicos } from "@/lib/fetch-servicos";
import { formatProfissionalLabel, type ProfissionalRow } from "@/lib/profissionais-display";
import {
  AVIACAO_CATEGORY_DISPLAY_LABELS,
  AVIACAO_CLIENT_PANEL_HIDDEN_CATEGORY_IDS,
  buildAviacaoCategoryPatch,
  formatAviacaoObservacaoForDisplay,
  isAviacaoSegment,
  isAviacaoTextField,
  mergeAviacaoObservacao,
  parseAviacaoCadastroFields,
} from "@/lib/aviacao-logistics";
import {
  buildDocasCategoryPatch,
  isDocasSegment,
  isDocasTextField,
  mergeDocasObservacao,
  parseDocasCadastroFields,
} from "@/lib/docas-logistics";
import { formatObservacaoForDisplay } from "@/lib/fila-preset";
import type { CadastroCategoryEntry, ObservacoesVisibility } from "@/lib/tenant-config";
import { cadastroCategoryCrudTable } from "@/lib/tenant-config";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Plus } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CrudEntityModal } from "@/components/screenflow/crud-entity-modal";
import { ObservacaoPopover } from "@/components/screenflow/observacao-popover";
import type { AtendimentoLite } from "@/lib/atendimentos-lite";
import { classificacaoBadgeStyle } from "@/lib/classificacao-prioridade";

type Opt = { id: string; nome: string | null };
type ProfOpt = ProfissionalRow;
type QuickCrud = { title: string; table: string };

const AVIACAO_PANEL_FIELD_CLASS =
  "col-span-1 min-w-0 block text-[10px] font-medium text-zinc-600 dark:text-zinc-400";
const AVIACAO_PANEL_CONTROL_CLASS =
  "mt-0.5 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-[11px] text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50";

type ClientPanelProps = {
  selected: AtendimentoLite | null;
  loading: boolean;
  supabase: SupabaseClient | null;
  canMutate: boolean;
  pending: boolean;
  priorityLawEnabled: boolean;
  observacoesVisibility: ObservacoesVisibility;
  cadastroCategories: CadastroCategoryEntry[];
  segmentoAplicado?: string | null;
  onChamar: () => void;
  onRechamar: () => void;
  onFinalizar: () => void;
  onLimpar: () => void;
  onPatch: (patch: {
    cadastro_valores?: CadastroValores;
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

export const ClientPanel = memo(function ClientPanel({
  selected,
  loading,
  supabase,
  canMutate,
  pending,
  priorityLawEnabled,
  observacoesVisibility,
  cadastroCategories,
  segmentoAplicado,
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
  const [categoryValues, setCategoryValues] = useState<Record<string, string>>({});
  const [quickCrud, setQuickCrud] = useState<QuickCrud | null>(null);
  const optionsLoadedRef = useRef<string | null>(null);

  const enabledCategories = useMemo(
    () => cadastroCategories.filter((c) => c.enabled),
    [cadastroCategories]
  );
  const docasMode = isDocasSegment(segmentoAplicado);
  const aviacaoMode = isAviacaoSegment(segmentoAplicado);
  const panelCategories = useMemo(() => {
    if (!aviacaoMode) return enabledCategories;
    const hidden = new Set<string>(AVIACAO_CLIENT_PANEL_HIDDEN_CATEGORY_IDS);
    return enabledCategories.filter((c) => !hidden.has(c.id));
  }, [enabledCategories, aviacaoMode]);

  function openCrudForCategory(cat: CadastroCategoryEntry) {
    setQuickCrud({ title: cat.label, table: cadastroCategoryCrudTable(cat) });
  }

  function optionsFor(cat: CadastroCategoryEntry): Opt[] {
    switch (cat.tableKey) {
      case "profissionais":
        return profissionais.map((p) => ({ id: p.id, nome: formatProfissionalLabel(p) }));
      case "locais":
        return locais;
      case "servicos":
        return servicos;
      default:
        return [];
    }
  }

  function patchCategoryValue(categoryId: string, value: string) {
    if (!selected) return;
    const next = { ...categoryValues, [categoryId]: value };
    setCategoryValues(next);
    if (docasMode) {
      const payload = buildDocasCategoryPatch(next, cadastroCategories, selected.observacao);
      void onPatch(payload);
      return;
    }
    if (aviacaoMode) {
      const payload = buildAviacaoCategoryPatch(next, cadastroCategories, selected.observacao);
      void onPatch(payload);
      return;
    }
    const payload = buildCadastroPayload(next, cadastroCategories);
    void onPatch(payload);
  }

  function patchDocasTextField(categoryId: string, value: string) {
    if (!selected) return;
    const next = { ...categoryValues, [categoryId]: value };
    setCategoryValues(next);
    const docasFields = { ...parseDocasCadastroFields(selected.observacao), [categoryId]: value };
    const observacao = mergeDocasObservacao({
      current: selected.observacao,
      docasFields,
      preserveTabWhenUnset: true,
    });
    void onPatch({ observacao });
  }

  function patchAviacaoTextField(categoryId: string, value: string) {
    if (!selected) return;
    const next = { ...categoryValues, [categoryId]: value };
    setCategoryValues(next);
    const aviacaoFields = { ...parseAviacaoCadastroFields(selected.observacao), [categoryId]: value };
    const observacao = mergeAviacaoObservacao({
      current: selected.observacao,
      aviacaoFields,
      preserveTabWhenUnset: true,
    });
    void onPatch({ observacao });
  }

  function categoryLabel(cat: CadastroCategoryEntry): string {
    if (aviacaoMode) {
      return AVIACAO_CATEGORY_DISPLAY_LABELS[cat.id] ?? cat.label;
    }
    return cat.label;
  }

  function renderCategoryField(cat: CadastroCategoryEntry) {
    const label = categoryLabel(cat);

    if (docasMode && isDocasTextField(cat.id)) {
      return (
        <label key={cat.id} className="block text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
          {label}
          <input
            type="text"
            value={categoryValues[cat.id] ?? ""}
            disabled={selectDisabled}
            onChange={(e) => patchDocasTextField(cat.id, e.target.value)}
            className="mt-0.5 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-[11px] text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
      );
    }

    if (aviacaoMode && isAviacaoTextField(cat.id)) {
      return (
        <label key={cat.id} className={AVIACAO_PANEL_FIELD_CLASS}>
          <span className="block h-4 truncate leading-4">{label}</span>
          <input
            type="text"
            value={categoryValues[cat.id] ?? ""}
            disabled={selectDisabled}
            onChange={(e) => patchAviacaoTextField(cat.id, e.target.value)}
            className={AVIACAO_PANEL_CONTROL_CLASS}
          />
        </label>
      );
    }

    if (aviacaoMode) {
      return (
        <label key={cat.id} className={AVIACAO_PANEL_FIELD_CLASS}>
          <span className="flex h-4 items-center justify-between gap-1">
            <span className="min-w-0 truncate leading-4">{label}</span>
            <button
              type="button"
              title={`Cadastrar ${label.toLowerCase()}`}
              disabled={quickAddDisabled}
              onClick={() => openCrudForCategory(cat)}
              className="inline-flex size-5 shrink-0 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-600 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Plus className="size-3" strokeWidth={2} aria-hidden />
              <span className="sr-only">Cadastrar {label}</span>
            </button>
          </span>
          <select
            value={categoryValues[cat.id] ?? ""}
            disabled={selectDisabled}
            onChange={(e) => patchCategoryValue(cat.id, e.target.value)}
            className={AVIACAO_PANEL_CONTROL_CLASS}
          >
            <option value="">—</option>
            {optionsFor(cat).map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome ?? x.id}
              </option>
            ))}
          </select>
        </label>
      );
    }

    return (
      <SelectWithQuickAdd
        key={cat.id}
        label={label}
        value={categoryValues[cat.id] ?? ""}
        options={optionsFor(cat)}
        disabled={selectDisabled}
        quickAddDisabled={quickAddDisabled}
        onChange={(v) => patchCategoryValue(cat.id, v)}
        onQuickAdd={() => openCrudForCategory(cat)}
      />
    );
  }

  const loadOptions = useCallback(async () => {
    if (!supabase) return;
    const tid = tenantId?.trim();
    const cacheKey = `${tid ?? ""}`;
    if (optionsLoadedRef.current === cacheKey) return;

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
    optionsLoadedRef.current = cacheKey;
  }, [supabase, tenantId]);

  useEffect(() => {
    optionsLoadedRef.current = null;
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    if (!selected) {
      setCategoryValues({});
      return;
    }
    const vals = selected.cadastro_valores ?? {};
    const inlineFields = docasMode
      ? parseDocasCadastroFields(selected.observacao)
      : aviacaoMode
        ? parseAviacaoCadastroFields(selected.observacao)
        : {};
    const next: Record<string, string> = {};
    for (const cat of enabledCategories) {
      if (
        (docasMode && isDocasTextField(cat.id)) ||
        (aviacaoMode && isAviacaoTextField(cat.id))
      ) {
        const t = inlineFields[cat.id];
        if (t) next[cat.id] = t;
      } else {
        const v = vals[cat.id];
        if (v) next[cat.id] = v;
      }
    }
    setCategoryValues(next);
  }, [selected?.id, selected?.cadastro_valores, selected?.observacao, enabledCategories, docasMode, aviacaoMode]);

  const tvValue = selected?.tv_id ?? "";
  const selectDisabled = !selected || !canMutate || pending;
  const quickAddDisabled = !supabase;
  const prioStyle = selected
    ? classificacaoBadgeStyle(selected.classificacao_prioridade, selected.prioridade)
    : null;
  const observacaoText = selected
    ? aviacaoMode
      ? formatAviacaoObservacaoForDisplay(selected.observacao)
      : formatObservacaoForDisplay(selected.observacao)
    : "";
  const observacoesAlwaysVisible = observacoesVisibility === "always";
  const hasObs = !!observacaoText;
  const docasPlaca =
    docasMode && selected ? parseDocasCadastroFields(selected.observacao)["doc-c1"]?.trim() : null;
  const aviacaoPrefixo =
    aviacaoMode && selected ? parseAviacaoCadastroFields(selected.observacao)["av-c3"]?.trim() : null;
  const selectedDisplayName = docasPlaca || aviacaoPrefixo || selected?.nome?.trim() || null;

  return (
    <>
      <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
        <div className="min-h-[3.5rem]">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Cliente selecionado
          </p>
          <div className="mt-1 flex min-h-[1.75rem] min-w-0 items-center gap-2">
            {selected ? (
              <>
                <p className="shrink-0 truncate text-base font-semibold leading-tight text-zinc-900 dark:text-zinc-50">
                  {selectedDisplayName ?? "—"}
                </p>
                {observacoesAlwaysVisible && hasObs ? (
                  <span
                    className="min-w-0 max-w-[45%] truncate text-xs text-zinc-600 dark:text-zinc-300"
                    title={observacaoText}
                  >
                    {observacaoText}
                  </span>
                ) : null}
                {!observacoesAlwaysVisible && hasObs ? (
                  <ObservacaoPopover observacao={selected.observacao} className="shrink-0" />
                ) : null}
                {priorityLawEnabled && prioStyle ? (
                  <span className={`ml-auto shrink-0 whitespace-nowrap px-2 py-0.5 text-[10px] ${prioStyle.badge}`}>
                    {prioStyle.label}
                  </span>
                ) : null}
              </>
            ) : (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {loading ? "Carregando fila…" : "Clique em uma linha na fila para chamar."}
              </p>
            )}
          </div>
        </div>

        <div
          className={
            aviacaoMode
              ? "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5 lg:gap-3"
              : "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]"
          }
        >
          {panelCategories.map((cat) => renderCategoryField(cat))}

          <label
            className={
              aviacaoMode
                ? AVIACAO_PANEL_FIELD_CLASS
                : "block text-[10px] font-medium text-zinc-600 dark:text-zinc-400"
            }
          >
            <span className={aviacaoMode ? "block h-4 truncate leading-4" : undefined}>TV</span>
            <select
              value={tvValue}
              disabled={selectDisabled}
              onChange={(e) => {
                const v = e.target.value;
                void onPatch({ tv_id: v || null });
              }}
              className={aviacaoMode ? AVIACAO_PANEL_CONTROL_CLASS : "mt-0.5 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-[11px] text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"}
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
            {docasMode ? "Chamar p/ Doca" : aviacaoMode ? "Chamar p/ Hangar" : "Chamar"}
          </button>
          <button
            type="button"
            disabled={!canMutate}
            onClick={onRechamar}
            className="min-h-9 min-w-[6.5rem] flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
          >
            {docasMode || aviacaoMode ? "Iniciar Operação" : "Rechamar"}
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
            {docasMode || aviacaoMode ? "Liberar" : "Finalizar"}
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
          onSaved={() => {
            optionsLoadedRef.current = null;
            void loadOptions();
          }}
        />
      )}
    </>
  );
});
