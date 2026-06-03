"use client";

import type { AtendimentoLite } from "@/lib/atendimentos-lite";
import {
  prioridadeBooleanFromClassificacao,
  resolveClassificacaoPrioridade,
  type ClassificacaoPrioridade,
} from "@/lib/classificacao-prioridade";
import { buildCadastroPayload, hydrateCadastroValores } from "@/lib/cadastro-valores";
import { formatObservacaoForDisplay, embedObservacaoForQueueTab, resolveRowQueueTabId } from "@/lib/fila-preset";
import { formatProfissionalLabel, type ProfissionalRow } from "@/lib/profissionais-display";
import { fetchServicos } from "@/lib/fetch-servicos";
import type { ResolvedTenantConfig } from "@/lib/tenant-config";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { PriorityClassSelector } from "@/components/screenflow/priority-class-selector";

type OptRow = { id: string; nome: string | null };

type EditAtendimentoModalProps = {
  open: boolean;
  row: AtendimentoLite | null;
  onClose: () => void;
  supabase: SupabaseClient | null;
  tenantConfig: ResolvedTenantConfig;
  onSaved: () => void;
};

type FormProps = {
  row: AtendimentoLite;
  onClose: () => void;
  supabase: SupabaseClient;
  tenantConfig: ResolvedTenantConfig;
  onSaved: () => void;
};

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EditAtendimentoForm({ row, onClose, supabase, tenantConfig, onSaved }: FormProps) {
  const rf = tenantConfig.registerForm;
  const law = tenantConfig.priorityLawEnabled;
  const queueTabs = tenantConfig.queueTabs;
  const enabledCategories = useMemo(
    () => tenantConfig.cadastroCategories.filter((c) => c.enabled),
    [tenantConfig.cadastroCategories]
  );

  const initialTriagemTabId = resolveRowQueueTabId(row, queueTabs) || queueTabs[0]?.id || "";
  const initialFormValues = useMemo(() => {
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
  }, [row, tenantConfig.cadastroCategories]);

  const [triagemTabId, setTriagemTabId] = useState(initialTriagemTabId);
  const [nomeCliente, setNomeCliente] = useState(row.nome ?? "");
  const [formValues, setFormValues] = useState<Record<string, string>>(initialFormValues);
  const [horaMarcada, setHoraMarcada] = useState(() => toDatetimeLocal(row.hora_marcada));
  const [classificacao, setClassificacao] = useState<ClassificacaoPrioridade>(() =>
    resolveClassificacaoPrioridade(row.classificacao_prioridade, row.prioridade)
  );
  const [observacaoBase, setObservacaoBase] = useState(() => formatObservacaoForDisplay(row.observacao));
  const [profissionais, setProfissionais] = useState<ProfissionalRow[]>([]);
  const [locais, setLocais] = useState<OptRow[]>([]);
  const [servicos, setServicos] = useState<OptRow[]>([]);
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
      const [p, l, sResult] = await Promise.all([profQuery, locQuery, fetchServicos(supabase, row.tenant_id)]);
      if (cancelled) return;
      setProfissionais((p.data as ProfissionalRow[] | null) ?? []);
      setLocais((l.data as OptRow[] | null) ?? []);
      setServicos(sResult.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, row.tenant_id]);

  function handleTriagemChange(tabId: string) {
    setTriagemTabId(tabId);
    const tab = queueTabs.find((t) => t.id === tabId);
    if (tab?.preset !== "hora") setHoraMarcada("");
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

    const cadastroPayload = buildCadastroPayload(formValues, tenantConfig.cadastroCategories);

    const patch: Record<string, unknown> = {
      ...cadastroPayload,
      observacao: embedObservacaoForQueueTab(observacaoBase.trim() || null, triagemTab),
    };

    if (law) {
      patch.prioridade = prioridadeBooleanFromClassificacao(classificacao);
      patch.classificacao_prioridade = classificacao;
    }

    const wantsHora = triagemTab?.preset === "hora" || rf.showHoraMarcada;
    if (wantsHora && horaMarcada.trim()) {
      const d = new Date(horaMarcada);
      patch.hora_marcada = Number.isNaN(d.getTime()) ? horaMarcada.trim() : d.toISOString();
    } else if (triagemTab?.preset === "encaixe") {
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
            disabled={!row.paciente_id}
          />
        </label>
      ) : null}

      {enabledCategories.map((cat) => renderCategoryField(cat))}

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
  onSaved,
}: EditAtendimentoModalProps) {
  return (
    <Modal open={open} title="Editar registro" onClose={onClose} widthClassName="max-w-md">
      {open && row && supabase ? (
        <EditAtendimentoForm
          key={row.id}
          row={row}
          supabase={supabase}
          tenantConfig={tenantConfig}
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
