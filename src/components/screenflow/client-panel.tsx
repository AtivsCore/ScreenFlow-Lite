"use client";

import { buildCadastroPayload, type CadastroValores } from "@/lib/cadastro-valores";
import { fetchServicos } from "@/lib/fetch-servicos";
import { formatProfissionalLabel, type ProfissionalRow } from "@/lib/profissionais-display";
import {
  AVIACAO_CLIENT_PANEL_HIDDEN_CATEGORY_IDS,
  AVIACAO_FIELD_DEVICE_TYPE,
  AVIACAO_HANGAR_CATEGORY_ID,
  AVIACAO_PREFIXO_CATEGORY_ID,
  buildAviacaoCategoryPatch,
  formatAviacaoObservacaoForDisplay,
  hydrateAviacaoFormValue,
  hydrateAviacaoFreeTextValue,
  hydrateAviacaoHangarSelectValue,
  isAviacaoFreeTextField,
  isAviacaoObservacaoInlineField,
  isAviacaoRigidSelectField,
  isMroLogisticsSegment,
  resolveMroFieldLabels,
  resolveMroProfile,
  parseAviacaoCadastroFields,
  resolveAviacaoCategoryDisplay,
  resolveAviacaoCategoryLabel,
  resolveAviacaoHeaderActionState,
  resolveAviacaoSelectOptions,
  sortAviacaoPanelCategories,
} from "@/lib/aviacao-logistics";
import {
  buildDocasCategoryPatch,
  isDocasSegment,
  isDocasTextField,
  mergeDocasObservacao,
  parseDocasCadastroFields,
} from "@/lib/docas-logistics";
import {
  buildSalaoCategoryPatch,
  isSalaoEsteticaSegment,
  isSalaoWaitingStatus,
  parseSalaoCadastroFields,
  parseSalaoServicosSolicitados,
  resolveSalaoChamarLabel,
  resolveSalaoHeaderActionState,
  resolveSalaoHeaderServicoLabel,
  resolveSalaoHoraMarcadaBadgeMeta,
  resolveSalaoLocalLabel,
  SALAO_FIELD_SERVICOS,
  SALAO_LOCAL_CATEGORY_ID,
  SALAO_PROFISSIONAL_CATEGORY_ID,
  SALAO_REGISTER_FORM_LABELS,
} from "@/lib/salao-estetica-logistics";
import { formatObservacaoForDisplay } from "@/lib/fila-preset";
import type { CadastroCategoryEntry, ObservacoesVisibility } from "@/lib/tenant-config";
import type { SupabaseClient } from "@supabase/supabase-js";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ObservacaoPopover } from "@/components/screenflow/observacao-popover";
import type { AtendimentoLite } from "@/lib/atendimentos-lite";
import { formatHoraMarcada } from "@/lib/atendimentos-lite";
import { classificacaoBadgeStyle } from "@/lib/classificacao-prioridade";
import { Copy, Printer } from "lucide-react";

type Opt = { id: string; nome: string | null };
type ProfOpt = ProfissionalRow;

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
  /** Opções fixas do seletor superior (ex.: tipo de dispositivo em hardware_ti). */
  baseSelectorValue?: string;
  onBaseSelectorChange?: (value: string) => void;
  onRegistrarAvaria?: () => void;
  onPrintSelected?: () => void;
  onCopySelected?: () => void;
  /** Salão: marca o cliente selecionado como próximo na fila. */
  onDefinirProximo?: () => void;
  /** Estágio atual da aeronave selecionada (coluna Kanban/lista). */
  aviacaoCurrentTabId?: string | null;
  /** Coluna Kanban/lista do card selecionado (salão). */
  salaoCurrentTabId?: string | null;
  /** Salão: edição rápida do nome do cliente. */
  onPatchClienteNome?: (nome: string) => Promise<void>;
  /** Incrementar após CRUD rápido (+ Bancada / + Equipe / + Serviços) para recarregar selects. */
  cadastrosRevision?: number;
};

function SelectField({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: Opt[];
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label className={AVIACAO_PANEL_FIELD_CLASS}>
      <span className="block h-4 truncate leading-4">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={AVIACAO_PANEL_CONTROL_CLASS}
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
  baseSelectorValue = "",
  onBaseSelectorChange,
  onRegistrarAvaria,
  onPrintSelected,
  onCopySelected,
  onDefinirProximo,
  aviacaoCurrentTabId,
  salaoCurrentTabId,
  onPatchClienteNome,
  cadastrosRevision = 0,
}: ClientPanelProps) {
  const [profissionais, setProfissionais] = useState<ProfOpt[]>([]);
  const [locais, setLocais] = useState<Opt[]>([]);
  const [servicos, setServicos] = useState<Opt[]>([]);
  const [tvs, setTvs] = useState<Opt[]>([]);
  const [categoryValues, setCategoryValues] = useState<Record<string, string>>({});
  const [clienteNomeDraft, setClienteNomeDraft] = useState("");
  const optionsLoadedRef = useRef<string | null>(null);
  const aviacaoFreeTextPatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const salaoClienteNomePatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const aviacaoMode = isMroLogisticsSegment(segmentoAplicado);
  const salaoMode = isSalaoEsteticaSegment(segmentoAplicado);
  const mroFieldLabels = resolveMroFieldLabels(segmentoAplicado);
  const mroProfile = resolveMroProfile(segmentoAplicado);
  const resolvedDeviceType = useMemo(() => {
    if (!mroProfile.baseSelectorOptions?.length) return "";
    const fromProp = baseSelectorValue.trim();
    if (fromProp) return fromProp;
    if (!selected?.observacao) return "";
    return parseAviacaoCadastroFields(selected.observacao)[AVIACAO_FIELD_DEVICE_TYPE]?.trim() ?? "";
  }, [mroProfile.baseSelectorOptions, baseSelectorValue, selected?.observacao]);
  const panelCategories = useMemo(() => {
    if (!aviacaoMode) {
      if (!salaoMode) return enabledCategories;
      return enabledCategories.filter((c) => c.id !== "sal-c3");
    }
    const hidden = new Set<string>(AVIACAO_CLIENT_PANEL_HIDDEN_CATEGORY_IDS);
    const visible = enabledCategories.filter((c) => !hidden.has(c.id));
    return sortAviacaoPanelCategories(visible);
  }, [enabledCategories, aviacaoMode, salaoMode]);

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
    if (salaoMode) {
      const servicosIds = parseSalaoServicosSolicitados(
        parseSalaoCadastroFields(selected.observacao)[SALAO_FIELD_SERVICOS]
      );
      const payload = buildSalaoCategoryPatch(
        next,
        cadastroCategories,
        selected.observacao,
        servicosIds
      );
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
    const label = aviacaoMode ? resolveAviacaoCategoryLabel(cat, segmentoAplicado) : cat.label;

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
      return (
        <label key={cat.id} className={AVIACAO_PANEL_FIELD_CLASS}>
          <span className="block h-4 truncate leading-4">{label}</span>
          <input
            type="text"
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
      return (
        <SelectField
          key={cat.id}
          label={label}
          value={categoryValues[cat.id] ?? ""}
          options={optionsFor(cat)}
          disabled={fieldDisabled}
          onChange={(v) => patchCategoryValue(cat.id, v)}
        />
      );
    }

    return (
      <SelectField
        key={cat.id}
        label={label}
        value={categoryValues[cat.id] ?? ""}
        options={optionsFor(cat)}
        disabled={selectDisabled}
        onChange={(v) => patchCategoryValue(cat.id, v)}
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

  useEffect(() => {
    optionsLoadedRef.current = null;
    void loadOptions();
  }, [loadOptions, cadastrosRevision]);

  useEffect(() => {
    return () => {
      if (aviacaoFreeTextPatchTimerRef.current) clearTimeout(aviacaoFreeTextPatchTimerRef.current);
      if (salaoClienteNomePatchTimerRef.current) clearTimeout(salaoClienteNomePatchTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setClienteNomeDraft(selected?.nome?.trim() ?? "");
  }, [selected?.id, selected?.nome]);

  function patchSalaoClienteNome(value: string) {
    setClienteNomeDraft(value);
    if (!onPatchClienteNome) return;
    if (salaoClienteNomePatchTimerRef.current) clearTimeout(salaoClienteNomePatchTimerRef.current);
    salaoClienteNomePatchTimerRef.current = setTimeout(() => {
      void onPatchClienteNome(value);
    }, 400);
  }

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
        const v = hydrateAviacaoFreeTextValue(cat.id, vals, selected.observacao, []);
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
        const v =
          cat.id === AVIACAO_HANGAR_CATEGORY_ID
            ? hydrateAviacaoHangarSelectValue(selected, opts)
            : hydrateAviacaoFormValue(cat.id, vals, selected.observacao, opts);
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
    selected?.local_id,
    enabledCategories,
    docasMode,
    aviacaoMode,
    profissionais,
    locais,
    servicos,
  ]);

  const tvValue = selected?.tv_id ?? "";
  const fieldDisabled = !selected || !canMutate;
  const selectDisabled = fieldDisabled || pending;
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
  const previsaoRetiradaLabel =
    selected?.hora_marcada ? formatHoraMarcada(selected.hora_marcada) : null;
  const horaMarcadaBadge = resolveSalaoHoraMarcadaBadgeMeta(salaoMode);

  const salaoHeaderServicoLabel = useMemo(() => {
    if (!salaoMode || !selected) return null;
    return resolveSalaoHeaderServicoLabel(selected, cadastroCategories, cadastroLookups);
  }, [salaoMode, selected, cadastroCategories, cadastroLookups]);

  const salaoHeaderObservacao = salaoMode ? observacaoText.trim() : "";

  const aviacaoHeaderActions = useMemo(
    () =>
      aviacaoMode && selected
        ? resolveAviacaoHeaderActionState(aviacaoCurrentTabId, segmentoAplicado)
        : null,
    [aviacaoMode, selected, aviacaoCurrentTabId, segmentoAplicado]
  );

  const salaoLocalLabel = useMemo(() => {
    if (!salaoMode || !selected) return null;
    return resolveSalaoLocalLabel(selected, cadastroCategories, cadastroLookups);
  }, [salaoMode, selected, cadastroCategories, cadastroLookups]);

  const salaoChamarLabel = useMemo(
    () => (salaoMode ? resolveSalaoChamarLabel(salaoLocalLabel) : "Chamar"),
    [salaoMode, salaoLocalLabel]
  );

  const salaoHeaderAction = useMemo(
    () =>
      salaoMode
        ? resolveSalaoHeaderActionState(salaoCurrentTabId, { profissionalMirror: true })
        : null,
    [salaoMode, salaoCurrentTabId]
  );

  const primaryBtnClass =
    "min-h-9 min-w-[6.5rem] flex-1 rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";
  const secondaryBtnClass =
    "min-h-9 min-w-[6.5rem] flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700";
  const finalizarBtnClass =
    "min-h-9 min-w-[6.5rem] flex-1 rounded-lg border border-emerald-600 bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50";

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
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
                  <p className="shrink-0 truncate text-base font-semibold leading-tight text-zinc-900 dark:text-zinc-50">
                    {selectedDisplayName ?? "—"}
                  </p>
                  {previsaoRetiradaLabel ? (
                    <span
                      className="shrink-0 rounded-md border border-teal-200 bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-800 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-200"
                      title={`${horaMarcadaBadge.titlePrefix}: ${previsaoRetiradaLabel}`}
                    >
                      {horaMarcadaBadge.prefix} {previsaoRetiradaLabel}
                    </span>
                  ) : null}
                  {salaoMode && salaoHeaderServicoLabel ? (
                    <span
                      className="min-w-0 max-w-full truncate text-[11px] leading-snug text-zinc-600 dark:text-zinc-300"
                      title={`Serviço: ${salaoHeaderServicoLabel}`}
                    >
                      <span className="text-zinc-400" aria-hidden>
                        •{" "}
                      </span>
                      <span className="font-medium text-zinc-500 dark:text-zinc-400">Serviço:</span>{" "}
                      {salaoHeaderServicoLabel}
                    </span>
                  ) : null}
                  {salaoMode && salaoHeaderObservacao ? (
                    <span
                      className="min-w-0 max-w-full truncate text-[11px] leading-snug text-zinc-500 dark:text-zinc-400"
                      title={salaoHeaderObservacao}
                    >
                      <span className="text-zinc-400" aria-hidden>
                        •{" "}
                      </span>
                      <span className="font-medium text-zinc-500 dark:text-zinc-400">Obs:</span>{" "}
                      {salaoHeaderObservacao}
                    </span>
                  ) : null}
                </div>
                {onPrintSelected && !salaoMode ? (
                  <button
                    type="button"
                    title="Imprimir comprovante de entrada"
                    aria-label="Imprimir comprovante de entrada"
                    disabled={!canMutate}
                    onClick={onPrintSelected}
                    className="inline-flex shrink-0 rounded-md border border-zinc-300 p-1 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  >
                    <Printer className="size-3.5" strokeWidth={1.75} aria-hidden />
                  </button>
                ) : null}
                {observacoesAlwaysVisible && hasObs && !salaoMode ? (
                  <span
                    className="min-w-0 max-w-[45%] truncate text-xs text-zinc-600 dark:text-zinc-300"
                    title={observacaoText}
                  >
                    {observacaoText}
                  </span>
                ) : null}
                {!observacoesAlwaysVisible && selected && hasObs && !salaoMode ? (
                  <ObservacaoPopover observacao={selected.observacao} className="shrink-0" />
                ) : null}
                {salaoMode && onCopySelected && onPrintSelected ? (
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      title="Copiar resumo"
                      aria-label="Copiar resumo"
                      disabled={!canMutate || !selected}
                      onClick={onCopySelected}
                      className="inline-flex shrink-0 rounded-md border border-zinc-300 p-1 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    >
                      <Copy className="size-3.5" strokeWidth={1.75} aria-hidden />
                    </button>
                    <button
                      type="button"
                      title="Imprimir comprovante"
                      aria-label="Imprimir comprovante"
                      disabled={!canMutate || !selected}
                      onClick={onPrintSelected}
                      className="inline-flex shrink-0 rounded-md border border-zinc-300 p-1 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    >
                      <Printer className="size-3.5" strokeWidth={1.75} aria-hidden />
                    </button>
                  </div>
                ) : priorityLawEnabled && prioStyle ? (
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
            mroProfile.baseSelectorOptions?.length ? (
              <label className={AVIACAO_PANEL_FIELD_CLASS}>
                <span className="block h-4 truncate leading-4">{mroProfile.baseSelectorLabel}</span>
                <select
                  value={resolvedDeviceType}
                  disabled={!canMutate}
                  onChange={(e) => onBaseSelectorChange?.(e.target.value)}
                  className={AVIACAO_PANEL_CONTROL_CLASS}
                >
                  <option value="">—</option>
                  {mroProfile.baseSelectorOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className={AVIACAO_PANEL_FIELD_CLASS}>
                <span className="block h-4 truncate leading-4">{mroProfile.baseSelectorLabel}</span>
                <select
                  value={tenantId ?? ""}
                  disabled={!canMutate || tenantOptions.length === 0}
                  required
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
            )
          ) : null}
          {salaoMode ? (
            <label className="block text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
              <span>{SALAO_REGISTER_FORM_LABELS.showClienteNome}</span>
              <input
                type="text"
                value={clienteNomeDraft}
                disabled={fieldDisabled || !onPatchClienteNome}
                onChange={(e) => patchSalaoClienteNome(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-[11px] text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
                autoComplete="off"
                placeholder="Nome do cliente"
              />
            </label>
          ) : null}
          {panelCategories.map((cat) =>
            salaoMode
              ? renderCategoryField({
                  ...cat,
                  label:
                    cat.id === SALAO_PROFISSIONAL_CATEGORY_ID
                      ? SALAO_REGISTER_FORM_LABELS.showProfissional
                      : cat.id === SALAO_LOCAL_CATEGORY_ID
                        ? SALAO_REGISTER_FORM_LABELS.showLocal
                        : cat.label,
                } as CadastroCategoryEntry)
              : renderCategoryField(cat)
          )}

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
          {salaoMode ? (
            <>
              {onDefinirProximo && selected && isSalaoWaitingStatus(selected.status) ? (
                <button
                  type="button"
                  disabled={!canMutate}
                  onClick={onDefinirProximo}
                  className={secondaryBtnClass}
                >
                  Definir como Próximo
                </button>
              ) : null}
              <button
                type="button"
                disabled={!canMutate}
                onClick={onChamar}
                className={primaryBtnClass}
              >
                {salaoChamarLabel}
              </button>
              <button
                type="button"
                disabled={!selected}
                onClick={onLimpar}
                className={secondaryBtnClass}
              >
                Limpar Seleção
              </button>
              {salaoHeaderAction?.showPrimary ? (
                <button
                  type="button"
                  disabled={!canMutate}
                  onClick={onFinalizar}
                  className={finalizarBtnClass}
                >
                  {salaoHeaderAction.primaryLabel}
                </button>
              ) : null}
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={!canMutate}
                onClick={onChamar}
                className={
                  aviacaoHeaderActions?.primaryAction === "chamar" ? primaryBtnClass : secondaryBtnClass
                }
              >
                {docasMode
                  ? "Chamar p/ Doca"
                  : aviacaoHeaderActions?.chamarLabel ??
                    (aviacaoMode ? mroProfile.headerChamarLabel : "Chamar")}
              </button>
              <button
                type="button"
                disabled={!canMutate}
                onClick={onRechamar}
                className={
                  aviacaoHeaderActions?.primaryAction === "iniciar" ? primaryBtnClass : secondaryBtnClass
                }
              >
                {docasMode
                  ? "Iniciar Operação"
                  : aviacaoMode
                    ? (aviacaoHeaderActions?.iniciarLabel ?? "Iniciar Operação")
                    : "Rechamar"}
              </button>
              {aviacaoMode ? (
                <button
                  type="button"
                  disabled={!canMutate || !selected}
                  onClick={onRegistrarAvaria}
                  className="min-h-9 min-w-[6.5rem] flex-1 rounded-lg border border-amber-500 bg-amber-50 px-3 text-xs font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60"
                >
                  {mroFieldLabels.avariaButton}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!canMutate}
                  onClick={onLimpar}
                  className={secondaryBtnClass}
                >
                  Limpar dados
                </button>
              )}
              <button
                type="button"
                disabled={!canMutate}
                onClick={onFinalizar}
                className={
                  aviacaoHeaderActions?.primaryAction === "finalizar"
                    ? primaryBtnClass
                    : docasMode || aviacaoMode
                      ? finalizarBtnClass
                      : primaryBtnClass
                }
              >
                {docasMode
                  ? "Liberar"
                  : aviacaoHeaderActions?.finalizarLabel ??
                    (aviacaoMode ? mroProfile.headerFinalizarLabel : "Finalizar")}
              </button>
            </>
          )}
        </div>
      </section>

    </>
  );
});
