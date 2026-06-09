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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock, Upload } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import {
  appendAviacaoTimelineEntry,
  buildAviacaoRegistryObservacao,
  buildAviacaoSavePayload,
  resolveMroCombustivelOptions,
  AVIACAO_FIELD_ANEXOS,
  AVIACAO_FIELD_COMBUSTIVEL,
  AVIACAO_FIELD_HOBBS,
  AVIACAO_FIELD_SERVICOS,
  AVIACAO_STORAGE_BUCKET,
  isAviacaoAnexoStoredInBucket,
  isSupabaseStorageRlsError,
  AVIACAO_HANGAR_CATEGORY_ID,
  AVIACAO_INLINE_OBSERVACAO_FIELD_ID,
  AVIACAO_MODELO_CATEGORY_ID,
  AVIACAO_PREFIXO_CATEGORY_ID,
  AVIACAO_RESPONSAVEL_CATEGORY_ID,
  AVIACAO_QUEUE_TAB,
  isMroLogisticsSegment,
  resolveMroFieldLabels,
  parseAviacaoServicosSolicitados,
  resolveAviacaoQueueTabs,
  resolveAviacaoRegisterFieldVisibility,
  resolveAviacaoKanbanColumnLabel,
  resolveAviacaoSelectOptions,
  resolveAviacaoServicosSolicitadosOptions,
  resolveMroRegisterFormLabels,
  resolveMroRegistryExtras,
  serializeAviacaoServicosSolicitados,
  validateAviacaoRequiredFormValues,
  type AviacaoAnexo,
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
import { buildHoraMarcadaTodayIso, datetimeLocalToIso } from "@/lib/hora-marcada";
import { PriorityClassSelector } from "@/components/screenflow/priority-class-selector";

type OptRow = { id: string; nome: string | null };

const REGISTRY_FIELD_CLASS =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50";
const REGISTRY_LABEL_CLASS = "block text-xs font-medium text-zinc-600 dark:text-zinc-400";
const REGISTRY_REQUIRED_MARK = (
  <span className="text-red-600 dark:text-red-400"> *</span>
);

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
  const aviacaoMode = isMroLogisticsSegment(tenantConfig.segmentoAplicado);
  const mroFieldLabels = resolveMroFieldLabels(tenantConfig.segmentoAplicado);
  const mroRegisterLabels = resolveMroRegisterFormLabels(tenantConfig.segmentoAplicado);
  const mroCombustivelOptions = resolveMroCombustivelOptions(tenantConfig.segmentoAplicado);
  const mroRegistryExtras = resolveMroRegistryExtras(tenantConfig.segmentoAplicado);
  const enabledCategories = useMemo(
    () => tenantConfig.cadastroCategories.filter((c) => c.enabled),
    [tenantConfig.cadastroCategories]
  );
  const queueTabs = useMemo(
    () => (aviacaoMode ? resolveAviacaoQueueTabs(tenantConfig) : tenantConfig.queueTabs),
    [aviacaoMode, tenantConfig]
  );
  const aviacaoFields = useMemo(
    () =>
      aviacaoMode
        ? resolveAviacaoRegisterFieldVisibility(rf, tenantConfig.cadastroCategories)
        : null,
    [aviacaoMode, rf, tenantConfig.cadastroCategories]
  );

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessionTenantId, setSessionTenantId] = useState<string | null>(null);

  const effectiveTenantId = useMemo(() => {
    const fromProp = tenantId?.trim();
    if (fromProp) return fromProp;
    return sessionTenantId ?? resolveDefaultTenantId();
  }, [tenantId, sessionTenantId]);

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

  function renderCategoryField(cat: (typeof enabledCategories)[number]) {
    const isRequired = docasMode && isDocasRequiredCategory(cat.id);
    const requiredMark = isRequired ? REGISTRY_REQUIRED_MARK : null;

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
  const [pendingAnexos, setPendingAnexos] = useState<AviacaoAnexo[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadSessionId] = useState(() => crypto.randomUUID());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const aviacaoLookups = useMemo(
    () => ({ profissionais, locais, servicos }),
    [profissionais, locais, servicos]
  );

  const aviacaoHangarOptions = useMemo(
    () =>
      aviacaoMode
        ? resolveAviacaoSelectOptions(AVIACAO_HANGAR_CATEGORY_ID, aviacaoLookups)
        : [],
    [aviacaoMode, aviacaoLookups]
  );

  const aviacaoServicosOptions = useMemo(
    () => (aviacaoMode ? resolveAviacaoServicosSolicitadosOptions(servicos) : []),
    [aviacaoMode, servicos]
  );

  const aviacaoServicosSelected = useMemo(
    () => parseAviacaoServicosSolicitados(formValues[AVIACAO_FIELD_SERVICOS]),
    [formValues]
  );

  const tecnicoSelectId = useMemo(() => {
    const raw = formValues[AVIACAO_RESPONSAVEL_CATEGORY_ID] ?? "";
    if (profissionais.some((p) => p.id === raw)) return raw;
    const match = profissionais.find((p) => formatProfissionalLabel(p) === raw);
    return match?.id ?? "";
  }, [formValues, profissionais]);

  const flowDestinationTabs = useMemo(
    () => queueTabs.filter((t) => t.preset !== "todos"),
    [queueTabs]
  );

  function patchAviacaoField(fieldId: string, value: string) {
    setFormValues((prev) => ({ ...prev, [fieldId]: value }));
  }

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
    setPendingAnexos([]);
    setDragOver(false);
    setError(null);
    setUploadWarning(null);
  }, [open, tenantConfig.priorityLawEnabled, queueTabs, initialTriagemTabId]);

  async function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function handleAviacaoUpload(files: FileList | null) {
    if (!files?.length || !aviacaoMode || !supabase) return;
    setUploadBusy(true);
    const warnings: string[] = [];
    try {
      const added: AviacaoAnexo[] = [];
      for (const file of Array.from(files)) {
        const id = crypto.randomUUID();
        const uploadedAt = new Date().toISOString();
        const tid = effectiveTenantId?.trim() || "shared";
        const path = `${tid}/registry/${uploadSessionId}/${id}-${file.name.replace(/[^\w.-]+/g, "_")}`;

        const { error: upErr } = await supabase.storage
          .from(AVIACAO_STORAGE_BUCKET)
          .upload(path, file, { upsert: false, contentType: file.type || undefined });

        if (!upErr) {
          const { data } = supabase.storage.from(AVIACAO_STORAGE_BUCKET).getPublicUrl(path);
          added.push({
            id,
            name: file.name,
            mime: file.type,
            uploadedAt,
            url: data.publicUrl,
          });
          continue;
        }

        if (file.size < 500_000 && file.type.startsWith("image/")) {
          const previewUrl = await readFileAsDataUrl(file);
          added.push({
            id,
            name: file.name,
            mime: file.type,
            uploadedAt,
            url: previewUrl,
          });
          warnings.push(
            `"${file.name}" ficou só como pré-visualização local. Rode docs/supabase-lite-rls-aviacao-anexos.sql no Supabase para habilitar o storage.`
          );
          continue;
        }

        warnings.push(
          isSupabaseStorageRlsError(upErr.message)
            ? `"${file.name}" não foi enviado (permissão do bucket ${AVIACAO_STORAGE_BUCKET}). Você ainda pode salvar o registro da aeronave sem este arquivo.`
            : `"${file.name}" não foi enviado: ${upErr.message}`
        );
      }

      if (added.length > 0) {
        setPendingAnexos((prev) => [...prev, ...added]);
      }
      setUploadWarning(warnings.length > 0 ? warnings.join(" ") : null);
    } finally {
      setUploadBusy(false);
    }
  }

  function handleTriagemChange(tabId: string) {
    setTriagemTabId(tabId);
    if (docasMode || aviacaoMode) return;
    const tab = queueTabs.find((t) => t.id === tabId);
    if (tab?.preset !== "hora") setHoraMarcada("");
  }

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
    if (aviacaoMode && aviacaoFields) {
      const requiredErr = validateAviacaoRequiredFormValues(
        formValues,
        {
          showHangar: aviacaoFields.showHangar,
          showServicos: aviacaoFields.showServicos,
        },
        tenantConfig.segmentoAplicado
      );
      if (requiredErr) {
        setError(requiredErr);
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
            const storedAnexos = pendingAnexos.filter(isAviacaoAnexoStoredInBucket);
            if (storedAnexos.length > 0) {
              aviacaoFields[AVIACAO_FIELD_ANEXOS] = JSON.stringify(storedAnexos);
            }
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
        docasMode ||
        (aviacaoMode && rf.showHoraMarcada) ||
        triagemTab?.preset === "hora" ||
        (!aviacaoMode && rf.showHoraMarcada);
      if (wantsHora && horaMarcada.trim()) {
        payload.hora_marcada = aviacaoMode
          ? datetimeLocalToIso(horaMarcada)
          : buildHoraMarcadaTodayIso(horaMarcada);
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

  const visibleFields = aviacaoMode
    ? true
    : rf.showClienteNome ||
      queueTabs.length > 0 ||
      enabledCategories.length > 0 ||
      rf.showHoraMarcada ||
      showDocasHoraAgendada ||
      law ||
      rf.showObservacao;

  function renderAviacaoRegistryForm() {
    if (!aviacaoFields) return null;
    return (
      <>
        {flowDestinationTabs.length > 0 ? (
          <label className={REGISTRY_LABEL_CLASS}>
            Coluna de destino
            <select
              value={triagemTabId}
              disabled={busy}
              onChange={(e) => setTriagemTabId(e.target.value)}
              className={REGISTRY_FIELD_CLASS}
            >
              {flowDestinationTabs.map((t) => (
                <option key={t.id} value={t.id}>
                  {resolveAviacaoKanbanColumnLabel(t, tenantConfig.segmentoAplicado)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className={REGISTRY_LABEL_CLASS}>
          {mroFieldLabels.prefixo}
          {REGISTRY_REQUIRED_MARK}
          <input
            type="text"
            value={formValues[AVIACAO_PREFIXO_CATEGORY_ID] ?? ""}
            disabled={busy}
            onChange={(e) => patchAviacaoField(AVIACAO_PREFIXO_CATEGORY_ID, e.target.value)}
            className={REGISTRY_FIELD_CLASS}
            autoComplete="off"
          />
        </label>

        {aviacaoFields.showModelo ? (
          <label className={REGISTRY_LABEL_CLASS}>
            {mroRegisterLabels.showModelo}
            <input
              type="text"
              value={formValues[AVIACAO_MODELO_CATEGORY_ID] ?? ""}
              disabled={busy}
              onChange={(e) => patchAviacaoField(AVIACAO_MODELO_CATEGORY_ID, e.target.value)}
              className={REGISTRY_FIELD_CLASS}
              autoComplete="off"
            />
          </label>
        ) : null}

        {aviacaoFields.showClienteNome ? (
          <label className={REGISTRY_LABEL_CLASS}>
            {mroRegisterLabels.showClienteNome}
            <input
              type="text"
              value={nomeCliente}
              disabled={busy}
              onChange={(e) => setNomeCliente(e.target.value)}
              className={REGISTRY_FIELD_CLASS}
              autoComplete="off"
            />
          </label>
        ) : null}

        {aviacaoFields.showProfissional ? (
          <label className={REGISTRY_LABEL_CLASS}>
            {mroFieldLabels.responsavel}
            <select
              value={tecnicoSelectId}
              disabled={busy}
              onChange={(e) => {
                const prof = profissionais.find((p) => p.id === e.target.value);
                patchAviacaoField(
                  AVIACAO_RESPONSAVEL_CATEGORY_ID,
                  prof ? formatProfissionalLabel(prof) : ""
                );
              }}
              className={REGISTRY_FIELD_CLASS}
            >
              <option value="">—</option>
              {profissionais.map((p) => (
                <option key={p.id} value={p.id}>
                  {formatProfissionalLabel(p)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {aviacaoFields.showUrgencia ? (
          <label className={REGISTRY_LABEL_CLASS}>
            {mroRegisterLabels.showUrgencia}
            <input
              type="text"
              value={formValues[AVIACAO_INLINE_OBSERVACAO_FIELD_ID] ?? ""}
              disabled={busy}
              onChange={(e) => patchAviacaoField(AVIACAO_INLINE_OBSERVACAO_FIELD_ID, e.target.value)}
              className={REGISTRY_FIELD_CLASS}
              autoComplete="off"
            />
          </label>
        ) : null}

        {aviacaoFields.showHangar ? (
          <label className={REGISTRY_LABEL_CLASS}>
            {mroFieldLabels.hangar}
            {REGISTRY_REQUIRED_MARK}
            <select
              value={formValues[AVIACAO_HANGAR_CATEGORY_ID] ?? ""}
              disabled={busy}
              onChange={(e) => patchAviacaoField(AVIACAO_HANGAR_CATEGORY_ID, e.target.value)}
              className={REGISTRY_FIELD_CLASS}
            >
              <option value="">—</option>
              {aviacaoHangarOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome ?? m.id}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {mroRegistryExtras.showHobbsCombustivel ? (
          <>
            <label className={REGISTRY_LABEL_CLASS}>
              {mroFieldLabels.hobbs}
              {REGISTRY_REQUIRED_MARK}
              <input
                type="text"
                inputMode="decimal"
                value={formValues[AVIACAO_FIELD_HOBBS] ?? ""}
                disabled={busy}
                onChange={(e) => patchAviacaoField(AVIACAO_FIELD_HOBBS, e.target.value)}
                className={REGISTRY_FIELD_CLASS}
              />
            </label>

            <label className={REGISTRY_LABEL_CLASS}>
              {mroFieldLabels.combustivel}
              {REGISTRY_REQUIRED_MARK}
              <select
                value={formValues[AVIACAO_FIELD_COMBUSTIVEL] ?? ""}
                disabled={busy}
                onChange={(e) => patchAviacaoField(AVIACAO_FIELD_COMBUSTIVEL, e.target.value)}
                className={REGISTRY_FIELD_CLASS}
              >
                <option value="">—</option>
                {mroCombustivelOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}

        {mroRegistryExtras.showServicosCheckboxes ? (
          <fieldset className={REGISTRY_LABEL_CLASS}>
            <legend className="mb-1">
              Serviços cadastrados
              {mroRegistryExtras.requireServicosCheckboxes ? REGISTRY_REQUIRED_MARK : null}
            </legend>
            <div className="flex flex-wrap gap-1.5 rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
              {aviacaoServicosOptions.length > 0 ? (
                aviacaoServicosOptions.map((svc) => {
                  const active = aviacaoServicosSelected.includes(svc.id);
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      disabled={busy}
                      onClick={() => toggleAviacaoServico(svc.id)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                        active
                          ? "border-orange-400 bg-orange-50 text-orange-900 dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-100"
                          : "border-zinc-300 bg-zinc-50 text-zinc-700 hover:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-300"
                      }`}
                    >
                      {svc.nome ?? svc.id}
                    </button>
                  );
                })
              ) : (
                <p className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400">
                  Cadastre serviços com o botão + Serviços na fila.
                </p>
              )}
            </div>
          </fieldset>
        ) : null}

        {aviacaoFields.showHoraMarcada ? (
          <label className={REGISTRY_LABEL_CLASS}>
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" strokeWidth={2} aria-hidden />
              {mroRegisterLabels.showHoraMarcada}
            </span>
            <input
              type="datetime-local"
              value={horaMarcada}
              disabled={busy}
              onChange={(e) => setHoraMarcada(e.target.value)}
              className={REGISTRY_FIELD_CLASS}
            />
            <span className="mt-0.5 block text-[10px] font-normal text-zinc-500 dark:text-zinc-400">
              Apenas anotação operacional — não reserva agenda.
            </span>
          </label>
        ) : null}

        <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">Anexos / Arquivos</p>
          <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
            Ordens de serviço, imagens de inspeção de recebimento ou laudos técnicos.
          </p>
          <div
            role="button"
            tabIndex={0}
            onDragOver={(e) => {
              e.preventDefault();
              if (!busy && !uploadBusy) setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (!busy && !uploadBusy) void handleAviacaoUpload(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
            }}
            className={`mt-2 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-3 py-4 text-center transition ${
              dragOver
                ? "border-sky-400 bg-sky-50 dark:border-sky-600 dark:bg-sky-950/30"
                : "border-zinc-300 bg-zinc-50/80 hover:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-900/40 dark:hover:border-zinc-500"
            } ${busy || uploadBusy ? "pointer-events-none opacity-50" : ""}`}
          >
            <Upload className="size-5 text-zinc-500 dark:text-zinc-400" strokeWidth={1.75} aria-hidden />
            <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-200">
              {uploadBusy ? "Enviando…" : "Arraste arquivos ou clique para selecionar"}
            </span>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Imagens e PDF — múltiplos arquivos</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,application/pdf"
            multiple
            disabled={busy || uploadBusy}
            onChange={(e) => {
              void handleAviacaoUpload(e.target.files);
              e.target.value = "";
            }}
            className="sr-only"
          />
          {pendingAnexos.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {pendingAnexos.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[11px] dark:border-zinc-700 dark:bg-zinc-900/60"
                >
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={a.name}
                    className="min-w-0 truncate text-blue-600 hover:underline dark:text-blue-400"
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
          {uploadWarning ? (
            <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              {uploadWarning}
            </p>
          ) : null}
        </div>

        {aviacaoFields.showObservacao ? (
          <label className={REGISTRY_LABEL_CLASS}>
            Observações
            <textarea
              value={observacaoBase}
              disabled={busy}
              onChange={(e) => setObservacaoBase(e.target.value)}
              rows={3}
              className={`${REGISTRY_FIELD_CLASS} resize-none`}
            />
          </label>
        ) : null}
      </>
    );
  }

  return (
    <Modal
      open={open}
      title="Novo registro"
      onClose={onClose}
      widthClassName={aviacaoMode ? "max-w-lg" : "max-w-md"}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {!visibleFields && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Nenhum campo visível nas configurações. Ative campos em Configurações → Geral.
          </p>
        )}

        {aviacaoMode ? (
          renderAviacaoRegistryForm()
        ) : (
          <>
            {queueTabs.length > 0 ? (
              <>
                <label className={REGISTRY_LABEL_CLASS}>
                  {triagemLabel}
                  <select
                    value={triagemTabId}
                    disabled={busy}
                    onChange={(e) => handleTriagemChange(e.target.value)}
                    className={REGISTRY_FIELD_CLASS}
                  >
                    {queueTabs.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                {showHoraHoje ? (
                  <label className={REGISTRY_LABEL_CLASS}>
                    Horário marcado (hoje)
                    <input
                      type="time"
                      value={horaMarcada}
                      onChange={(e) => setHoraMarcada(e.target.value)}
                      className={REGISTRY_FIELD_CLASS}
                    />
                  </label>
                ) : null}
              </>
            ) : null}

            {rf.showClienteNome ? (
              <label className={REGISTRY_LABEL_CLASS}>
                Nome do cliente
                <input
                  value={nomeCliente}
                  onChange={(e) => setNomeCliente(e.target.value)}
                  className={REGISTRY_FIELD_CLASS}
                />
              </label>
            ) : null}

            {enabledCategories.map((cat) => renderCategoryField(cat))}

            {showDocasHoraAgendada ? (
              <label className={REGISTRY_LABEL_CLASS}>
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" strokeWidth={2} aria-hidden />
                  Horário agendado
                </span>
                <input
                  type="time"
                  value={horaMarcada}
                  onChange={(e) => setHoraMarcada(e.target.value)}
                  className={REGISTRY_FIELD_CLASS}
                />
              </label>
            ) : null}

            {law ? (
              <PriorityClassSelector value={classificacao} onChange={setClassificacao} disabled={busy} />
            ) : null}

            {rf.showObservacao ? (
              <label className={REGISTRY_LABEL_CLASS}>
                Observações
                <textarea
                  value={observacaoBase}
                  onChange={(e) => setObservacaoBase(e.target.value)}
                  rows={3}
                  className={`${REGISTRY_FIELD_CLASS} resize-none`}
                />
              </label>
            ) : null}
          </>
        )}

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
