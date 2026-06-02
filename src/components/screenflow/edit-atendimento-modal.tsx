"use client";

import type { AtendimentoLite } from "@/lib/atendimentos-lite";
import {
  prioridadeBooleanFromClassificacao,
  resolveClassificacaoPrioridade,
  type ClassificacaoPrioridade,
} from "@/lib/classificacao-prioridade";
import { formatObservacaoForDisplay, embedObservacaoForQueueTab, resolveRowQueueTabId } from "@/lib/fila-preset";
import { formatProfissionalLabel, type ProfissionalRow } from "@/lib/profissionais-display";
import { fetchServicos } from "@/lib/fetch-servicos";
import type { QueueTabEntry } from "@/lib/tenant-config";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { PriorityClassSelector } from "@/components/screenflow/priority-class-selector";

type Opt = { id: string; nome: string | null };

type EditAtendimentoModalProps = {
  open: boolean;
  row: AtendimentoLite | null;
  onClose: () => void;
  supabase: SupabaseClient | null;
  priorityLawEnabled: boolean;
  queueTabs: QueueTabEntry[];
  onSaved: () => void;
};

type FormProps = {
  row: AtendimentoLite;
  onClose: () => void;
  supabase: SupabaseClient;
  priorityLawEnabled: boolean;
  queueTabs: QueueTabEntry[];
  onSaved: () => void;
};

function EditAtendimentoForm({ row, onClose, supabase, priorityLawEnabled, queueTabs, onSaved }: FormProps) {
  const initialTriagemTabId = resolveRowQueueTabId(row, queueTabs) || queueTabs[0]?.id || "";
  const [triagemTabId, setTriagemTabId] = useState(initialTriagemTabId);
  const [nome, setNome] = useState(row.nome ?? "");
  const [profissionalId, setProfissionalId] = useState(row.profissional_id ?? "");
  const [localId, setLocalId] = useState(row.local_id ?? "");
  const [servicoId, setServicoId] = useState(row.especialidade_id ?? "");
  const [classificacao, setClassificacao] = useState<ClassificacaoPrioridade>(() =>
    resolveClassificacaoPrioridade(row.classificacao_prioridade, row.prioridade)
  );
  const [observacao, setObservacao] = useState(() => formatObservacaoForDisplay(row.observacao));
  const [profissionais, setProfissionais] = useState<ProfissionalRow[]>([]);
  const [locais, setLocais] = useState<Opt[]>([]);
  const [servicos, setServicos] = useState<Opt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const triagemTab = useMemo(
    () => queueTabs.find((t) => t.id === triagemTabId) ?? queueTabs[0],
    [queueTabs, triagemTabId]
  );
  const triagemLabel = triagemTab?.label ?? "Entrada na fila";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const tid = row.tenant_id?.trim();
      const profQuery = tid
        ? supabase.from("profissionais").select("id,nome,especialidade").eq("tenant_id", tid).order("nome")
        : supabase.from("profissionais").select("id,nome,especialidade").order("nome");
      const locQuery = tid
        ? supabase.from("locais").select("id,nome").eq("tenant_id", tid).order("nome")
        : supabase.from("locais").select("id,nome").order("nome");
      const [p, l, sResult] = await Promise.all([
        profQuery,
        locQuery,
        fetchServicos(supabase, row.tenant_id),
      ]);
      if (cancelled) return;
      setProfissionais((p.data as ProfissionalRow[] | null) ?? []);
      setLocais((l.data as Opt[] | null) ?? []);
      setServicos(sResult.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, row.tenant_id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    if (row.paciente_id) {
      const { error: pe } = await supabase.from("pacientes").update({ nome: nome.trim() || "" }).eq("id", row.paciente_id);
      if (pe) {
        setError(pe.message);
        setBusy(false);
        return;
      }
    }

    const patch: Record<string, unknown> = {
      profissional_id: profissionalId || null,
      local_id: localId || null,
      especialidade_id: servicoId || null,
      observacao: embedObservacaoForQueueTab(observacao.trim() || null, triagemTab),
    };
    if (priorityLawEnabled) {
      patch.prioridade = prioridadeBooleanFromClassificacao(classificacao);
      patch.classificacao_prioridade = classificacao;
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {queueTabs.length > 0 ? (
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          {triagemLabel}
          <select
            value={triagemTabId}
            onChange={(e) => setTriagemTabId(e.target.value)}
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

      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Nome do cliente
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
          disabled={!row.paciente_id}
        />
      </label>

      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Profissional
        <select
          value={profissionalId}
          onChange={(e) => setProfissionalId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
        >
          <option value="">—</option>
          {profissionais.map((m) => (
            <option key={m.id} value={m.id}>
              {formatProfissionalLabel(m)}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Local / ponto de atendimento
        <select
          value={localId}
          onChange={(e) => setLocalId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
        >
          <option value="">—</option>
          {locais.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome ?? m.id}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Serviço
        <select
          value={servicoId}
          onChange={(e) => setServicoId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
        >
          <option value="">—</option>
          {servicos.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome ?? m.id}
            </option>
          ))}
        </select>
      </label>

      {priorityLawEnabled ? (
        <PriorityClassSelector value={classificacao} onChange={setClassificacao} disabled={busy} />
      ) : null}

      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Observação
        <textarea
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          rows={3}
          className="mt-1 w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
        />
      </label>

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
  priorityLawEnabled,
  queueTabs,
  onSaved,
}: EditAtendimentoModalProps) {
  return (
    <Modal open={open} title="Editar registro" onClose={onClose} widthClassName="max-w-md">
      {open && row && supabase ? (
        <EditAtendimentoForm
          key={row.id}
          row={row}
          supabase={supabase}
          priorityLawEnabled={priorityLawEnabled}
          queueTabs={queueTabs}
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
