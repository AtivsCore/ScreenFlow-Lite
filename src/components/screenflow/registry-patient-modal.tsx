"use client";

import { resolveDefaultTenantId } from "@/lib/tenant-id";
import { fetchServicos } from "@/lib/fetch-servicos";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResolvedTenantConfig } from "@/lib/tenant-config";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";

type ProfRow = { id: string; nome: string | null };
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

  const effectiveTenantId = useMemo(
    () => tenantId?.trim() || resolveDefaultTenantId(),
    [tenantId]
  );

  const [nomeCliente, setNomeCliente] = useState("");
  const [profissionalId, setProfissionalId] = useState<string>("");
  const [profissionalLivre, setProfissionalLivre] = useState("");
  const [servicoId, setServicoId] = useState<string>("");
  const [servicoLivre, setServicoLivre] = useState("");
  const [localId, setLocalId] = useState<string>("");
  const [localLivre, setLocalLivre] = useState("");
  const [horaMarcada, setHoraMarcada] = useState("");
  const [prioridade, setPrioridade] = useState(false);
  const [observacaoBase, setObservacaoBase] = useState("");

  const [profissionais, setProfissionais] = useState<ProfRow[]>([]);
  const [servicos, setServicos] = useState<OptRow[]>([]);
  const [locais, setLocais] = useState<OptRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !supabase) return;
    let cancelled = false;
    void (async () => {
      const [p, sResult, l] = await Promise.all([
        supabase.from("profissionais").select("id,nome").eq("tenant_id", effectiveTenantId).order("nome"),
        fetchServicos(supabase, effectiveTenantId),
        supabase.from("locais").select("id,nome").eq("tenant_id", effectiveTenantId).order("nome"),
      ]);
      if (cancelled) return;
      setProfissionais((p.data as ProfRow[] | null) ?? []);
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
    setProfissionalId("");
    setProfissionalLivre("");
    setServicoId("");
    setServicoLivre("");
    setLocalId("");
    setLocalLivre("");
    setHoraMarcada("");
    setPrioridade(false);
    setObservacaoBase("");
    setError(null);
  }, [open, tenantConfig.priorityLawEnabled]);

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
    if (rf.profissionalPreferFreeText && profissionalLivre.trim()) {
      observacao = appendObsLine(observacao, "Profissional", profissionalLivre);
    }
    if (rf.servicoPreferFreeText && servicoLivre.trim()) {
      observacao = appendObsLine(observacao, "Serviço", servicoLivre);
    }
    if (rf.localPreferFreeText && localLivre.trim()) {
      observacao = appendObsLine(observacao, "Local", localLivre);
    }

    const payload: Record<string, unknown> = {
      paciente_id: pacienteId,
      tenant_id: effectiveTenantId,
      prioridade: law ? prioridade : false,
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

    if (rf.showHoraMarcada && horaMarcada.trim()) {
      const d = new Date(horaMarcada);
      payload.hora_marcada = Number.isNaN(d.getTime()) ? horaMarcada.trim() : d.toISOString();
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
    rf.showProfissional ||
    rf.profissionalPreferFreeText ||
    rf.showServico ||
    rf.servicoPreferFreeText ||
    rf.showLocal ||
    rf.localPreferFreeText ||
    rf.showHoraMarcada ||
    (law && rf.showObservacao !== false) ||
    rf.showObservacao;

  return (
    <Modal open={open} title="Novo registro" onClose={onClose} widthClassName="max-w-md">
      <form onSubmit={handleSubmit} className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1">
        {!visibleFields && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Nenhum campo visível nas configurações. Ative campos em Configurações → Geral.
          </p>
        )}

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
                  {m.nome ?? m.id}
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

        {rf.showHoraMarcada ? (
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
          <label className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={prioridade}
              onChange={(e) => setPrioridade(e.target.checked)}
              className="rounded border-zinc-400"
            />
            Prioridade (lei de prioridade)
          </label>
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
