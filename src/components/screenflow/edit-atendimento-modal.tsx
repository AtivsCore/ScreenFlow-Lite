"use client";

import type { AtendimentoLite } from "@/lib/atendimentos-lite";
import {
  prioridadeBooleanFromClassificacao,
  resolveClassificacaoPrioridade,
  type ClassificacaoPrioridade,
} from "@/lib/classificacao-prioridade";
import { buildCadastroPayload, hydrateCadastroValores } from "@/lib/cadastro-valores";
import {
  buildAviacaoSavePayload,
  isAviacaoHybridComboboxField,
  isAviacaoSegment,
  isAviacaoTextField,
  mergeAviacaoObservacao,
  parseAviacaoCadastroFields,
  resolveAviacaoCategoryLabel,
  resolveAviacaoComboboxOptions,
  resolveAviacaoQuickCrudTable,
} from "@/lib/aviacao-logistics";
import {
  buildDocasSavePayload,
  isDocasSegment,
  isDocasTextField,
  mergeDocasObservacao,
  parseDocasCadastroFields,
} from "@/lib/docas-logistics";
import {
  embedObservacaoForQueueTab,
  formatObservacaoForDisplay,
  resolveRowQueueTabId,
} from "@/lib/fila-preset";
import { formatProfissionalLabel, type ProfissionalRow } from "@/lib/profissionais-display";
import { fetchServicos } from "@/lib/fetch-servicos";
import {
  datetimeLocalToIso,
  isoToTimeInputValue,
  mergeHoraMarcadaPreserveDate,
} from "@/lib/hora-marcada";
import type { CadastroCategoryEntry, ResolvedTenantConfig } from "@/lib/tenant-config";
import { cadastroCategoryCrudTable } from "@/lib/tenant-config";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { AviacaoHybridCombobox } from "@/components/screenflow/aviacao-hybrid-combobox";
import { CrudEntityModal } from "@/components/screenflow/crud-entity-modal";
import { PriorityClassSelector } from "@/components/screenflow/priority-class-selector";

type OptRow = { id: string; nome: string | null };

type EditAtendimentoModalProps = {
  open: boolean;
  row: AtendimentoLite | null;
  onClose: () => void;
  supabase: SupabaseClient | null;
  tenantConfig: ResolvedTenantConfig;
  /** Data/hora completa só na Agenda PRO; na fila diária usa apenas horário (HH:MM). */
  allowFullDatetime?: boolean;
  onSaved: () => void;
};

type FormProps = {
  row: AtendimentoLite;
  onClose: () => void;
  supabase: SupabaseClient;
  tenantConfig: ResolvedTenantConfig;
  allowFullDatetime: boolean;
  onSaved: () => void;
};

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EditAtendimentoForm({ row, onClose, supabase, tenantConfig, allowFullDatetime, onSaved }: FormProps) {
  const rf = tenantConfig.registerForm;
  const law = tenantConfig.priorityLawEnabled;
  const queueTabs = tenantConfig.queueTabs;
  const enabledCategories = useMemo(
    () => tenantConfig.cadastroCategories.filter((c) => c.enabled),
    [tenantConfig.cadastroCategories]
  );
  const docasMode = isDocasSegment(tenantConfig.segmentoAplicado);
  const aviacaoMode = isAviacaoSegment(tenantConfig.segmentoAplicado);

  const initialTriagemTabId = resolveRowQueueTabId(row, queueTabs) || queueTabs[0]?.id || "";
  const initialFormValues = useMemo(() => {
    if (docasMode || aviacaoMode) {
      const inlineFields = docasMode
        ? parseDocasCadastroFields(row.observacao)
        : parseAviacaoCadastroFields(row.observacao);
      const isTextField = docasMode ? isDocasTextField : isAviacaoTextField;
      const hydrated = hydrateCadastroValores(row.cadastro_valores, tenantConfig.cadastroCategories, {
        profissional_id: row.profissional_id,
        local_id: row.local_id,
        especialidade_id: row.especialidade_id,
      });
      const out: Record<string, string> = {};
      for (const cat of enabledCategories) {
        if (isTextField(cat.id)) {
          const t = inlineFields[cat.id];
          if (t) out[cat.id] = t;
        } else {
          const v = hydrated[cat.id];
          if (v) out[cat.id] = v;
        }
      }
      return out;
    }
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
  }, [row, tenantConfig.cadastroCategories, docasMode, aviacaoMode, enabledCategories]);

  const [triagemTabId, setTriagemTabId] = useState(initialTriagemTabId);
  const [nomeCliente, setNomeCliente] = useState(row.nome ?? "");
  const [formValues, setFormValues] = useState<Record<string, string>>(initialFormValues);
  const [horaMarcada, setHoraMarcada] = useState(() =>
    allowFullDatetime ? toDatetimeLocal(row.hora_marcada) : isoToTimeInputValue(row.hora_marcada)
  );
  const [classificacao, setClassificacao] = useState<ClassificacaoPrioridade>(() =>
    resolveClassificacaoPrioridade(row.classificacao_prioridade, row.prioridade)
  );
  const [observacaoBase, setObservacaoBase] = useState(() => formatObservacaoForDisplay(row.observacao));
  const [profissionais, setProfissionais] = useState<ProfissionalRow[]>([]);
  const [locais, setLocais] = useState<OptRow[]>([]);
  const [servicos, setServicos] = useState<OptRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [quickCrud, setQuickCrud] = useState<{
    title: string;
    table: string;
    categoryId?: string;
  } | null>(null);

  function openCrudForCategory(cat: CadastroCategoryEntry) {
    const title = aviacaoMode ? resolveAviacaoCategoryLabel(cat) : cat.label;
    setQuickCrud({
      title,
      table: aviacaoMode ? resolveAviacaoQuickCrudTable(cat) : cadastroCategoryCrudTable(cat),
      categoryId: aviacaoMode ? cat.id : undefined,
    });
  }

  function comboboxOptionsFor(cat: CadastroCategoryEntry) {
    if (aviacaoMode) {
      return resolveAviacaoComboboxOptions(cat.id, { profissionais, servicos });
    }
    if (cat.tableKey === "profissionais") {
      return profissionais.map((m) => ({ id: m.id, label: formatProfissionalLabel(m) }));
    }
    if (cat.tableKey === "locais") {
      return locais.map((m) => ({ id: m.id, label: m.nome ?? m.id }));
    }
    return servicos.map((m) => ({ id: m.id, label: m.nome ?? m.id }));
  }

  const loadLookupOptions = useCallback(async () => {
    const tid = row.tenant_id?.trim();
    const profQuery = tid
      ? supabase.from("profissionais").select("id,nome,especialidade").eq("tenant_id", tid).order("nome")
      : supabase.from("profissionais").select("id,nome,especialidade").order("nome");
    const locQuery = tid
      ? supabase.from("locais").select("id,nome").eq("tenant_id", tid).order("nome")
      : supabase.from("locais").select("id,nome").order("nome");
    const [p, l, sResult] = await Promise.all([profQuery, locQuery, fetchServicos(supabase, row.tenant_id)]);
    setProfissionais((p.data as ProfissionalRow[] | null) ?? []);
    setLocais((l.data as OptRow[] | null) ?? []);
    setServicos(sResult.data);
  }, [supabase, row.tenant_id]);

  const triagemTab = useMemo(
    () => queueTabs.find((t) => t.id === triagemTabId) ?? queueTabs[0],
    [queueTabs, triagemTabId]
  );
  const triagemLabel = triagemTab?.label ?? "Entrada na fila";

  useEffect(() => {
    void loadLookupOptions();
  }, [loadLookupOptions]);

  function handleTriagemChange(tabId: string) {
    setTriagemTabId(tabId);
    if (docasMode || aviacaoMode) return;
    const tab = queueTabs.find((t) => t.id === tabId);
    if (tab?.preset !== "hora") setHoraMarcada("");
  }

  const showDocasHoraAgendada = docasMode;
  const showAviacaoHoraAgendada = aviacaoMode;

  function renderCategoryField(cat: (typeof enabledCategories)[number]) {
    if (aviacaoMode && isAviacaoHybridComboboxField(cat.id)) {
      return (
        <AviacaoHybridCombobox
          key={cat.id}
          instanceId={cat.id}
          label={resolveAviacaoCategoryLabel(cat)}
          value={formValues[cat.id] ?? ""}
          options={comboboxOptionsFor(cat)}
          disabled={busy}
          quickAddDisabled={false}
          onChange={(v) => setFormValues((prev) => ({ ...prev, [cat.id]: v }))}
          onQuickAdd={() => openCrudForCategory(cat)}
          size="modal"
        />
      );
    }

    if (docasMode && isDocasTextField(cat.id)) {
      return (
        <label key={cat.id} className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          {cat.label}
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

    const patch: Record<string, unknown> = docasMode
      ? (() => {
          const { cadastroPayload, docasFields } = buildDocasSavePayload(
            formValues,
            tenantConfig.cadastroCategories
          );
          const observacao = mergeDocasObservacao({
            current: row.observacao,
            tab: triagemTab,
            docasFields,
            preserveTabWhenUnset: true,
            userObservacaoText: observacaoBase.trim() || null,
          });
          return { ...cadastroPayload, observacao };
        })()
      : aviacaoMode
        ? (() => {
            const { cadastroPayload, aviacaoFields } = buildAviacaoSavePayload(
              formValues,
              tenantConfig.cadastroCategories
            );
            const observacao = mergeAviacaoObservacao({
              current: row.observacao,
              tab: triagemTab,
              aviacaoFields,
              preserveTabWhenUnset: true,
              userObservacaoText: observacaoBase.trim() || null,
            });
            return { ...cadastroPayload, observacao };
          })()
        : {
          ...buildCadastroPayload(formValues, tenantConfig.cadastroCategories),
          observacao: embedObservacaoForQueueTab(observacaoBase.trim() || null, triagemTab),
        };

    if (law) {
      patch.prioridade = prioridadeBooleanFromClassificacao(classificacao);
      patch.classificacao_prioridade = classificacao;
    }

    const wantsHora =
      docasMode || aviacaoMode || triagemTab?.preset === "hora" || rf.showHoraMarcada;
    if (wantsHora && horaMarcada.trim()) {
      if (allowFullDatetime && !docasMode && !aviacaoMode) {
        patch.hora_marcada = datetimeLocalToIso(horaMarcada) ?? horaMarcada.trim();
      } else {
        patch.hora_marcada = mergeHoraMarcadaPreserveDate(row.hora_marcada, horaMarcada);
      }
    } else if (!docasMode && !aviacaoMode && triagemTab?.preset === "encaixe") {
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
    showDocasHoraAgendada ||
    showAviacaoHoraAgendada ||
    triagemTab?.preset === "hora" ||
    law ||
    rf.showObservacao;

  return (
    <>
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

      {(showDocasHoraAgendada || showAviacaoHoraAgendada || rf.showHoraMarcada || triagemTab?.preset === "hora") ? (
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          {showDocasHoraAgendada || showAviacaoHoraAgendada ? (
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" strokeWidth={2} aria-hidden />
              {showAviacaoHoraAgendada ? "ETA (horário estimado de pouso)" : "Horário agendado"}
            </span>
          ) : allowFullDatetime ? (
            "Data e hora do agendamento"
          ) : (
            "Horário marcado (somente hora)"
          )}
          <input
            type={showDocasHoraAgendada || showAviacaoHoraAgendada || !allowFullDatetime ? "time" : "datetime-local"}
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

    {quickCrud ? (
      <CrudEntityModal
        open
        supabase={supabase}
        title={quickCrud.title}
        table={quickCrud.table}
        tenantId={row.tenant_id}
        cadastroCategoryId={quickCrud.categoryId}
        onClose={() => setQuickCrud(null)}
        onSaved={() => void loadLookupOptions()}
      />
    ) : null}
    </>
  );
}

export function EditAtendimentoModal({
  open,
  row,
  onClose,
  supabase,
  tenantConfig,
  allowFullDatetime = false,
  onSaved,
}: EditAtendimentoModalProps) {
  return (
    <Modal open={open} title="Editar registro" onClose={onClose} widthClassName="max-w-md">
      {open && row && supabase ? (
        <EditAtendimentoForm
          key={`${row.id}-${allowFullDatetime ? "agenda" : "fila"}`}
          row={row}
          supabase={supabase}
          tenantConfig={tenantConfig}
          allowFullDatetime={allowFullDatetime}
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
