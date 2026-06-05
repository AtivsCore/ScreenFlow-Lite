"use client";

import {
  prioridadeBooleanFromClassificacao,
  type ClassificacaoPrioridade,
} from "@/lib/classificacao-prioridade";
import { formatProfissionalLabel, type ProfissionalRow } from "@/lib/profissionais-display";
import { embedFilaPreset } from "@/lib/fila-preset";
import { buildCadastroPayload } from "@/lib/cadastro-valores";
import { resolveDefaultTenantId } from "@/lib/tenant-id";
import { fetchSessionTenantId } from "@/lib/session-tenant";
import { fetchServicos } from "@/lib/fetch-servicos";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CadastroCategoryEntry, ResolvedTenantConfig } from "@/lib/tenant-config";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import {
  appendAviacaoTimelineEntry,
  buildAviacaoRegistryObservacao,
  buildAviacaoSavePayload,
  AVIACAO_CLIENT_PANEL_HIDDEN_CATEGORY_IDS,
  AVIACAO_COMBUSTIVEL_OPTIONS,
  AVIACAO_FIELD_COMBUSTIVEL,
  AVIACAO_FIELD_HOBBS,
  AVIACAO_FIELD_SERVICOS,
  AVIACAO_HANGAR_CATEGORY_ID,
  AVIACAO_INLINE_OBSERVACAO_FIELD_ID,
  AVIACAO_MODELO_CATEGORY_ID,
  AVIACAO_MODELO_MODAL_DATALIST_ID,
  AVIACAO_PREFIXO_CATEGORY_ID,
  AVIACAO_PREFIXO_MODAL_DATALIST_ID,
  AVIACAO_QUEUE_TAB,
  AVIACAO_REQUIRED_CATEGORY_IDS,
  isAviacaoFreeTextField,
  isAviacaoObservacaoInlineField,
  isAviacaoRigidSelectField,
  isAviacaoRequiredCategory,
  isAviacaoSegment,
  isAviacaoUrgenciaSelectMode,
  parseAviacaoServicosSolicitados,
  resolveAviacaoCategoryLabel,
  resolveAviacaoQueueTabs,
  resolveAviacaoSelectOptions,
  resolveAviacaoServicosSolicitadosOptions,
  serializeAviacaoServicosSolicitados,
} from "@/lib/aviacao-logistics";
import {
  buildDocasRegistryObservacao,
  buildDocasSavePayload,
  DOCAS_QUEUE_TAB,
  DOCAS_REQUIRED_CATEGORY_IDS,
  isDocasRequiredCategory,
  isDocasSegment,
  isDocasTextField,
} from "@/lib/docas-logistics";
import { buildHoraMarcadaTodayIso } from "@/lib/hora-marcada";
import { PriorityClassSelector } from "@/components/screenflow/priority-class-selector";

type OptRow = { id: string; nome: string | null };

type RegistryPatientModalProps = {
  open: boolean;
  onClose: () => void;
  supabase: SupabaseClient | null;
  tenantId: string | null;
  tenantConfig: ResolvedTenantConfig;
  defaultStatus?: string;
  onRegistered?: (meta?: { queueTabId?: string }) => void;
};

export function RegistryPatientModal({
  open,
  onClose,
  supabase,
  tenantId,
  tenantConfig,
  defaultStatus = "Aguardando",
  onRegistered,
}: RegistryPatientModalProps) {
  const rf = tenantConfig.registerForm;
  const law = tenantConfig.priorityLawEnabled;
  const docasMode = isDocasSegment(tenantConfig.segmentoAplicado);
  const aviacaoMode = isAviacaoSegment(tenantConfig.segmentoAplicado);
  const enabledCategories = useMemo(
    () => tenantConfig.cadastroCategories.filter((c) => c.enabled),
    [tenantConfig.cadastroCategories]
  );
  const queueTabs = useMemo(
    () => (aviacaoMode ? resolveAviacaoQueueTabs(tenantConfig) : tenantConfig.queueTabs),
    [aviacaoMode, tenantConfig]
  );

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessionTenantId, setSessionTenantId] = useState<string | null>(null);

  const effectiveTenantId = useMemo(
    () => sessionTenantId ?? (tenantId?.trim() || resolveDefaultTenantId()),
    [sessionTenantId, tenantId]
  );

  const aviacaoRegistryCategories = useMemo(() => {
    if (!aviacaoMode) return enabledCategories;
    const hidden = new Set<string>([
      ...AVIACAO_CLIENT_PANEL_HIDDEN_CATEGORY_IDS,
      AVIACAO_INLINE_OBSERVACAO_FIELD_ID,
    ]);
    return enabledCategories.filter((c) => !hidden.has(c.id));
  }, [aviacaoMode, enabledCategories]);

  const loadLookupOptions = useCallback(async () => {
    if (!supabase) return;
    const tid = effectiveTenantId;
    const [p, sResult, l] = await Promise.all([
      supabase
        .from("profissionais")
        .select("id,nome,especialidade")
        .eq("tenant_id", tid)
        .order("nome"),
      fetchServicos(supabase, tid),
      supabase.from("locais").select("id,nome").eq("tenant_id", tid).order("nome"),
    ]);
    setProfissionais((p.data as ProfissionalRow[] | null) ?? []);
    setServicos(sResult.data);
    setLocais((l.data as OptRow[] | null) ?? []);
  }, [supabase, effectiveTenantId]);

  function resolveAviacaoRegistryCategoryLabel(cat: CadastroCategoryEntry): string {
    const stored = resolveAviacaoCategoryLabel(cat);
    if (
      cat.id === AVIACAO_PREFIXO_CATEGORY_ID ||
      cat.id === AVIACAO_MODELO_CATEGORY_ID ||
      /lista de prefixos/i.test(stored)
    ) {
      return "Modelo da Aeronave";
    }
    return stored;
  }

  function renderCategoryField(cat: (typeof enabledCategories)[number]) {
    const isRequired =
      (docasMode && isDocasRequiredCategory(cat.id)) ||
      (aviacaoMode && isAviacaoRequiredCategory(cat.id));
    const requiredMark = isRequired ? (
      <span className="text-red-600 dark:text-red-400"> *</span>
    ) : null;
    const categoryLabel = aviacaoMode
      ? resolveAviacaoRegistryCategoryLabel(cat)
      : cat.label;

    if (aviacaoMode && isAviacaoFreeTextField(cat.id)) {
      const freeTextOpts = resolveAviacaoSelectOptions(cat.id, { profissionais, locais, servicos });
      const datalistId =
        cat.id === AVIACAO_MODELO_CATEGORY_ID
          ? AVIACAO_MODELO_MODAL_DATALIST_ID
          : AVIACAO_PREFIXO_MODAL_DATALIST_ID;
      return (
        <label key={cat.id} className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          {categoryLabel}
          {requiredMark}
          <input
            type="text"
            list={datalistId}
            value={formValues[cat.id] ?? ""}
            disabled={busy}
            onChange={(e) => setFormValues((prev) => ({ ...prev, [cat.id]: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            autoComplete="off"
          />
          <datalist id={datalistId}>
            {freeTextOpts.map((m) => (
              <option key={m.id} value={m.nome ?? m.id} />
            ))}
          </datalist>
        </label>
      );
    }

    if (aviacaoMode && isAviacaoRigidSelectField(cat.id)) {
      const opts = resolveAviacaoSelectOptions(cat.id, { profissionais, locais, servicos });
      return (
        <label key={cat.id} className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          {categoryLabel}
          {requiredMark}
          <select
            value={formValues[cat.id] ?? ""}
            disabled={busy}
            onChange={(e) => setFormValues((prev) => ({ ...prev, [cat.id]: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
          >
            <option value="">—</option>
            {opts.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome ?? m.id}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (aviacaoMode && cat.id === AVIACAO_INLINE_OBSERVACAO_FIELD_ID) {
      if (isAviacaoUrgenciaSelectMode(servicos)) {
        const opts = resolveAviacaoSelectOptions(cat.id, { profissionais, locais, servicos });
        return (
          <label key={cat.id} className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {categoryLabel}
            {requiredMark}
            <select
              value={formValues[cat.id] ?? ""}
              disabled={busy}
              onChange={(e) => setFormValues((prev) => ({ ...prev, [cat.id]: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            >
              <option value="">—</option>
              {opts.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome ?? m.id}
                </option>
              ))}
            </select>
          </label>
        );
      }
      if (isAviacaoObservacaoInlineField(cat.id, servicos)) {
        return (
          <label key={cat.id} className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {categoryLabel}
            {requiredMark}
            <input
              type="text"
              value={formValues[cat.id] ?? ""}
              disabled={busy}
              onChange={(e) => setFormValues((prev) => ({ ...prev, [cat.id]: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </label>
        );
      }
    }

    if (docasMode && isDocasTextField(cat.id)) {
      return (
        <label key={cat.id} className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          {cat.label}
          {requiredMark}
          <input
            type="text"
            value={formValues[cat.id] ?? ""}
            onChange={(e) => setFormValues((prev) => ({ ...prev, [cat.id]: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </label>
      );
    }

    const options =
      cat.tableKey === "profissionais"
        ? profissionais.map((m) => ({ id: m.id, label: formatProfissionalLabel(m) }))
        : cat.tableKey === "locais"
          ? locais.map((m) => ({ id: m.id, label: m.nome ?? m.id }))
          : servicos.map((m) => ({ id: m.id, label: m.nome ?? m.id }));

    return (
      <label key={cat.id} className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {cat.label}
        {requiredMark}
        <select
          value={formValues[cat.id] ?? ""}
          onChange={(e) => setFormValues((prev) => ({ ...prev, [cat.id]: e.target.value }))}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
        >
          <option value="">—</option>
          {options.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const initialTriagemTabId = useMemo(() => {
    if (docasMode) {
      return queueTabs.find((t) => t.id === DOCAS_QUEUE_TAB.NO_PATIO)?.id ?? queueTabs[0]?.id ?? "";
    }
    if (aviacaoMode) {
      return queueTabs.find((t) => t.id === AVIACAO_QUEUE_TAB.TRIAGEM)?.id ?? queueTabs[0]?.id ?? "";
    }
    return queueTabs[0]?.id ?? "";
  }, [docasMode, aviacaoMode, queueTabs]);

  const [nomeCliente, setNomeCliente] = useState("");
  const [triagemTabId, setTriagemTabId] = useState(initialTriagemTabId);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [horaMarcada, setHoraMarcada] = useState("");
  const [classificacao, setClassificacao] = useState<ClassificacaoPrioridade>("normal");
  const [observacaoBase, setObservacaoBase] = useState("");

  const [profissionais, setProfissionais] = useState<ProfissionalRow[]>([]);
  const [servicos, setServicos] = useState<OptRow[]>([]);
  const [locais, setLocais] = useState<OptRow[]>([]);

  const aviacaoServicosOptions = useMemo(
    () => (aviacaoMode ? resolveAviacaoServicosSolicitadosOptions(servicos) : []),
    [aviacaoMode, servicos]
  );

  const aviacaoServicosSelected = useMemo(
    () => parseAviacaoServicosSolicitados(formValues[AVIACAO_FIELD_SERVICOS]),
    [formValues]
  );

  function toggleAviacaoServico(id: string) {
    const next = aviacaoServicosSelected.includes(id)
      ? aviacaoServicosSelected.filter((x) => x !== id)
      : [...aviacaoServicosSelected, id];
    setFormValues((prev) => ({
      ...prev,
      [AVIACAO_FIELD_SERVICOS]: serializeAviacaoServicosSolicitados(next),
    }));
  }

  const triagemTab = useMemo(
    () => queueTabs.find((t) => t.id === triagemTabId) ?? queueTabs[0],
    [queueTabs, triagemTabId]
  );

  const triagemLabel = triagemTab?.label ?? "Entrada na fila";

  useEffect(() => {
    if (!open || !supabase) return;
    let cancelled = false;
    void fetchSessionTenantId(supabase).then((tid) => {
      if (!cancelled) setSessionTenantId(tid);
    });
    return () => {
      cancelled = true;
    };
  }, [open, supabase]);

  useEffect(() => {
    if (!open || !supabase) return;
    void loadLookupOptions();
  }, [open, supabase, loadLookupOptions]);

  useEffect(() => {
    if (!open) return;
    setNomeCliente("");
    setTriagemTabId(initialTriagemTabId);
    setFormValues({});
    setHoraMarcada("");
    setClassificacao("normal");
    setObservacaoBase("");
    setError(null);
  }, [open, tenantConfig.priorityLawEnabled, queueTabs, initialTriagemTabId]);

  function handleTriagemChange(tabId: string) {
    setTriagemTabId(tabId);
    if (docasMode || aviacaoMode) return;
    const tab = queueTabs.find((t) => t.id === tabId);
    if (tab?.preset !== "hora") setHoraMarcada("");
  }

  const showAviacaoHoraAgendada = aviacaoMode;
  const showDocasHoraAgendada = docasMode;
  const showHoraHoje = !docasMode && !aviacaoMode && triagemTab?.preset === "hora";

  async function submitViaApi(
    pacienteNome: string,
    atendimentoPayload: Record<string, unknown>
  ): Promise<{ ok: boolean; message?: string }> {
    if (!supabase) return { ok: false, message: "Supabase indisponível." };
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return { ok: false, message: "Sessão ausente." };

    const res = await fetch("/api/register-atendimento", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        tenantId: effectiveTenantId,
        pacienteNome: pacienteNome || null,
        atendimento: atendimentoPayload,
      }),
    });
    const json = (await res.json()) as { ok?: boolean; message?: string };
    return { ok: !!res.ok && !!json.ok, message: json.message };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;

    if (docasMode) {
      const missing = DOCAS_REQUIRED_CATEGORY_IDS.filter((id) => !formValues[id]?.trim());
      if (missing.length > 0) {
        setError("Placa é obrigatória.");
        return;
      }
    }
    if (aviacaoMode) {
      if (!formValues[AVIACAO_PREFIXO_CATEGORY_ID]?.trim()) {
        setError("Prefixo da Aeronave é obrigatório.");
        return;
      }
      if (!formValues[AVIACAO_FIELD_HOBBS]?.trim()) {
        setError("Horas de Voo (Hobbs) é obrigatório.");
        return;
      }
      if (!formValues[AVIACAO_FIELD_COMBUSTIVEL]?.trim()) {
        setError("Nível de Combustível é obrigatório.");
        return;
      }
      if (!formValues[AVIACAO_HANGAR_CATEGORY_ID]?.trim()) {
        setError("Vaga / Hangar / Box é obrigatório.");
        return;
      }
    }

    setBusy(true);
    setError(null);

    let pacienteId: string | null = null;
    const nome = nomeCliente.trim();
    if (nome) {
      const { data: pRow, error: pErr } = await supabase
        .from("pacientes")
        .insert({ nome, tenant_id: effectiveTenantId })
        .select("id")
        .single();
      if (pErr || !pRow) {
        if (pErr && /row-level security/i.test(pErr.message)) {
          const viaApi = await submitViaApi(nome, buildAtendimentoPayload(null));
          if (viaApi.ok) {
            onRegistered?.({ queueTabId: triagemTabId });
            onClose();
            setBusy(false);
            return;
          }
          setError(viaApi.message ?? pErr.message);
        } else {
          setError(pErr?.message ?? "Falha ao criar cliente.");
        }
        setBusy(false);
        return;
      }
      pacienteId = (pRow as { id: string }).id;
    }

    function buildAtendimentoPayload(pacienteIdValue: string | null): Record<string, unknown> {
      const userObs = observacaoBase.trim();
      const filaPreset = triagemTab?.preset ?? "ordem";

      const observacao = aviacaoMode
        ? (() => {
            const { aviacaoFields } = buildAviacaoSavePayload(
              formValues,
              tenantConfig.cadastroCategories
            );
            const withTimeline = appendAviacaoTimelineEntry(aviacaoFields, {
              action: "Ficha de entrada — Triagem / Check-in",
              user: "Sistema",
            });
            return buildAviacaoRegistryObservacao(
              userObs || null,
              filaPreset,
              triagemTab?.id,
              withTimeline
            );
          })()
        : docasMode
          ? (() => {
              const { docasFields } = buildDocasSavePayload(formValues, tenantConfig.cadastroCategories);
              return buildDocasRegistryObservacao(userObs || null, filaPreset, triagemTab?.id, docasFields);
            })()
          : embedFilaPreset(userObs || null, filaPreset, triagemTab?.id);

      const cadastroPayload = aviacaoMode
        ? buildAviacaoSavePayload(formValues, tenantConfig.cadastroCategories).cadastroPayload
        : docasMode
          ? buildDocasSavePayload(formValues, tenantConfig.cadastroCategories).cadastroPayload
          : buildCadastroPayload(formValues, tenantConfig.cadastroCategories);

      const payload: Record<string, unknown> = {
        paciente_id: pacienteIdValue,
        tenant_id: effectiveTenantId,
        prioridade: law ? prioridadeBooleanFromClassificacao(classificacao) : false,
        classificacao_prioridade: law ? classificacao : "normal",
        observacao,
        status: defaultStatus,
        ...cadastroPayload,
      };

      const wantsHora =
        docasMode || aviacaoMode || triagemTab?.preset === "hora" || rf.showHoraMarcada;
      if (wantsHora && horaMarcada.trim()) {
        payload.hora_marcada = buildHoraMarcadaTodayIso(horaMarcada);
      } else if (!docasMode && !aviacaoMode && triagemTab?.preset === "encaixe") {
        payload.hora_marcada = null;
      }

      return payload;
    }

    const payload = buildAtendimentoPayload(pacienteId);

    const { error: aErr } = await supabase.from("atendimentos_lite").insert(payload);
    if (aErr) {
      if (/row-level security/i.test(aErr.message)) {
        const viaApi = await submitViaApi("", buildAtendimentoPayload(pacienteId));
        if (viaApi.ok) {
          onRegistered?.({ queueTabId: triagemTabId });
          onClose();
          setBusy(false);
          return;
        }
        setError(viaApi.message ?? aErr.message);
      } else {
        setError(aErr.message);
      }
      setBusy(false);
      return;
    }

    onRegistered?.({ queueTabId: triagemTabId });
    onClose();
    setBusy(false);
  }

  const visibleFields =
    rf.showClienteNome ||
    queueTabs.length > 0 ||
    enabledCategories.length > 0 ||
    rf.showHoraMarcada ||
    showDocasHoraAgendada ||
    showAviacaoHoraAgendada ||
    law ||
    rf.showObservacao;

  return (
    <Modal open={open} title="Novo registro" onClose={onClose} widthClassName="max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {!visibleFields && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Nenhum campo visível nas configurações. Ative campos em Configurações → Geral.
          </p>
        )}

        {queueTabs.length > 0 ? (
          <>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              {aviacaoMode ? "Estágio" : triagemLabel}
              <select
                value={triagemTabId}
                disabled={aviacaoMode || busy}
                onChange={(e) => handleTriagemChange(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 disabled:cursor-not-allowed disabled:opacity-70 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
              >
                {aviacaoMode ? (
                  <option value={AVIACAO_QUEUE_TAB.TRIAGEM}>Triagem / Check-in</option>
                ) : (
                  queueTabs.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))
                )}
              </select>
            </label>
            {showHoraHoje ? (
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Horário marcado (hoje)
                <input
                  type="time"
                  value={horaMarcada}
                  onChange={(e) => setHoraMarcada(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </label>
            ) : null}
          </>
        ) : null}

        {rf.showClienteNome ? (
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {aviacaoMode ? (
              <>
                Prefixo da Aeronave
                <span className="text-red-600 dark:text-red-400"> *</span>
              </>
            ) : (
              "Nome do cliente"
            )}
            <input
              value={nomeCliente}
              onChange={(e) => setNomeCliente(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </label>
        ) : null}

        {(aviacaoMode ? aviacaoRegistryCategories : enabledCategories).map((cat) =>
          renderCategoryField(cat)
        )}

        {aviacaoMode ? (
          <>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Horas de Voo (Hobbs)
              <span className="text-red-600 dark:text-red-400"> *</span>
              <input
                type="text"
                inputMode="decimal"
                value={formValues[AVIACAO_FIELD_HOBBS] ?? ""}
                disabled={busy}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, [AVIACAO_FIELD_HOBBS]: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
              />
            </label>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Nível de Combustível
              <span className="text-red-600 dark:text-red-400"> *</span>
              <select
                value={formValues[AVIACAO_FIELD_COMBUSTIVEL] ?? ""}
                disabled={busy}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, [AVIACAO_FIELD_COMBUSTIVEL]: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
              >
                <option value="">—</option>
                {AVIACAO_COMBUSTIVEL_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
            {aviacaoServicosOptions.length > 0 ? (
              <fieldset className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                <legend className="mb-1">Serviços Solicitados</legend>
                <div className="flex flex-col gap-1.5 rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
                  {aviacaoServicosOptions.map((svc) => (
                    <label key={svc.id} className="inline-flex cursor-pointer items-center gap-2 font-normal">
                      <input
                        type="checkbox"
                        checked={aviacaoServicosSelected.includes(svc.id)}
                        disabled={busy}
                        onChange={() => toggleAviacaoServico(svc.id)}
                        className="size-3.5 rounded border-zinc-300"
                      />
                      {svc.nome ?? svc.id}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
          </>
        ) : null}

        {showDocasHoraAgendada || showAviacaoHoraAgendada ? (
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" strokeWidth={2} aria-hidden />
              {showAviacaoHoraAgendada ? "ETA — Horário estimado de pouso" : "Horário agendado"}
            </span>
            <input
              type="time"
              value={horaMarcada}
              onChange={(e) => setHoraMarcada(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </label>
        ) : null}

        {law ? (
          <PriorityClassSelector value={classificacao} onChange={setClassificacao} disabled={busy} />
        ) : null}

        {rf.showObservacao ? (
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Observações
            <textarea
              value={observacaoBase}
              onChange={(e) => setObservacaoBase(e.target.value)}
              rows={3}
              className="mt-1 w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </label>
        ) : null}

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !supabase}
          className="mt-1 rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {busy ? "Salvando…" : "Adicionar à fila"}
        </button>
      </form>
    </Modal>
  );
}
