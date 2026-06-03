"use client";

import { buildCadastroPayload } from "@/lib/cadastro-valores";
import { embedFilaPreset } from "@/lib/fila-preset";
import { datetimeLocalToIso, isFutureHoraMarcada, minFutureDatetimeLocal } from "@/lib/hora-marcada";
import { formatProfissionalLabel, type ProfissionalRow } from "@/lib/profissionais-display";
import { fetchSessionTenantId } from "@/lib/session-tenant";
import { fetchServicos } from "@/lib/fetch-servicos";
import { resolveDefaultTenantId } from "@/lib/tenant-id";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResolvedTenantConfig } from "@/lib/tenant-config";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";

type OptRow = { id: string; nome: string | null };

type AgendaBookingModalProps = {
  open: boolean;
  onClose: () => void;
  supabase: SupabaseClient | null;
  tenantId: string | null;
  tenantConfig: ResolvedTenantConfig;
  onBooked: () => void;
};

export function AgendaBookingModal({
  open,
  onClose,
  supabase,
  tenantId,
  tenantConfig,
  onBooked,
}: AgendaBookingModalProps) {
  const enabledCategories = useMemo(
    () => tenantConfig.cadastroCategories.filter((c) => c.enabled),
    [tenantConfig.cadastroCategories]
  );
  const [nomeCliente, setNomeCliente] = useState("");
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [horaMarcada, setHoraMarcada] = useState("");
  const [observacao, setObservacao] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessionTenantId, setSessionTenantId] = useState<string | null>(null);
  const [profissionais, setProfissionais] = useState<ProfissionalRow[]>([]);
  const [servicos, setServicos] = useState<OptRow[]>([]);
  const [locais, setLocais] = useState<OptRow[]>([]);

  const effectiveTenantId = sessionTenantId ?? tenantId?.trim() ?? resolveDefaultTenantId();

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
      const [p, s, l] = await Promise.all([
        supabase.from("profissionais").select("id,nome,especialidade").eq("tenant_id", effectiveTenantId).order("nome"),
        fetchServicos(supabase, effectiveTenantId),
        supabase.from("locais").select("id,nome").eq("tenant_id", effectiveTenantId).order("nome"),
      ]);
      if (cancelled) return;
      setProfissionais((p.data as ProfissionalRow[] | null) ?? []);
      setServicos(s.data);
      setLocais((l.data as OptRow[] | null) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, supabase, effectiveTenantId]);

  useEffect(() => {
    if (!open) return;
    setNomeCliente("");
    setFormValues({});
    setHoraMarcada("");
    setObservacao("");
    setError(null);
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (!horaMarcada.trim()) {
      setError("Informe data e hora do agendamento futuro.");
      return;
    }
    const iso = datetimeLocalToIso(horaMarcada);
    if (!iso || !isFutureHoraMarcada(iso)) {
      setError("Escolha uma data e hora posteriores a hoje.");
      return;
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
        setError(pErr?.message ?? "Falha ao criar cliente.");
        setBusy(false);
        return;
      }
      pacienteId = (pRow as { id: string }).id;
    }

    const payload: Record<string, unknown> = {
      paciente_id: pacienteId,
      tenant_id: effectiveTenantId,
      prioridade: false,
      classificacao_prioridade: "normal",
      observacao: embedFilaPreset(observacao.trim() || null, "hora"),
      status: "Aguardando",
      hora_marcada: iso,
      ...buildCadastroPayload(formValues, tenantConfig.cadastroCategories),
    };

    const { error: aErr } = await supabase.from("atendimentos_lite").insert(payload);
    if (aErr) {
      setError(aErr.message);
      setBusy(false);
      return;
    }

    onBooked();
    onClose();
    setBusy(false);
  }

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
        <select
          value={formValues[cat.id] ?? ""}
          onChange={(e) => setFormValues((prev) => ({ ...prev, [cat.id]: e.target.value }))}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
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

  return (
    <Modal open={open} title="Novo agendamento futuro" onClose={onClose} widthClassName="max-w-md">
      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Nome do cliente
          <input
            value={nomeCliente}
            onChange={(e) => setNomeCliente(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </label>

        {enabledCategories.map((cat) => renderCategoryField(cat))}

        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Data e hora do agendamento
          <input
            type="datetime-local"
            required
            min={minFutureDatetimeLocal()}
            value={horaMarcada}
            onChange={(e) => setHoraMarcada(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </label>

        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Observações
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={2}
            className="mt-1 w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </label>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy || !supabase}
          className="rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {busy ? "Salvando…" : "Agendar"}
        </button>
      </form>
    </Modal>
  );
}
