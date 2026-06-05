"use client";

import type { AtendimentoLite } from "@/lib/atendimentos-lite";
import {
  prioridadeBooleanFromClassificacao,
  resolveClassificacaoPrioridade,
  type ClassificacaoPrioridade,
} from "@/lib/classificacao-prioridade";
import { buildCadastroPayload, hydrateCadastroValores } from "@/lib/cadastro-valores";
import {
  appendAviacaoTimelineEntry,
  buildAviacaoSavePayload,
  AVIACAO_FIELD_ANEXOS,
  AVIACAO_INLINE_OBSERVACAO_FIELD_ID,
  AVIACAO_MODELO_CATEGORY_ID,
  AVIACAO_MODELO_MODAL_DATALIST_ID,
  AVIACAO_PREFIXO_MODAL_DATALIST_ID,
  AVIACAO_STORAGE_BUCKET,
  formatAviacaoTimelineLine,
  hydrateAviacaoFormValue,
  hydrateAviacaoFreeTextValue,
  isAviacaoFreeTextField,
  looksLikeAviacaoUuid,
  isAviacaoObservacaoInlineField,
  isAviacaoRigidSelectField,
  isAviacaoSegment,
  isAviacaoUrgenciaSelectMode,
  mergeAviacaoObservacao,
  parseAviacaoAnexos,
  parseAviacaoCadastroFields,
  parseAviacaoFilaTabId,
  parseAviacaoTimeline,
  requiresAviacaoPecaJustification,
  resolveAviacaoCategoryLabel,
  resolveAviacaoQueueTabs,
  resolveAviacaoSelectOptions,
  resolveAviacaoTabActionLabel,
  type AviacaoAnexo,
} from "@/lib/aviacao-logistics";
import {
  buildDocasSavePayload,
  isDocasSegment,
  isDocasTextField,
  mergeDocasObservacao,
  parseDocasCadastroFields,
} from "@/lib/docas-logistics";
import {
  embedObservacaoForQueueTab,
  formatObservacaoForDisplay,
  resolveRowQueueTabId,
} from "@/lib/fila-preset";
import { formatProfissionalLabel, type ProfissionalRow } from "@/lib/profissionais-display";
import { fetchServicos } from "@/lib/fetch-servicos";
import {
  datetimeLocalToIso,
  isoToTimeInputValue,
  mergeHoraMarcadaPreserveDate,
} from "@/lib/hora-marcada";
import type { CadastroCategoryEntry, ResolvedTenantConfig } from "@/lib/tenant-config";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { PriorityClassSelector } from "@/components/screenflow/priority-class-selector";

type OptRow = { id: string; nome: string | null };

type EditAtendimentoModalProps = {
  open: boolean;
  row: AtendimentoLite | null;
  onClose: () => void;
  supabase: SupabaseClient | null;
  tenantConfig: ResolvedTenantConfig;
  /** Data/hora completa só na Agenda PRO; na fila diária usa apenas horário (HH:MM). */
  allowFullDatetime?: boolean;
  onSaved: () => void;
};

type FormProps = {
  row: AtendimentoLite;
  onClose: () => void;
  supabase: SupabaseClient;
  tenantConfig: ResolvedTenantConfig;
  allowFullDatetime: boolean;
  onSaved: () => void;
};

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EditAtendimentoForm({ row, onClose, supabase, tenantConfig, allowFullDatetime, onSaved }: FormProps) {
  const rf = tenantConfig.registerForm;
  const law = tenantConfig.priorityLawEnabled;
  const docasMode = isDocasSegment(tenantConfig.segmentoAplicado);
  const aviacaoMode = isAviacaoSegment(tenantConfig.segmentoAplicado);
  const queueTabs = useMemo(
    () => (aviacaoMode ? resolveAviacaoQueueTabs(tenantConfig) : tenantConfig.queueTabs),
    [aviacaoMode, tenantConfig]
  );
  const enabledCategories = useMemo(
    () => tenantConfig.cadastroCategories.filter((c) => c.enabled),
    [tenantConfig.cadastroCategories]
  );
  const initialTriagemTabId = resolveRowQueueTabId(row, queueTabs) || queueTabs[0]?.id || "";
  const initialFormValues = useMemo(() => {
    if (aviacaoMode) {
      const inlineFields = parseAviacaoCadastroFields(row.observacao);
      const hydrated = hydrateCadastroValores(row.cadastro_valores, tenantConfig.cadastroCategories, {
        profissional_id: row.profissional_id,
        local_id: row.local_id,
        especialidade_id: row.especialidade_id,
      });
      const out: Record<string, string> = {};
      for (const cat of enabledCategories) {
        if (isAviacaoFreeTextField(cat.id)) {
          const t = inlineFields[cat.id];
          if (t && !looksLikeAviacaoUuid(t)) out[cat.id] = t;
        } else if (isAviacaoObservacaoInlineField(cat.id) && !isAviacaoFreeTextField(cat.id)) {
          const t = inlineFields[cat.id];
          if (t) out[cat.id] = t;
        } else if (isAviacaoRigidSelectField(cat.id)) {
          const v = hydrated[cat.id];
          if (v) out[cat.id] = v;
          else {
            const legacy = inlineFields[cat.id];
            if (legacy) out[cat.id] = legacy;
          }
        } else if (cat.id === AVIACAO_INLINE_OBSERVACAO_FIELD_ID) {
          const v = hydrated[cat.id];
          if (v) out[cat.id] = v;
          else {
            const t = inlineFields[cat.id];
            if (t) out[cat.id] = t;
          }
        }
      }
      return out;
    }
    if (docasMode) {
      const inlineFields = parseDocasCadastroFields(row.observacao);
      const hydrated = hydrateCadastroValores(row.cadastro_valores, tenantConfig.cadastroCategories, {
        profissional_id: row.profissional_id,
        local_id: row.local_id,
        especialidade_id: row.especialidade_id,
      });
      const out: Record<string, string> = {};
      for (const cat of enabledCategories) {
        if (isDocasTextField(cat.id)) {
          const t = inlineFields[cat.id];
          if (t) out[cat.id] = t;
        } else {
          const v = hydrated[cat.id];
          if (v) out[cat.id] = v;
        }
      }
      return out;
    }
    const hydrated = hydrateCadastroValores(row.cadastro_valores, tenantConfig.cadastroCategories, {
      profissional_id: row.profissional_id,
      local_id: row.local_id,
      especialidade_id: row.especialidade_id,
    });
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(hydrated)) {
      if (v) out[k] = v;
    }
    return out;
  }, [row, tenantConfig.cadastroCategories, docasMode, aviacaoMode, enabledCategories]);

  const [triagemTabId, setTriagemTabId] = useState(initialTriagemTabId);
  const [nomeCliente, setNomeCliente] = useState(row.nome ?? "");
  const [formValues, setFormValues] = useState<Record<string, string>>(initialFormValues);
  const [horaMarcada, setHoraMarcada] = useState(() =>
    allowFullDatetime ? toDatetimeLocal(row.hora_marcada) : isoToTimeInputValue(row.hora_marcada)
  );
  const [classificacao, setClassificacao] = useState<ClassificacaoPrioridade>(() =>
    resolveClassificacaoPrioridade(row.classificacao_prioridade, row.prioridade)
  );
  const [observacaoBase, setObservacaoBase] = useState(() => formatObservacaoForDisplay(row.observacao));
  const [profissionais, setProfissionais] = useState<ProfissionalRow[]>([]);
  const [locais, setLocais] = useState<OptRow[]>([]);
  const [servicos, setServicos] = useState<OptRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [pendingAnexos, setPendingAnexos] = useState<AviacaoAnexo[]>(() =>
    aviacaoMode ? parseAviacaoAnexos(row.observacao) : []
  );
  const aviacaoTimeline = useMemo(
    () => (aviacaoMode ? parseAviacaoTimeline(row.observacao) : []),
    [aviacaoMode, row.observacao]
  );
  const loadLookupOptions = useCallback(async () => {
    const tid = row.tenant_id?.trim();
    const profQuery = tid
      ? supabase.from("profissionais").select("id,nome,especialidade").eq("tenant_id", tid).order("nome")
      : supabase.from("profissionais").select("id,nome,especialidade").order("nome");
    const locQuery = tid
      ? supabase.from("locais").select("id,nome").eq("tenant_id", tid).order("nome")
      : supabase.from("locais").select("id,nome").order("nome");
    const [p, l, sResult] = await Promise.all([profQuery, locQuery, fetchServicos(supabase, row.tenant_id)]);
    setProfissionais((p.data as ProfissionalRow[] | null) ?? []);
    setLocais((l.data as OptRow[] | null) ?? []);
    setServicos(sResult.data);
  }, [supabase, row.tenant_id]);

  const triagemTab = useMemo(
    () => queueTabs.find((t) => t.id === triagemTabId) ?? queueTabs[0],
    [queueTabs, triagemTabId]
  );
  const triagemLabel = triagemTab?.label ?? "Entrada na fila";

  useEffect(() => {
    void loadLookupOptions();
  }, [loadLookupOptions]);

  useEffect(() => {
    if (!aviacaoMode) return;
    setPendingAnexos(parseAviacaoAnexos(row.observacao));
  }, [aviacaoMode, row.id, row.observacao]);

  async function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function handleAviacaoUpload(files: FileList | null) {
    if (!files?.length || !aviacaoMode) return;
    setUploadBusy(true);
    setError(null);
    try {
      const added: AviacaoAnexo[] = [];
      for (const file of Array.from(files)) {
        const id = crypto.randomUUID();
        const uploadedAt = new Date().toISOString();
        const tid = row.tenant_id?.trim() || "shared";
        const path = `${tid}/${row.id}/${id}-${file.name.replace(/[^\w.-]+/g, "_")}`;

        let url = "";
        const { error: upErr } = await supabase.storage
          .from(AVIACAO_STORAGE_BUCKET)
          .upload(path, file, { upsert: false });
        if (!upErr) {
          const { data } = supabase.storage.from(AVIACAO_STORAGE_BUCKET).getPublicUrl(path);
          url = data.publicUrl;
        } else if (file.size < 500_000 && file.type.startsWith("image/")) {
          url = await readFileAsDataUrl(file);
        } else {
          setError(upErr.message || "Falha ao enviar arquivo. Configure o bucket aviacao-anexos.");
          continue;
        }

        added.push({ id, name: file.name, mime: file.type, uploadedAt, url });
      }
      if (added.length > 0) {
        setPendingAnexos((prev) => [...prev, ...added]);
      }
    } finally {
      setUploadBusy(false);
    }
  }

  useEffect(() => {
    if (!aviacaoMode) return;
    const inlineFields = parseAviacaoCadastroFields(row.observacao);
    const hydrated = hydrateCadastroValores(row.cadastro_valores, tenantConfig.cadastroCategories, {
      profissional_id: row.profissional_id,
      local_id: row.local_id,
      especialidade_id: row.especialidade_id,
    });
    const lookups = { profissionais, locais, servicos };
    setFormValues((prev) => {
      const next = { ...prev };
      for (const cat of enabledCategories) {
        if (isAviacaoRigidSelectField(cat.id)) {
          const opts = resolveAviacaoSelectOptions(cat.id, lookups);
          const v = hydrateAviacaoFormValue(cat.id, hydrated, row.observacao, opts);
          if (v) next[cat.id] = v;
        } else if (isAviacaoFreeTextField(cat.id)) {
          const opts = resolveAviacaoSelectOptions(cat.id, lookups);
          const v = hydrateAviacaoFreeTextValue(cat.id, hydrated, row.observacao, opts);
          if (v) next[cat.id] = v;
        } else if (cat.id === AVIACAO_INLINE_OBSERVACAO_FIELD_ID && isAviacaoUrgenciaSelectMode(servicos)) {
          const opts = resolveAviacaoSelectOptions(cat.id, lookups);
          const v = hydrateAviacaoFormValue(cat.id, hydrated, row.observacao, opts);
          if (v) next[cat.id] = v;
        } else if (isAviacaoObservacaoInlineField(cat.id, servicos) && !isAviacaoFreeTextField(cat.id)) {
          const t = inlineFields[cat.id];
          if (t) next[cat.id] = t;
        }
      }
      return next;
    });
  }, [
    aviacaoMode,
    row.observacao,
    row.cadastro_valores,
    row.profissional_id,
    row.local_id,
    row.especialidade_id,
    tenantConfig.cadastroCategories,
    enabledCategories,
    profissionais,
    locais,
    servicos,
  ]);

  function handleTriagemChange(tabId: string) {
    setTriagemTabId(tabId);
    if (docasMode || aviacaoMode) return;
    const tab = queueTabs.find((t) => t.id === tabId);
    if (tab?.preset !== "hora") setHoraMarcada("");
  }

  const showDocasHoraAgendada = docasMode;
  const showAviacaoHoraAgendada = aviacaoMode;

  function renderCategoryField(cat: (typeof enabledCategories)[number]) {
    if (aviacaoMode && isAviacaoFreeTextField(cat.id)) {
      const freeTextOpts = resolveAviacaoSelectOptions(cat.id, { profissionais, locais, servicos });
      const datalistId =
        cat.id === AVIACAO_MODELO_CATEGORY_ID
          ? AVIACAO_MODELO_MODAL_DATALIST_ID
          : AVIACAO_PREFIXO_MODAL_DATALIST_ID;
      return (
        <label key={cat.id} className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          {resolveAviacaoCategoryLabel(cat)}
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
          {resolveAviacaoCategoryLabel(cat)}
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
            {resolveAviacaoCategoryLabel(cat)}
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
            {resolveAviacaoCategoryLabel(cat)}
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    if (row.paciente_id) {
      const { error: pe } = await supabase
        .from("pacientes")
        .update({ nome: nomeCliente.trim() || "" })
        .eq("id", row.paciente_id);
      if (pe) {
        setError(pe.message);
        setBusy(false);
        return;
      }
    }

    let patch: Record<string, unknown>;
    if (docasMode) {
      const { cadastroPayload, docasFields } = buildDocasSavePayload(
        formValues,
        tenantConfig.cadastroCategories
      );
      const observacao = mergeDocasObservacao({
        current: row.observacao,
        tab: triagemTab,
        docasFields,
        preserveTabWhenUnset: true,
        userObservacaoText: observacaoBase.trim() || null,
      });
      patch = { ...cadastroPayload, observacao };
    } else if (aviacaoMode) {
      const { cadastroPayload, aviacaoFields } = buildAviacaoSavePayload(
        formValues,
        tenantConfig.cadastroCategories
      );
      if (pendingAnexos.length > 0) {
        aviacaoFields[AVIACAO_FIELD_ANEXOS] = JSON.stringify(pendingAnexos);
      }

      const fromTabId = parseAviacaoFilaTabId(row.observacao);
      const toTabId = triagemTab?.id;
      let fieldsWithTimeline = aviacaoFields;
      if (toTabId && fromTabId !== toTabId) {
        let justification: string | undefined;
        if (requiresAviacaoPecaJustification(toTabId)) {
          const input = window.prompt(
            "Justificativa obrigatória para Aguardando Peças:",
            ""
          );
          if (!input?.trim()) {
            setError("Justificativa obrigatória para mover para Aguardando Peças.");
            setBusy(false);
            return;
          }
          justification = input.trim();
        }
        fieldsWithTimeline = appendAviacaoTimelineEntry(fieldsWithTimeline, {
          action: resolveAviacaoTabActionLabel(fromTabId, toTabId),
          user: "Operador",
          detail: justification,
        });
      }

      const observacao = mergeAviacaoObservacao({
        current: row.observacao,
        tab: triagemTab,
        aviacaoFields: fieldsWithTimeline,
        preserveTabWhenUnset: true,
        userObservacaoText: observacaoBase.trim() || null,
      });
      patch = { ...cadastroPayload, observacao };
    } else {
      patch = {
        ...buildCadastroPayload(formValues, tenantConfig.cadastroCategories),
        observacao: embedObservacaoForQueueTab(observacaoBase.trim() || null, triagemTab),
      };
    }

    if (law) {
      patch.prioridade = prioridadeBooleanFromClassificacao(classificacao);
      patch.classificacao_prioridade = classificacao;
    }

    const wantsHora =
      docasMode || aviacaoMode || triagemTab?.preset === "hora" || rf.showHoraMarcada;
    if (wantsHora && horaMarcada.trim()) {
      if (allowFullDatetime && !docasMode && !aviacaoMode) {
        patch.hora_marcada = datetimeLocalToIso(horaMarcada) ?? horaMarcada.trim();
      } else {
        patch.hora_marcada = mergeHoraMarcadaPreserveDate(row.hora_marcada, horaMarcada);
      }
    } else if (!docasMode && !aviacaoMode && triagemTab?.preset === "encaixe") {
      patch.hora_marcada = null;
    }

    const { error: ae } = await supabase.from("atendimentos_lite").update(patch).eq("id", row.id);

    if (ae) {
      setError(ae.message);
      setBusy(false);
      return;
    }

    onSaved();
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
    triagemTab?.preset === "hora" ||
    law ||
    rf.showObservacao;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {!visibleFields && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Nenhum campo visível nas configurações. Ative campos em Configurações → Geral.
        </p>
      )}

      {queueTabs.length > 0 ? (
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          {triagemLabel}
          <select
            value={triagemTabId}
            onChange={(e) => handleTriagemChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
          >
            {queueTabs
              .filter((t) => t.preset !== "todos")
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
          </select>
        </label>
      ) : null}

      {rf.showClienteNome ? (
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Nome do cliente
          <input
            value={nomeCliente}
            onChange={(e) => setNomeCliente(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            disabled={!row.paciente_id}
          />
        </label>
      ) : null}

      {enabledCategories.map((cat) => renderCategoryField(cat))}

      {(showDocasHoraAgendada || showAviacaoHoraAgendada || rf.showHoraMarcada || triagemTab?.preset === "hora") ? (
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          {showDocasHoraAgendada || showAviacaoHoraAgendada ? (
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" strokeWidth={2} aria-hidden />
              {showAviacaoHoraAgendada ? "ETA (horário estimado de pouso)" : "Horário agendado"}
            </span>
          ) : allowFullDatetime ? (
            "Data e hora do agendamento"
          ) : (
            "Horário marcado (somente hora)"
          )}
          <input
            type={showDocasHoraAgendada || showAviacaoHoraAgendada || !allowFullDatetime ? "time" : "datetime-local"}
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

      {aviacaoMode ? (
        <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">Anexos / Fotos</p>
          <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
            Evidências de avarias de entrada/saída (bucket {AVIACAO_STORAGE_BUCKET}).
          </p>
          <input
            type="file"
            accept="image/*,.pdf"
            multiple
            disabled={busy || uploadBusy}
            onChange={(e) => void handleAviacaoUpload(e.target.files)}
            className="mt-2 w-full text-[10px] text-zinc-600 file:mr-2 file:rounded file:border-0 file:bg-zinc-200 file:px-2 file:py-1 file:text-[10px] dark:text-zinc-300 dark:file:bg-zinc-700"
          />
          {pendingAnexos.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {pendingAnexos.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 text-[10px]">
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {a.name}
                  </a>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setPendingAnexos((prev) => prev.filter((x) => x.id !== a.id))}
                    className="shrink-0 text-red-600 hover:underline dark:text-red-400"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[10px] text-zinc-500 dark:text-zinc-400">Nenhum anexo.</p>
          )}
        </div>
      ) : null}

      {aviacaoMode ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/40">
          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
            Linha do Tempo de Rampa
          </p>
          {aviacaoTimeline.length > 0 ? (
            <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-[10px] text-zinc-600 dark:text-zinc-300">
              {[...aviacaoTimeline].reverse().map((entry, idx) => (
                <li key={`${entry.ts}-${idx}`} className="border-b border-zinc-100 py-1 last:border-0 dark:border-zinc-800">
                  {formatAviacaoTimelineLine(entry)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[10px] text-zinc-500 dark:text-zinc-400">
              Movimentações de coluna aparecerão aqui automaticamente.
            </p>
          )}
        </div>
      ) : null}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {busy ? "Salvando…" : "Salvar"}
      </button>
    </form>
  );
}

export function EditAtendimentoModal({
  open,
  row,
  onClose,
  supabase,
  tenantConfig,
  allowFullDatetime = false,
  onSaved,
}: EditAtendimentoModalProps) {
  const aviacaoMode = isAviacaoSegment(tenantConfig.segmentoAplicado);
  return (
    <Modal
      open={open}
      title="Editar registro"
      onClose={onClose}
      widthClassName={aviacaoMode ? "max-w-lg" : "max-w-md"}
    >
      {open && row && supabase ? (
        <EditAtendimentoForm
          key={`${row.id}-${allowFullDatetime ? "agenda" : "fila"}`}
          row={row}
          supabase={supabase}
          tenantConfig={tenantConfig}
          allowFullDatetime={allowFullDatetime}
          onClose={onClose}
          onSaved={onSaved}
        />
      ) : open ? (
        <p className="text-xs text-zinc-500">
          {!row ? "Nenhum registro selecionado." : "Supabase indisponível no navegador."}
        </p>
      ) : null}
    </Modal>
  );
}
