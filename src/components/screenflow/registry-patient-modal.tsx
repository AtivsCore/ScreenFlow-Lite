"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";

type ProfRow = { id: string; nome: string | null };

type RegistryPatientModalProps = {
  open: boolean;
  onClose: () => void;
  supabase: SupabaseClient | null;
  tenantId: string | null;
  defaultStatus?: string;
  onRegistered?: () => void;
};

export function RegistryPatientModal({
  open,
  onClose,
  supabase,
  tenantId,
  defaultStatus = "Aguardando",
  onRegistered,
}: RegistryPatientModalProps) {
  const [nomePaciente, setNomePaciente] = useState("");
  const [profissionalId, setProfissionalId] = useState<string>("");
  const [prioridade, setPrioridade] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [medicos, setMedicos] = useState<ProfRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !supabase) return;
    let cancelled = false;
    void (async () => {
      const { data, error: err } = await supabase.from("profissionais").select("id,nome").order("nome");
      if (cancelled) return;
      if (err) setMedicos([]);
      else setMedicos((data as ProfRow[] | null) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nome = nomePaciente.trim();
    if (!nome || !supabase) return;
    setBusy(true);
    setError(null);

    const { data: pRow, error: pErr } = await supabase.from("pacientes").insert({ nome }).select("id").single();
    if (pErr || !pRow) {
      setError(pErr?.message ?? "Falha ao criar paciente.");
      setBusy(false);
      return;
    }

    const pacienteId = (pRow as { id: string }).id;

    const payload: Record<string, unknown> = {
      paciente_id: pacienteId,
      prioridade,
      observacao: observacao.trim() || null,
      status: defaultStatus,
    };

    if (tenantId) payload.tenant_id = tenantId;
    if (profissionalId) payload.profissional_id = profissionalId;

    const { error: aErr } = await supabase.from("atendimentos_lite").insert(payload);
    if (aErr) {
      setError(aErr.message);
      setBusy(false);
      return;
    }

    setNomePaciente("");
    setProfissionalId("");
    setPrioridade(false);
    setObservacao("");
    onRegistered?.();
    onClose();
    setBusy(false);
  }

  return (
    <Modal open={open} title="Registrar paciente" onClose={onClose} widthClassName="max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Nome do paciente
          <input
            required
            value={nomePaciente}
            onChange={(e) => setNomePaciente(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </label>

        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Médico solicitado
          <select
            value={profissionalId}
            onChange={(e) => setProfissionalId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
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
          Lei de prioridade (prioritário)
        </label>

        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Observação
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={3}
            className="mt-1 w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </label>

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
          {busy ? "Salvando…" : "Salvar na fila"}
        </button>
      </form>
    </Modal>
  );
}
