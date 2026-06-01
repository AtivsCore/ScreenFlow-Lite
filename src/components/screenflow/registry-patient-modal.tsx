"use client";

import {
  prioridadeBooleanFromClassificacao,
  type ClassificacaoPrioridade,
} from "@/lib/classificacao-prioridade";
import { formatProfissionalLabel, type ProfissionalRow } from "@/lib/profissionais-display";
import { resolveDefaultTenantId } from "@/lib/tenant-id";
import { fetchServicos } from "@/lib/fetch-servicos";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { QueueTabEntry, ResolvedTenantConfig } from "@/lib/tenant-config";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { PriorityClassSelector } from "@/components/screenflow/priority-class-selector";

type OptRow = { id: string; nome: string | null };

type RegistryPatientModalProps = {
  open: boolean;
  onClose: () => void;
  supabase: SupabaseClient | null;
  tenantId: string | null;
  tenantConfig: ResolvedTenantConfig;
  defaultStatus?: string;
  onRegistered?: () => void;
};

function appendObsLine(obs: string, label: string, value: string): string {
  const v = value.trim();
  if (!v) return obs.trim();
  const line = `${label}: ${v}`;
  const base = obs.trim();
  return base ? `${base}\n${line}` : line;
}

function applyTriagemPreset(
  tab: QueueTabEntry | undefined,
  classificacao: ClassificacaoPrioridade,
  setClassificacao: (c: ClassificacaoPrioridade) => void
): ClassificacaoPrioridade {
  if (!tab) return classificacao;
  switch (tab.preset) {
    case "prioridade":
      setClassificacao("prioritario");
      return "prioritario";
    case "urgente":
      setClassificacao("emergencia");
      return "emergencia";
    default:
      return classificacao;
  }
}

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

  const effectiveTenantId = useMemo(
    () => tenantId?.trim() || resolveDefaultTenantId(),
    [tenantId]
  );

  const defaultTriagemId = queueTabs[0]?.id ?? "";

  const [nomeCliente, setNomeCliente] = useState("");
  const [triagemTabId, setTriagemTabId] = useState(defaultTriagemId);
  const [profissionalId, setProfissionalId] = useState<string>("");
  const [profissionalLivre, setProfissionalLivre] = useState("");
  const [servicoId, setServicoId] = useState<string>("");
  const [servicoLivre, setServicoLivre] = useState("");
  const [localId, setLocalId] = useState<string>("");
  const [localLivre, setLocalLivre] = useState("");
  const [horaMarcada, setHoraMarcada] = useState("");
  const [classificacao, setClassificacao] = useState<ClassificacaoPrioridade>("normal");
  const [observacaoBase, setObservacaoBase] = useState("");

  const [profissionais, setProfissionais] = useState<ProfissionalRow[]>([]);
  const [servicos, setServicos] = useState<OptRow[]>([]);
  const [locais, setLocais] = useState<OptRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const triagemTab = useMemo(
    () => queueTabs.find((t) => t.id === triagemTabId) ?? queueTabs[0],
    [queueTabs, triagemTabId]
  );

  const triagemLabel = triagemTab?.label ?? "Entrada na fila";

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
    setTriagemTabId(queueTabs[0]?.id ?? "");
    setProfissionalId("");
    setProfissionalLivre("");
    setServicoId("");
    setServicoLivre("");
    setLocalId("");
    setLocalLivre("");
    setHoraMarcada("");
    setClassificacao("normal");
    setObservacaoBase("");
    setError(null);
  }, [open, tenantConfig.priorityLawEnabled, queueTabs]);

  function handleTriagemChange(tabId: string) {
    setTriagemTabId(tabId);
    const tab = queueTabs.find((t) => t.id === tabId);
    if (law && tab) {
      applyTriagemPreset(tab, classificacao, setClassificacao);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
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
        setError(pErr?.message ?? "Falha ao criar cliente.");
        setBusy(false);
        return;
      }
      pacienteId = (pRow as { id: string }).id;
    }

    let observacao = observacaoBase.trim();
    if (triagemTab) {
      observacao = appendObsLine(observacao, triagemLabel, triagemTab.label);
    }
    if (rf.profissionalPreferFreeText && profissionalLivre.trim()) {
      observacao = appendObsLine(observacao, "Profissional", profissionalLivre);
    }
    if (rf.servicoPreferFreeText && servicoLivre.trim()) {
      observacao = appendObsLine(observacao, "Serviço", servicoLivre);
    }
    if (rf.localPreferFreeText && localLivre.trim()) {
      observacao = appendObsLine(observacao, "Local", localLivre);
    }

    let finalClassificacao: ClassificacaoPrioridade = classificacao;
    if (law && triagemTab) {
      if (triagemTab.preset === "prioridade") finalClassificacao = "prioritario";
      else if (triagemTab.preset === "urgente") finalClassificacao = "emergencia";
    }

    const payload: Record<string, unknown> = {
      paciente_id: pacienteId,
      tenant_id: effectiveTenantId,
      prioridade: law ? prioridadeBooleanFromClassificacao(finalClassificacao) : false,
      classificacao_prioridade: law ? finalClassificacao : "normal",
      observacao: observacao.trim() || null,
      status: defaultStatus,
    };

    if (rf.showProfissional && profissionalId && !(rf.profissionalPreferFreeText && profissionalLivre.trim())) {
      payload.profissional_id = profissionalId;
    }

    if (rf.showServico && servicoId && !(rf.servicoPreferFreeText && servicoLivre.trim())) {
      payload.especialidade_id = servicoId;
    }

    if (rf.showLocal && localId && !(rf.localPreferFreeText && localLivre.trim())) {
      payload.local_id = localId;
    }

    const wantsHora = triagemTab?.preset === "hora" || rf.showHoraMarcada;
    if (wantsHora && horaMarcada.trim()) {
      const d = new Date(horaMarcada);
      payload.hora_marcada = Number.isNaN(d.getTime()) ? horaMarcada.trim() : d.toISOString();
    } else if (triagemTab?.preset === "encaixe") {
      payload.hora_marcada = null;
    }

    const { error: aErr } = await supabase.from("atendimentos_lite").insert(payload);
    if (aErr) {
      setError(aErr.message);
      setBusy(false);
      return;
    }

    onRegistered?.();
    onClose();
    setBusy(false);
  }

  const visibleFields =
    rf.showClienteNome ||
    queueTabs.length > 0 ||
    rf.showProfissional ||
    rf.profissionalPreferFreeText ||
    rf.showServico ||
    rf.servicoPreferFreeText ||
    rf.showLocal ||
    rf.localPreferFreeText ||
    rf.showHoraMarcada ||
    law ||
    rf.showObservacao;

  return (
    <Modal open={open} title="Novo registro" onClose={onClose} widthClassName="max-w-md">
      <form onSubmit={handleSubmit} className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1">
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
              {queueTabs.map((t) => (
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
            />
          </label>
        ) : null}

        {rf.showProfissional ? (
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Profissional
            <select
              value={profissionalId}
              onChange={(e) => setProfissionalId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            >
              <option value="">—</option>
              {profissionais.map((m) => (
                <option key={m.id} value={m.id}>
                  {formatProfissionalLabel(m)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {rf.profissionalPreferFreeText ? (
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Profissional (texto livre)
            <input
              value={profissionalLivre}
              onChange={(e) => setProfissionalLivre(e.target.value)}
              placeholder="Nome manual"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </label>
        ) : null}

        {rf.showServico ? (
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Serviço
            <select
              value={servicoId}
              onChange={(e) => setServicoId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            >
              <option value="">—</option>
              {servicos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome ?? m.id}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {rf.servicoPreferFreeText ? (
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Serviço (texto livre)
            <input
              value={servicoLivre}
              onChange={(e) => setServicoLivre(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </label>
        ) : null}

        {rf.showLocal ? (
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Local / ponto de atendimento
            <select
              value={localId}
              onChange={(e) => setLocalId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            >
              <option value="">—</option>
              {locais.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome ?? m.id}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {rf.localPreferFreeText ? (
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Local (texto livre)
            <input
              value={localLivre}
              onChange={(e) => setLocalLivre(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </label>
        ) : null}

        {(rf.showHoraMarcada || triagemTab?.preset === "hora") ? (
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Horário marcado
            <input
              type="datetime-local"
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
