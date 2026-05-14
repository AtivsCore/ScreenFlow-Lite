"use client";

import type { AtendimentoLite } from "@/lib/atendimentos-lite";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";

type Opt = { id: string; nome: string | null };

type EditAtendimentoModalProps = {
  open: boolean;
  row: AtendimentoLite | null;
  onClose: () => void;
  supabase: SupabaseClient | null;
  onSaved: () => void;
};

type FormProps = {
  row: AtendimentoLite;
  onClose: () => void;
  supabase: SupabaseClient;
  onSaved: () => void;
};

function EditAtendimentoForm({ row, onClose, supabase, onSaved }: FormProps) {
  const [nome, setNome] = useState(row.nome ?? "");
  const [profissionalId, setProfissionalId] = useState(row.profissional_id ?? "");
  const [prioridade, setPrioridade] = useState(row.prioridade === true);
  const [observacao, setObservacao] = useState(row.observacao ?? "");
  const [medicos, setMedicos] = useState<Opt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.from("profissionais").select("id,nome").order("nome");
      if (cancelled) return;
      setMedicos((data as Opt[] | null) ?? []);
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
      const { error: pe } = await supabase.from("pacientes").update({ nome: nome.trim() }).eq("id", row.paciente_id);
      if (pe) {
        setError(pe.message);
        setBusy(false);
        return;
      }
    }

    const { error: ae } = await supabase
      .from("atendimentos_lite")
      .update({
        profissional_id: profissionalId || null,
        prioridade,
        observacao: observacao.trim() || null,
      })
      .eq("id", row.id);

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
        Nome do paciente
        <input
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
          disabled={!row.paciente_id}
        />
      </label>

      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Médico
        <select
          value={profissionalId}
          onChange={(e) => setProfissionalId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
        >
          <option value="">—</option>
          {medicos.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome ?? m.id}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        <input
          type="checkbox"
          checked={prioridade}
          onChange={(e) => setPrioridade(e.target.checked)}
          className="rounded border-zinc-400"
        />
        Prioritário
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

export function EditAtendimentoModal({ open, row, onClose, supabase, onSaved }: EditAtendimentoModalProps) {
  return (
    <Modal open={open} title="Editar atendimento" onClose={onClose} widthClassName="max-w-md">
      {open && row && supabase ? (
        <EditAtendimentoForm key={row.id} row={row} supabase={supabase} onClose={onClose} onSaved={onSaved} />
      ) : open ? (
        <p className="text-xs text-zinc-500">
          {!row ? "Nenhum registro selecionado." : "Supabase indisponível no navegador."}
        </p>
      ) : null}
    </Modal>
  );
}
