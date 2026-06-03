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
import type { ResolvedTenantConfig } from "@/lib/tenant-config";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import {
  DOCAS_QUEUE_TAB,
  isDocasRequiredCategory,
  isDocasSegment,
  DOCAS_REQUIRED_CATEGORY_IDS,
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
  const queueTabs = tenantConfig.queueTabs;
  const enabledCategories = useMemo(
    () => tenantConfig.cadastroCategories.filter((c) => c.enabled),
    [tenantConfig.cadastroCategories]
  );

  function renderCategoryField(cat: (typeof enabledCategories)[number]) {
    const options =
      cat.tableKey === "profissionais"
        ? profissionais.map((m) => ({ id: m.id, label: formatProfissionalLabel(m) }))
        : cat.tableKey === "locais"
          ? locais.map((m) => ({ id: m.id, label: m.nome ?? m.id }))
          : servicos.map((m) => ({ id: m.id, label: m.nome ?? m.id }));

    return (
      <label key={cat.id} className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {cat.label}
        {docasMode && isDocasRequiredCategory(cat.id) ? (
          <span className="text-red-600 dark:text-red-400"> *</span>
        ) : null}
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

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessionTenantId, setSessionTenantId] = useState<string | null>(null);

  const effectiveTenantId = useMemo(
    () => sessionTenantId ?? (tenantId?.trim() || resolveDefaultTenantId()),
    [sessionTenantId, tenantId]
  );

  const docasMode = isDocasSegment(tenantConfig.segmentoAplicado);

  const initialTriagemTabId = useMemo(() => {
    if (docasMode) {
      return queueTabs.find((t) => t.id === DOCAS_QUEUE_TAB.NO_PATIO)?.id ?? queueTabs[0]?.id ?? "";
    }
    return queueTabs[0]?.id ?? "";
  }, [docasMode, queueTabs]);

  const [nomeCliente, setNomeCliente] = useState("");
  const [triagemTabId, setTriagemTabId] = useState(initialTriagemTabId);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [horaMarcada, setHoraMarcada] = useState("");
  const [classificacao, setClassificacao] = useState<ClassificacaoPrioridade>("normal");
  const [observacaoBase, setObservacaoBase] = useState("");

  const [profissionais, setProfissionais] = useState<ProfissionalRow[]>([]);
  const [servicos, setServicos] = useState<OptRow[]>([]);
  const [locais, setLocais] = useState<OptRow[]>([]);

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
    let cancelled = false;
    void (async () => {
      const [p, sResult, l] = await Promise.all([
        supabase
          .from("profissionais")
          .select("id,nome,especialidade")
          .eq("tenant_id", effectiveTenantId)
          .order("nome"),
        fetchServicos(supabase, effectiveTenantId),
        supabase.from("locais").select("id,nome").eq("tenant_id", effectiveTenantId).order("nome"),
      ]);
      if (cancelled) return;
      setProfissionais((p.data as ProfissionalRow[] | null) ?? []);
      setServicos(sResult.data);
      setLocais((l.data as OptRow[] | null) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, supabase, effectiveTenantId]);

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
    const tab = queueTabs.find((t) => t.id === tabId);
    if (tab?.preset !== "hora") setHoraMarcada("");
  }

  const showHoraHoje = triagemTab?.preset === "hora";

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
        setError("Transportadora/Placa e Motorista/Telefone são obrigatórios.");
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

      const cadastroPayload = buildCadastroPayload(formValues, tenantConfig.cadastroCategories);

      const payload: Record<string, unknown> = {
        paciente_id: pacienteIdValue,
        tenant_id: effectiveTenantId,
        prioridade: law ? prioridadeBooleanFromClassificacao(classificacao) : false,
        classificacao_prioridade: law ? classificacao : "normal",
        observacao: embedFilaPreset(userObs || null, filaPreset, triagemTab?.id),
        status: defaultStatus,
        ...cadastroPayload,
      };

      const wantsHora = triagemTab?.preset === "hora" || rf.showHoraMarcada;
      if (wantsHora && horaMarcada.trim()) {
        payload.hora_marcada = buildHoraMarcadaTodayIso(horaMarcada);
      } else if (triagemTab?.preset === "encaixe") {
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
              {triagemLabel}
              <select
                value={triagemTabId}
                onChange={(e) => handleTriagemChange(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
              >
                {queueTabs.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
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
            Nome do cliente
            <input
              value={nomeCliente}
              onChange={(e) => setNomeCliente(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </label>
        ) : null}

        {enabledCategories.map((cat) => renderCategoryField(cat))}

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
