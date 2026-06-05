"use client";

import { buildCadastroPayload, type CadastroValores } from "@/lib/cadastro-valores";
import { fetchServicos } from "@/lib/fetch-servicos";
import { formatProfissionalLabel, type ProfissionalRow } from "@/lib/profissionais-display";
import {
  AVIACAO_CLIENT_PANEL_HIDDEN_CATEGORY_IDS,
  AVIACAO_MODELO_CATEGORY_ID,
  AVIACAO_MODELO_DATALIST_ID,
  AVIACAO_PREFIXO_CATEGORY_ID,
  AVIACAO_PREFIXO_DATALIST_ID,
  buildAviacaoCategoryPatch,
  formatAviacaoObservacaoForDisplay,
  hydrateAviacaoFormValue,
  hydrateAviacaoFreeTextValue,
  isAviacaoFreeTextField,
  isAviacaoObservacaoInlineField,
  isAviacaoRigidSelectField,
  isAviacaoSegment,
  parseAviacaoCadastroFields,
  resolveAviacaoCategoryDisplay,
  resolveAviacaoCategoryLabel,
  resolveAviacaoCrudTable,
  resolveAviacaoSelectOptions,
  sortAviacaoPanelCategories,
  AVIACAO_BASE_LIMIT_UPSELL_DESCRIPTION,
  AVIACAO_BASE_LIMIT_UPSELL_TITLE,
  canCreateAviacaoBase,
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
import { ProUpgradeModal } from "@/components/screenflow/pro-upgrade-modal";
import { Modal } from "@/components/ui/modal";
import { ObservacaoPopover } from "@/components/screenflow/observacao-popover";
import type { AtendimentoLite } from "@/lib/atendimentos-lite";
import { classificacaoBadgeStyle } from "@/lib/classificacao-prioridade";

type Opt = { id: string; nome: string | null };
type ProfOpt = ProfissionalRow;
type QuickCrud = { title: string; table: string; categoryId?: string };

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
  /** Bases/aeroportos do usuário (somente aviação). */
  tenantOptions?: Opt[];
  onTenantChange?: (tenantId: string) => void;
  onTenantOptionsRefresh?: () => void | Promise<void>;
  onRegistrarAvaria?: () => void;
  /** Plano PRO desbloqueia múltiplas bases (somente aviação). */
  proActive?: boolean;
};

function AviacaoBaseQuickModal({
  open,
  onClose,
  supabase,
  sourceTenantId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  supabase: SupabaseClient | null;
  sourceTenantId?: string | null;
  onCreated: (tenant: { id: string; nome: string }) => void;
}) {
  const [nome, setNome] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNome("");
    setError(null);
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const trimmed = nome.trim();
    if (!trimmed) {
      setError("Informe o nome da base / aeroporto.");
      return;
    }
    setBusy(true);
    setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError("Sessão ausente.");
      setBusy(false);
      return;
    }
    const res = await fetch("/api/aviacao-base", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ nome: trimmed, sourceTenantId: sourceTenantId ?? null }),
    });
    const json = (await res.json()) as { ok?: boolean; message?: string; id?: string; nome?: string };
    if (!res.ok || !json.ok || !json.id) {
      setError(json.message ?? "Falha ao cadastrar base.");
      setBusy(false);
      return;
    }
    onCreated({ id: json.id, nome: json.nome ?? trimmed });
    onClose();
    setBusy(false);
  }

  return (
    <Modal open={open} title="Nova base / aeroporto" onClose={onClose} widthClassName="max-w-sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Nome da base
          <input
            type="text"
            value={nome}
            disabled={busy}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Curitiba, Salvador…"
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            autoFocus
          />
        </label>
        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy || !supabase}
          className="rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {busy ? "Salvando…" : "Cadastrar base"}
        </button>
      </form>
    </Modal>
  );
}

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
  tenantOptions = [],
  onTenantChange,
  onTenantOptionsRefresh,
  onRegistrarAvaria,
  proActive = false,
}: ClientPanelProps) {
  const [profissionais, setProfissionais] = useState<ProfOpt[]>([]);
  const [locais, setLocais] = useState<Opt[]>([]);
  const [servicos, setServicos] = useState<Opt[]>([]);
  const [tvs, setTvs] = useState<Opt[]>([]);
  const [categoryValues, setCategoryValues] = useState<Record<string, string>>({});
  const [quickCrud, setQuickCrud] = useState<QuickCrud | null>(null);
  const [baseQuickOpen, setBaseQuickOpen] = useState(false);
  const [baseUpsellOpen, setBaseUpsellOpen] = useState(false);

  function handleAviacaoBaseQuickAdd() {
    if (!canCreateAviacaoBase(tenantOptions.length, proActive)) {
      setBaseUpsellOpen(true);
      return;
    }
    setBaseQuickOpen(true);
  }
  const optionsLoadedRef = useRef<string | null>(null);
  const aviacaoFreeTextPatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enabledCategories = useMemo(
    () => cadastroCategories.filter((c) => c.enabled),
    [cadastroCategories]
  );
  const cadastroLookups = useMemo(
    () => ({
      profissionais: new Map(
        profissionais.map((p) => [p.id, formatProfissionalLabel(p)] as const)
      ),
      locais: new Map(locais.map((l) => [l.id, l.nome ?? l.id] as const)),
      servicos: new Map(servicos.map((s) => [s.id, s.nome ?? s.id] as const)),
    }),
    [profissionais, locais, servicos]
  );
  const docasMode = isDocasSegment(segmentoAplicado);
  const aviacaoMode = isAviacaoSegment(segmentoAplicado);
  const panelCategories = useMemo(() => {
    if (!aviacaoMode) return enabledCategories;
    const hidden = new Set<string>(AVIACAO_CLIENT_PANEL_HIDDEN_CATEGORY_IDS);
    const visible = enabledCategories.filter((c) => !hidden.has(c.id));
    return sortAviacaoPanelCategories(visible);
  }, [enabledCategories, aviacaoMode]);

  const prefixoDatalistOptions = useMemo(() => {
    if (!aviacaoMode) return [];
    return resolveAviacaoSelectOptions(AVIACAO_PREFIXO_CATEGORY_ID, {
      profissionais,
      locais,
      servicos,
    });
  }, [aviacaoMode, profissionais, locais, servicos]);

  const modeloDatalistOptions = useMemo(() => {
    if (!aviacaoMode) return [];
    return resolveAviacaoSelectOptions(AVIACAO_MODELO_CATEGORY_ID, {
      profissionais,
      locais,
      servicos,
    });
  }, [aviacaoMode, profissionais, locais, servicos]);

  function openCrudForCategory(cat: CadastroCategoryEntry) {
    const title = aviacaoMode ? resolveAviacaoCategoryLabel(cat) : cat.label;
    setQuickCrud({
      title,
      table: aviacaoMode ? resolveAviacaoCrudTable(cat.id) : cadastroCategoryCrudTable(cat),
      categoryId: aviacaoMode ? cat.id : undefined,
    });
  }

  function optionsFor(cat: CadastroCategoryEntry): Opt[] {
    if (aviacaoMode && isAviacaoRigidSelectField(cat.id)) {
      return resolveAviacaoSelectOptions(cat.id, { profissionais, locais, servicos });
    }
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

  const flushAviacaoCategoryPatch = useCallback(
    (next: Record<string, string>) => {
      if (!selected) return;
      const payload = buildAviacaoCategoryPatch(next, cadastroCategories, selected.observacao);
      void onPatch(payload);
    },
    [selected, cadastroCategories, onPatch]
  );

  function patchAviacaoFreeTextField(categoryId: string, value: string) {
    if (!selected) return;
    const next = { ...categoryValues, [categoryId]: value };
    setCategoryValues(next);
    if (aviacaoFreeTextPatchTimerRef.current) clearTimeout(aviacaoFreeTextPatchTimerRef.current);
    aviacaoFreeTextPatchTimerRef.current = setTimeout(() => {
      flushAviacaoCategoryPatch(next);
    }, 400);
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

  function renderCategoryField(cat: CadastroCategoryEntry) {
    const label = aviacaoMode ? resolveAviacaoCategoryLabel(cat) : cat.label;

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

    if (aviacaoMode && isAviacaoFreeTextField(cat.id)) {
      const datalistId =
        cat.id === AVIACAO_MODELO_CATEGORY_ID
          ? AVIACAO_MODELO_DATALIST_ID
          : AVIACAO_PREFIXO_DATALIST_ID;
      return (
        <label key={cat.id} className={AVIACAO_PANEL_FIELD_CLASS}>
          <span className="block h-4 truncate leading-4">{label}</span>
          <input
            type="text"
            list={datalistId}
            value={categoryValues[cat.id] ?? ""}
            disabled={fieldDisabled}
            onChange={(e) => patchAviacaoFreeTextField(cat.id, e.target.value)}
            className={AVIACAO_PANEL_CONTROL_CLASS}
            autoComplete="off"
          />
        </label>
      );
    }

    if (aviacaoMode && isAviacaoRigidSelectField(cat.id)) {
      const opts = optionsFor(cat);
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
            disabled={fieldDisabled}
            onChange={(e) => patchCategoryValue(cat.id, e.target.value)}
            className={AVIACAO_PANEL_CONTROL_CLASS}
          >
            <option value="">—</option>
            {opts.map((x) => (
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

  const fetchLookupData = useCallback(async () => {
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

  const loadOptions = useCallback(async () => {
    const cacheKey = `${tenantId?.trim() ?? ""}`;
    if (optionsLoadedRef.current === cacheKey) return;
    await fetchLookupData();
    optionsLoadedRef.current = cacheKey;
  }, [fetchLookupData, tenantId]);

  const refreshOptions = useCallback(async () => {
    await fetchLookupData();
  }, [fetchLookupData]);

  useEffect(() => {
    optionsLoadedRef.current = null;
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    return () => {
      if (aviacaoFreeTextPatchTimerRef.current) clearTimeout(aviacaoFreeTextPatchTimerRef.current);
    };
  }, []);

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
      if (docasMode && isDocasTextField(cat.id)) {
        const t = inlineFields[cat.id];
        if (t) next[cat.id] = t;
      } else if (aviacaoMode && isAviacaoFreeTextField(cat.id)) {
        const opts =
          cat.id === AVIACAO_MODELO_CATEGORY_ID ? modeloDatalistOptions : prefixoDatalistOptions;
        const v = hydrateAviacaoFreeTextValue(cat.id, vals, selected.observacao, opts);
        if (v) next[cat.id] = v;
      } else if (
        aviacaoMode &&
        isAviacaoObservacaoInlineField(cat.id, servicos) &&
        !isAviacaoFreeTextField(cat.id)
      ) {
        const t = inlineFields[cat.id];
        if (t) next[cat.id] = t;
      } else if (aviacaoMode && isAviacaoRigidSelectField(cat.id)) {
        const opts = resolveAviacaoSelectOptions(cat.id, { profissionais, locais, servicos });
        const v = hydrateAviacaoFormValue(cat.id, vals, selected.observacao, opts);
        if (v) next[cat.id] = v;
      } else {
        const v = vals[cat.id];
        if (v) next[cat.id] = v;
      }
    }
    setCategoryValues(next);
  }, [
    selected?.id,
    selected?.cadastro_valores,
    selected?.observacao,
    enabledCategories,
    docasMode,
    aviacaoMode,
    profissionais,
    locais,
    servicos,
    prefixoDatalistOptions,
    modeloDatalistOptions,
  ]);

  const tvValue = selected?.tv_id ?? "";
  const fieldDisabled = !selected || !canMutate;
  const selectDisabled = fieldDisabled || pending;
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
    aviacaoMode && selected
      ? resolveAviacaoCategoryDisplay(
          "av-c3",
          selected.observacao,
          selected.cadastro_valores ?? {},
          cadastroLookups,
          cadastroCategories,
          { local_id: selected.local_id, localNome: selected.localNome }
        )?.trim() ?? null
      : null;
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
                {!observacoesAlwaysVisible && selected && hasObs ? (
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
              ? "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:gap-3"
              : "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]"
          }
        >
          {aviacaoMode ? (
            <label className={AVIACAO_PANEL_FIELD_CLASS}>
              <span className="flex h-4 items-center justify-between gap-1">
                <span className="min-w-0 truncate leading-4">Base / Aeroporto</span>
                <button
                  type="button"
                  title="Cadastrar nova base / aeroporto"
                  disabled={!supabase}
                  onClick={handleAviacaoBaseQuickAdd}
                  className="inline-flex size-5 shrink-0 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-600 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <Plus className="size-3" strokeWidth={2} aria-hidden />
                  <span className="sr-only">Cadastrar base</span>
                </button>
              </span>
              <select
                value={tenantId ?? ""}
                disabled={!canMutate || tenantOptions.length === 0}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) onTenantChange?.(v);
                }}
                className={AVIACAO_PANEL_CONTROL_CLASS}
              >
                {tenantOptions.length === 0 ? (
                  <option value={tenantId ?? ""}>{tenantId ?? "—"}</option>
                ) : (
                  tenantOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome ?? t.id}
                    </option>
                  ))
                )}
              </select>
            </label>
          ) : null}
          {panelCategories.map((cat) => renderCategoryField(cat))}

          {!aviacaoMode ? (
            <label className="block text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
              <span>TV</span>
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
          ) : null}
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
          {aviacaoMode ? (
            <button
              type="button"
              disabled={!canMutate || !selected}
              onClick={onRegistrarAvaria}
              className="min-h-9 min-w-[6.5rem] flex-1 rounded-lg border border-amber-500 bg-amber-50 px-3 text-xs font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60"
            >
              Registrar Avaria
            </button>
          ) : (
            <button
              type="button"
              disabled={!canMutate}
              onClick={onLimpar}
              className="min-h-9 min-w-[6.5rem] flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
            >
              Limpar dados
            </button>
          )}
          <button
            type="button"
            disabled={!canMutate}
            onClick={onFinalizar}
            className="min-h-9 min-w-[6.5rem] flex-1 rounded-lg border border-emerald-600 bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {docasMode ? "Liberar" : aviacaoMode ? "Liberar / Decolar" : "Finalizar"}
          </button>
        </div>
      </section>

      {aviacaoMode ? (
        <>
          <datalist id={AVIACAO_PREFIXO_DATALIST_ID}>
            {prefixoDatalistOptions.map((opt) => (
              <option key={opt.id} value={opt.nome ?? opt.id} />
            ))}
          </datalist>
          <datalist id={AVIACAO_MODELO_DATALIST_ID}>
            {modeloDatalistOptions.map((opt) => (
              <option key={opt.id} value={opt.nome ?? opt.id} />
            ))}
          </datalist>
        </>
      ) : null}

      {aviacaoMode ? (
        <>
          <AviacaoBaseQuickModal
            open={baseQuickOpen}
            onClose={() => setBaseQuickOpen(false)}
            supabase={supabase}
            sourceTenantId={tenantId}
            onCreated={(tenant) => {
              void onTenantOptionsRefresh?.();
              onTenantChange?.(tenant.id);
            }}
          />
          <ProUpgradeModal
            open={baseUpsellOpen}
            onClose={() => setBaseUpsellOpen(false)}
            title={AVIACAO_BASE_LIMIT_UPSELL_TITLE}
            description={AVIACAO_BASE_LIMIT_UPSELL_DESCRIPTION}
          />
        </>
      ) : null}

      {quickCrud && (
        <CrudEntityModal
          open
          supabase={supabase}
          title={quickCrud.title}
          table={quickCrud.table}
          tenantId={tenantId}
          cadastroCategoryId={quickCrud.categoryId}
          onClose={() => setQuickCrud(null)}
          onSaved={() => {
            void refreshOptions();
          }}
        />
      )}
    </>
  );
});
