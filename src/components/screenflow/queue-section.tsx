"use client";

import type { AtendimentoLite } from "@/lib/atendimentos-lite";
import { filterAndSortQueue, formatCreatedAt, formatHoraMarcada } from "@/lib/atendimentos-lite";
import { classificacaoBadgeStyle } from "@/lib/classificacao-prioridade";
import type { CadastroLookups } from "@/lib/cadastro-valores";
import { resolveCategoryDisplayLabel } from "@/lib/cadastro-valores";
import type { CadastroCategoryEntry, ObservacoesVisibility, QueueTabEntry } from "@/lib/tenant-config";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Columns3, LayoutList, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { ObservacaoPopover } from "@/components/screenflow/observacao-popover";

type ViewMode = "list" | "kanban";

function statusStyle(status: string | null): string {
  const s = (status ?? "").toLowerCase();
  if (s.includes("finaliz")) return "text-emerald-700 dark:text-emerald-400";
  if (s.includes("cham")) return "text-sky-700 dark:text-sky-400";
  if (s.includes("rech")) return "text-amber-700 dark:text-amber-400";
  return "text-zinc-600 dark:text-zinc-400";
}

function formatKanbanStatus(status: string | null): string {
  const s = (status ?? "").trim().toLowerCase();
  if (s.includes("rech")) return "rechamado";
  if (s.includes("cham")) return "chamado";
  if (s.includes("finaliz")) return "finalizado";
  return "aguardando";
}

function resolveServicoLabel(
  row: AtendimentoLite,
  cadastroCategories: CadastroCategoryEntry[],
  cadastroLookups: CadastroLookups
): string | null {
  const legacyCtx = {
    profissional_id: row.profissional_id,
    local_id: row.local_id,
    especialidade_id: row.especialidade_id,
    profissionalNome: row.profissionalNome,
    localNome: row.localNome,
    servicoNome: row.servicoNome,
  };
  const servicoCats = cadastroCategories.filter((c) => c.enabled && c.tableKey === "servicos");
  for (const cat of servicoCats) {
    const label = resolveCategoryDisplayLabel(
      cat.id,
      row.cadastro_valores ?? {},
      cadastroLookups,
      cadastroCategories,
      undefined,
      legacyCtx
    );
    if (label) return label;
  }
  return row.servicoNome?.trim() || null;
}

type KanbanCardProps = {
  row: AtendimentoLite;
  isSel: boolean;
  priorityLawEnabled: boolean;
  servicoLabel: string | null;
  onSelectId: (id: string) => void;
};

const KanbanCard = memo(function KanbanCard({
  row,
  isSel,
  priorityLawEnabled,
  servicoLabel,
  onSelectId,
}: KanbanCardProps) {
  const prioStyle = priorityLawEnabled
    ? classificacaoBadgeStyle(row.classificacao_prioridade, row.prioridade)
    : null;
  const statusLabel = formatKanbanStatus(row.status);

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
      className={`cursor-pointer rounded border bg-white px-2 py-1.5 text-left transition hover:border-zinc-400 dark:bg-zinc-900 ${
        isSel
          ? "border-orange-500 ring-1 ring-orange-500/30 dark:border-orange-400"
          : "border-zinc-200 dark:border-zinc-700"
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="min-w-0 flex-1 truncate text-[11px] font-bold uppercase tracking-wide text-zinc-900 dark:text-zinc-100">
          {row.nome ?? "—"}
        </p>
        {priorityLawEnabled && prioStyle ? (
          <span className={`shrink-0 scale-90 whitespace-nowrap text-[9px] ${prioStyle.badge}`}>
            {prioStyle.label}
          </span>
        ) : null}
      </div>

      {servicoLabel ? (
        <p className="mt-0.5 truncate text-[9px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {servicoLabel}
        </p>
      ) : null}

      <div className="mt-1.5 border-t border-dotted border-zinc-300 pt-1 dark:border-zinc-600">
        <span className={`text-[9px] font-semibold uppercase tracking-wide ${statusStyle(row.status)}`}>
          {statusLabel}
        </span>
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
      <td className={`truncate px-2 py-1.5 ${statusStyle(row.status)}`}>{row.status ?? "—"}</td>
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
    <div
      id={id}
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
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

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2">
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
          <div className="flex min-h-0 flex-1 gap-1.5 overflow-x-auto sf-scroll-y-hidden pb-0.5">
            {kanbanColumns.map((tab) => {
              const cards = columnRows[tab.id] ?? [];
              const count = tabCounts[tab.id] ?? cards.length;
              return (
                <section
                  key={tab.id}
                  className="flex w-[168px] min-w-[168px] shrink-0 flex-col overflow-hidden rounded-md border border-zinc-200 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-950/30"
                >
                  <header className="z-[1] shrink-0 border-b border-zinc-200 bg-zinc-100 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-800/80">
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="truncate text-[9px] font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                        {tab.label}
                      </h3>
                      <span className="shrink-0 rounded border border-zinc-300 bg-white px-1 py-px font-mono text-[9px] font-semibold text-zinc-700 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                        {count}
                      </span>
                    </div>
                  </header>

                  <div className="sf-scroll-y-hidden flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-1">
                    {cards.length === 0 ? (
                      <p className="py-4 text-center text-[9px] text-zinc-400 dark:text-zinc-500">—</p>
                    ) : (
                      cards.map((row) => (
                        <KanbanCard
                          key={row.id}
                          row={row}
                          isSel={row.id === selectedId}
                          priorityLawEnabled={priorityLawEnabled}
                          servicoLabel={resolveServicoLabel(row, enabledCategories, cadastroLookups)}
                          onSelectId={onSelectId}
                        />
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
