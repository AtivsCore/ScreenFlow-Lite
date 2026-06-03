"use client";

import type { AtendimentoLite } from "@/lib/atendimentos-lite";
import { filterAndSortQueue, formatCreatedAt, formatHoraMarcada, normalizeQueueStatusLabel } from "@/lib/atendimentos-lite";
import { classificacaoBadgeStyle } from "@/lib/classificacao-prioridade";
import type { CadastroLookups } from "@/lib/cadastro-valores";
import { resolveCategoryDisplayLabel } from "@/lib/cadastro-valores";
import type { CadastroCategoryEntry, ObservacoesVisibility, QueueTabEntry } from "@/lib/tenant-config";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Columns3, LayoutList, MessageSquareText, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { ObservacaoPopover } from "@/components/screenflow/observacao-popover";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { formatObservacaoForDisplay } from "@/lib/fila-preset";

type ViewMode = "list" | "kanban";

function queueStatusStyle(label: ReturnType<typeof normalizeQueueStatusLabel>): string {
  if (label === "chamado") return "text-sky-700 dark:text-sky-400";
  if (label === "rechamado") return "text-amber-700 dark:text-amber-400";
  return "text-zinc-600 dark:text-zinc-400";
}

function resolveKanbanMeta(
  row: AtendimentoLite,
  cadastroCategories: CadastroCategoryEntry[],
  cadastroLookups: CadastroLookups
): { profissional: string | null; local: string | null; servico: string | null } {
  const legacyCtx = {
    profissional_id: row.profissional_id,
    local_id: row.local_id,
    especialidade_id: row.especialidade_id,
    profissionalNome: row.profissionalNome,
    localNome: row.localNome,
    servicoNome: row.servicoNome,
  };

  const firstLabel = (tableKey: "profissionais" | "locais" | "servicos") => {
    const cat = cadastroCategories.find((c) => c.enabled && c.tableKey === tableKey);
    if (!cat) {
      if (tableKey === "profissionais") return row.profissionalNome?.trim() || null;
      if (tableKey === "locais") return row.localNome?.trim() || null;
      return row.servicoNome?.trim() || null;
    }
    return (
      resolveCategoryDisplayLabel(
        cat.id,
        row.cadastro_valores ?? {},
        cadastroLookups,
        cadastroCategories,
        undefined,
        legacyCtx
      ) ?? null
    );
  };

  return {
    profissional: firstLabel("profissionais"),
    local: firstLabel("locais"),
    servico: firstLabel("servicos"),
  };
}

function formatKanbanContextLine(meta: { profissional: string | null; local: string | null }): string | null {
  const parts = [meta.profissional, meta.local].filter((v): v is string => Boolean(v?.trim()));
  return parts.length ? parts.join(" • ") : null;
}

type KanbanCardProps = {
  row: AtendimentoLite;
  isSel: boolean;
  priorityLawEnabled: boolean;
  meta: ReturnType<typeof resolveKanbanMeta>;
  deleting: string | null;
  onSelectId: (id: string) => void;
  onEditRow: (row: AtendimentoLite) => void;
  onDelete: (row: AtendimentoLite) => void;
};

const KanbanCard = memo(function KanbanCard({
  row,
  isSel,
  priorityLawEnabled,
  meta,
  deleting,
  onSelectId,
  onEditRow,
  onDelete,
}: KanbanCardProps) {
  const prioStyle = priorityLawEnabled
    ? classificacaoBadgeStyle(row.classificacao_prioridade, row.prioridade)
    : null;
  const statusLabel = normalizeQueueStatusLabel(row.status);
  const clientName = row.nome?.trim() || "—";
  const contextLine = formatKanbanContextLine(meta);
  const horaMarcadaLabel = row.hora_marcada ? formatHoraMarcada(row.hora_marcada) : null;
  const observacaoText = formatObservacaoForDisplay(row.observacao);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onSelectId(row.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectId(row.id);
        }
      }}
      className={`group cursor-pointer border-l-2 bg-white px-2 py-1.5 text-left transition hover:bg-zinc-50/90 dark:bg-zinc-900 dark:hover:bg-zinc-800/40 ${
        isSel
          ? "border-l-orange-500 bg-orange-50/30 dark:bg-orange-950/15"
          : "border-l-zinc-300 dark:border-l-zinc-600"
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <p
          title={clientName !== "—" ? clientName : undefined}
          className="min-w-0 flex-1 truncate text-[10px] font-bold uppercase leading-none tracking-wide text-zinc-900 dark:text-zinc-100"
        >
          {clientName}
        </p>
        {priorityLawEnabled && prioStyle ? (
          <span className={`shrink-0 scale-[0.8] whitespace-nowrap ${prioStyle.badge}`}>
            {prioStyle.label}
          </span>
        ) : null}
      </div>

      <div className="mt-0.5 min-w-0">
        {meta.servico ? (
          <p
            className="truncate text-[9px] uppercase leading-tight tracking-wide text-zinc-500 dark:text-zinc-400"
            title={meta.servico}
          >
            {meta.servico}
          </p>
        ) : null}
        {contextLine ? (
          <p
            className="truncate text-[11px] leading-tight text-zinc-500 dark:text-zinc-400"
            title={contextLine}
          >
            {contextLine}
          </p>
        ) : null}
      </div>

      <div className="mt-0.5 flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className={`shrink-0 text-[9px] font-semibold uppercase leading-none tracking-wide ${queueStatusStyle(statusLabel)}`}
          >
            {statusLabel}
          </span>
          {horaMarcadaLabel ? (
            <span className="truncate text-[11px] leading-none text-zinc-500 dark:text-zinc-500" title={horaMarcadaLabel}>
              {horaMarcadaLabel}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-px" onClick={(e) => e.stopPropagation()}>
          {observacaoText ? (
            <Tooltip content={observacaoText} side="top" align="end">
              <button
                type="button"
                aria-label="Ver observação"
                className="inline-flex rounded p-0.5 text-zinc-400 transition hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                <MessageSquareText className="size-3.5" strokeWidth={1.75} />
              </button>
            </Tooltip>
          ) : null}
          <button
            type="button"
            title="Editar"
            className="inline-flex rounded p-0.5 text-zinc-400 transition hover:text-blue-600 dark:hover:text-blue-400"
            onClick={() => onEditRow(row)}
          >
            <Pencil className="size-3" strokeWidth={1.75} />
            <span className="sr-only">Editar</span>
          </button>
          <button
            type="button"
            title="Excluir"
            disabled={deleting === row.id}
            className="inline-flex rounded p-0.5 text-zinc-400 transition hover:text-red-600 disabled:opacity-40 dark:hover:text-red-400"
            onClick={() => onDelete(row)}
          >
            <Trash2 className="size-3" strokeWidth={1.75} />
            <span className="sr-only">Excluir</span>
          </button>
        </div>
      </div>
    </article>
  );
});

type QueueRowProps = {
  row: AtendimentoLite;
  isSel: boolean;
  priorityLawEnabled: boolean;
  observacoesAlwaysVisible: boolean;
  cadastroCategories: CadastroCategoryEntry[];
  cadastroLookups: CadastroLookups;
  deleting: string | null;
  onSelectId: (id: string) => void;
  onEditRow: (row: AtendimentoLite) => void;
  onDelete: (row: AtendimentoLite) => void;
};

const QueueRow = memo(function QueueRow({
  row,
  isSel,
  priorityLawEnabled,
  observacoesAlwaysVisible,
  cadastroCategories,
  cadastroLookups,
  deleting,
  onSelectId,
  onEditRow,
  onDelete,
}: QueueRowProps) {
  const prioStyle = priorityLawEnabled
    ? classificacaoBadgeStyle(row.classificacao_prioridade, row.prioridade)
    : null;
  const legacyCtx = {
    profissional_id: row.profissional_id,
    local_id: row.local_id,
    especialidade_id: row.especialidade_id,
    profissionalNome: row.profissionalNome,
    localNome: row.localNome,
    servicoNome: row.servicoNome,
  };

  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={() => onSelectId(row.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectId(row.id);
        }
      }}
      className={`cursor-pointer border-b border-zinc-100 transition-colors hover:bg-zinc-50/80 dark:border-zinc-800 dark:hover:bg-zinc-800/40 ${
        isSel ? "bg-zinc-100 dark:bg-zinc-800/60" : ""
      } ${prioStyle?.rowAccent ?? ""}`}
    >
      <td className="whitespace-nowrap px-2 py-1.5 font-mono text-zinc-500 dark:text-zinc-400">
        {formatCreatedAt(row.created_at)}
      </td>
      <td className="whitespace-nowrap px-2 py-1.5 font-mono font-medium text-zinc-800 dark:text-zinc-200">
        {formatHoraMarcada(row.hora_marcada)}
      </td>
      <td className="px-2 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          {priorityLawEnabled && prioStyle ? (
            <span className={`shrink-0 whitespace-nowrap ${prioStyle.badge}`}>{prioStyle.label}</span>
          ) : null}
          <span className="min-w-0 truncate font-medium">{row.nome ?? "—"}</span>
          {observacoesAlwaysVisible ? (
            <ObservacaoPopover
              observacao={row.observacao}
              inlineVisible
              inlineClassName="min-w-0 max-w-[8rem] shrink truncate text-[10px] text-zinc-500 dark:text-zinc-400"
            />
          ) : (
            <ObservacaoPopover observacao={row.observacao} className="shrink-0" />
          )}
        </div>
      </td>
      {cadastroCategories.map((cat) => {
        const label = resolveCategoryDisplayLabel(
          cat.id,
          row.cadastro_valores ?? {},
          cadastroLookups,
          cadastroCategories,
          undefined,
          legacyCtx
        );
        return (
          <td key={cat.id} className="max-w-[8rem] truncate px-2 py-1.5 text-zinc-700 dark:text-zinc-300">
            {label ?? "—"}
          </td>
        );
      })}
      <td className={`truncate px-2 py-1.5 capitalize ${queueStatusStyle(normalizeQueueStatusLabel(row.status))}`}>
        {normalizeQueueStatusLabel(row.status)}
      </td>
      <td className="px-2 py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          title="Editar"
          className="inline-flex rounded p-0.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-zinc-50"
          onClick={() => onEditRow(row)}
        >
          <Pencil className="size-3.5" strokeWidth={1.75} />
          <span className="sr-only">Editar</span>
        </button>
        <button
          type="button"
          title="Excluir"
          disabled={deleting === row.id}
          className="ml-0.5 inline-flex rounded p-0.5 text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-950/50"
          onClick={() => onDelete(row)}
        >
          <Trash2 className="size-3.5" strokeWidth={1.75} />
          <span className="sr-only">Excluir</span>
        </button>
      </td>
    </tr>
  );
});

type QueueSectionProps = {
  id?: string;
  rows: AtendimentoLite[];
  queueTabs: QueueTabEntry[];
  tabCounts?: Record<string, number>;
  queueTabId: string;
  onQueueTabId: (id: string) => void;
  priorityLawEnabled: boolean;
  observacoesVisibility: ObservacoesVisibility;
  cadastroCategories: CadastroCategoryEntry[];
  cadastroLookups: CadastroLookups;
  selectedId: string | null;
  onSelectId: (id: string) => void;
  loading: boolean;
  supabase: SupabaseClient | null;
  onRefresh: () => void;
  onRegisterClick: () => void;
  onOpenFlowSettings: () => void;
  onEditRow: (row: AtendimentoLite) => void;
};

export function QueueSection({
  id = "sf-queue",
  rows,
  queueTabs,
  tabCounts = {},
  queueTabId,
  onQueueTabId,
  priorityLawEnabled,
  observacoesVisibility,
  cadastroCategories,
  cadastroLookups,
  selectedId,
  onSelectId,
  loading,
  supabase,
  onRefresh,
  onRegisterClick,
  onOpenFlowSettings,
  onEditRow,
}: QueueSectionProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [deleting, setDeleting] = useState<string | null>(null);
  const enabledCategories = cadastroCategories.filter((c) => c.enabled);
  const observacoesAlwaysVisible = observacoesVisibility === "always";
  const colSpan = 4 + enabledCategories.length;

  const flowTabs = useMemo(() => queueTabs.filter((t) => t.preset !== "todos"), [queueTabs]);

  const activeTab = useMemo(
    () => queueTabs.find((t) => t.id === queueTabId) ?? queueTabs[0],
    [queueTabs, queueTabId]
  );

  const listRows = useMemo(() => {
    const tab = activeTab ?? { id: "tab-ordem", preset: "ordem" as const, label: "Ordem" };
    return filterAndSortQueue(rows, tab, { priorityLawEnabled });
  }, [rows, activeTab, priorityLawEnabled]);

  const kanbanColumns = flowTabs;

  const columnRows = useMemo(() => {
    const map: Record<string, AtendimentoLite[]> = {};
    for (const tab of kanbanColumns) {
      map[tab.id] = filterAndSortQueue(rows, tab, { priorityLawEnabled });
    }
    return map;
  }, [rows, kanbanColumns, priorityLawEnabled]);

  async function handleDelete(row: AtendimentoLite) {
    if (!supabase || !confirm(`Excluir registro de “${row.nome ?? "cliente"}”?`)) return;
    setDeleting(row.id);
    const { error } = await supabase.from("atendimentos_lite").delete().eq("id", row.id);
    if (error) alert(error.message);
    else onRefresh();
    setDeleting(null);
  }

  return (
    <TooltipProvider>
    <div
      id={id}
      className="flex h-full min-h-0 w-full max-w-full flex-1 flex-col overflow-x-hidden overflow-y-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="shrink-0 border-b border-zinc-200 px-2 py-2 dark:border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">Fila em tempo real</h2>
            <button
              type="button"
              title="Configurar fluxo de abas"
              aria-label="Configurar fluxo de abas"
              onClick={onOpenFlowSettings}
              className="flex size-6 shrink-0 items-center justify-center rounded-md border border-zinc-300 text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Plus className="size-3.5" strokeWidth={2} aria-hidden />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700"
              role="group"
              aria-label="Modo de visualização"
            >
              <button
                type="button"
                onClick={() => setViewMode("kanban")}
                className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${
                  viewMode === "kanban"
                    ? "bg-orange-500 text-white"
                    : "bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                <Columns3 className="size-3" strokeWidth={2} aria-hidden />
                Kanban
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1 border-l border-zinc-200 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition dark:border-zinc-700 ${
                  viewMode === "list"
                    ? "bg-orange-500 text-white"
                    : "bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                <LayoutList className="size-3" strokeWidth={2} aria-hidden />
                Lista
              </button>
            </div>

            <button
              type="button"
              onClick={onRegisterClick}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <UserPlus className="size-3.5" strokeWidth={1.75} aria-hidden />
              Novo registro
            </button>
          </div>
        </div>

        {viewMode === "list" ? (
          <div
            className="mt-2 flex gap-0.5 overflow-x-auto pb-0.5 sf-scroll-y-hidden"
            role="tablist"
            aria-label="Vistas da fila"
          >
            {queueTabs.map((t) => {
              const count = tabCounts[t.id];
              const label = typeof count === "number" ? `${t.label} (${count})` : t.label;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={queueTabId === t.id}
                  onClick={() => onQueueTabId(t.id)}
                  className={`shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-medium transition ${
                    queueTabId === t.id
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-x-hidden overflow-y-hidden p-2">
        {loading ? (
          <p className="flex flex-1 items-center justify-center text-xs text-zinc-500">Carregando registros…</p>
        ) : viewMode === "list" ? (
          <div className="min-h-0 flex-1 overflow-auto sf-scroll-y">
            <table className="w-full min-w-[680px] border-collapse text-left text-[11px] text-zinc-800 dark:text-zinc-100">
              <thead className="sticky top-0 z-[1] border-b border-zinc-200 bg-zinc-50 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/95 dark:text-zinc-400">
                <tr>
                  <th className="w-[100px] px-2 py-1.5">Chegada</th>
                  <th className="w-[110px] px-2 py-1.5">Horário marc.</th>
                  <th className="min-w-[180px] px-2 py-1.5">Cliente</th>
                  {enabledCategories.map((cat) => (
                    <th key={cat.id} className="min-w-[80px] max-w-[8rem] px-2 py-1.5">
                      {cat.label}
                    </th>
                  ))}
                  <th className="min-w-[70px] px-2 py-1.5">Status</th>
                  <th className="w-[72px] px-2 py-1.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {listRows.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} className="px-2 py-6 text-center text-zinc-500">
                      Nenhum registro ativo nesta vista.
                    </td>
                  </tr>
                ) : (
                  listRows.map((row) => (
                    <QueueRow
                      key={row.id}
                      row={row}
                      isSel={row.id === selectedId}
                      priorityLawEnabled={priorityLawEnabled}
                      observacoesAlwaysVisible={observacoesAlwaysVisible}
                      cadastroCategories={enabledCategories}
                      cadastroLookups={cadastroLookups}
                      deleting={deleting}
                      onSelectId={onSelectId}
                      onEditRow={onEditRow}
                      onDelete={(r) => void handleDelete(r)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : kanbanColumns.length === 0 ? (
          <p className="flex flex-1 items-center justify-center text-xs text-zinc-500">
            Nenhuma coluna de fluxo configurada.
          </p>
        ) : (
          <div className="flex min-h-0 w-full max-w-full flex-1 flex-col overflow-x-auto overflow-y-hidden pb-4 sf-scroll-y">
            <div className="flex h-full min-h-full w-max min-w-full gap-2">
            {kanbanColumns.map((tab) => {
              const cards = columnRows[tab.id] ?? [];
              const count = tabCounts[tab.id] ?? cards.length;
              return (
                <section
                  key={tab.id}
                  className="flex h-full min-h-0 max-h-full w-[240px] shrink-0 flex-col overflow-hidden bg-zinc-100 dark:bg-zinc-950/50"
                >
                  <header className="shrink-0 border-y border-zinc-200 bg-zinc-100 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800/80">
                    <div className="flex items-center justify-between gap-1">
                      <h3
                        className="truncate text-[9px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300"
                        title={tab.label}
                      >
                        {tab.label}
                      </h3>
                      <span className="shrink-0 font-mono text-[9px] font-semibold leading-none text-zinc-500 dark:text-zinc-400">
                        {count}
                      </span>
                    </div>
                  </header>

                  <div className="sf-scroll-y-hidden h-0 min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-zinc-100 p-1 dark:bg-zinc-900/60">
                    {cards.length === 0 ? (
                      <p className="py-6 text-center text-[9px] text-zinc-400 dark:text-zinc-500">—</p>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {cards.map((row) => (
                          <KanbanCard
                            key={row.id}
                            row={row}
                            isSel={row.id === selectedId}
                            priorityLawEnabled={priorityLawEnabled}
                            meta={resolveKanbanMeta(row, enabledCategories, cadastroLookups)}
                            deleting={deleting}
                            onSelectId={onSelectId}
                            onEditRow={onEditRow}
                            onDelete={(r) => void handleDelete(r)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
            </div>
          </div>
        )}
      </div>
    </div>
    </TooltipProvider>
  );
}
