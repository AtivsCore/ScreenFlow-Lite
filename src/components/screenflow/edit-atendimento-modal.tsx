"use client";

import type { AtendimentoLite } from "@/lib/atendimentos-lite";
import { SERVICES_TABLE } from "@/lib/db-tables";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";

type Opt = { id: string; nome: string | null };

type EditAtendimentoModalProps = {
  open: boolean;
  row: AtendimentoLite | null;
  onClose: () => void;
  supabase: SupabaseClient | null;
  priorityLawEnabled: boolean;
  onSaved: () => void;
};

type FormProps = {
  row: AtendimentoLite;
  onClose: () => void;
  supabase: SupabaseClient;
  priorityLawEnabled: boolean;
  onSaved: () => void;
};

function EditAtendimentoForm({ row, onClose, supabase, priorityLawEnabled, onSaved }: FormProps) {
  const [nome, setNome] = useState(row.nome ?? "");
  const [profissionalId, setProfissionalId] = useState(row.profissional_id ?? "");
  const [localId, setLocalId] = useState(row.local_id ?? "");
  const [servicoId, setServicoId] = useState(row.especialidade_id ?? "");
  const [prioridade, setPrioridade] = useState(row.prioridade === true);
  const [observacao, setObservacao] = useState(row.observacao ?? "");
  const [excluirFechamento, setExcluirFechamento] = useState(row.excluir_do_fechamento === true);
  const [profissionais, setProfissionais] = useState<Opt[]>([]);
  const [locais, setLocais] = useState<Opt[]>([]);
  const [servicos, setServicos] = useState<Opt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [p, l, s] = await Promise.all([
        supabase.from("profissionais").select("id,nome").order("nome"),
        supabase.from("locais").select("id,nome").order("nome"),
        supabase.from(SERVICES_TABLE).select("id,nome").order("nome"),
      ]);
      if (cancelled) return;
      setProfissionais((p.data as Opt[] | null) ?? []);
      setLocais((l.data as Opt[] | null) ?? []);
      setServicos((s.data as Opt[] | null) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

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
      observacao: observacao.trim() || null,
      excluir_do_fechamento: excluirFechamento,
    };
    if (priorityLawEnabled) {
      patch.prioridade = prioridade;
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
              {m.nome ?? m.id}
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

      <label className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        <input
          type="checkbox"
          checked={excluirFechamento}
          onChange={(e) => setExcluirFechamento(e.target.checked)}
          className="rounded border-zinc-400"
        />
        Excluir do fechamento diário (não enviar à planilha)
      </label>

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
