"use client";

import type { AtendimentoLite } from "@/lib/atendimentos-lite";
import { filterAndSortQueue, formatCreatedAt, formatHoraMarcada } from "@/lib/atendimentos-lite";
import { classificacaoBadgeStyle } from "@/lib/classificacao-prioridade";
import type { CadastroLookups } from "@/lib/cadastro-valores";
import { resolveCategoryDisplayLabel } from "@/lib/cadastro-valores";
import type { CadastroCategoryEntry, ObservacoesVisibility, QueueTabEntry } from "@/lib/tenant-config";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { ObservacaoPopover } from "@/components/screenflow/observacao-popover";

function statusStyle(status: string | null): string {
  const s = (status ?? "").toLowerCase();
  if (s.includes("finaliz")) return "text-emerald-700 dark:text-emerald-400";
  if (s.includes("cham")) return "text-sky-700 dark:text-sky-400";
  if (s.includes("rech")) return "text-amber-700 dark:text-amber-400";
  return "text-zinc-600 dark:text-zinc-400";
}

type KanbanCardProps = {
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

const KanbanCard = memo(function KanbanCard({
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
}: KanbanCardProps) {
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

  const categoryLines = cadastroCategories
    .map((cat) => {
      const value = resolveCategoryDisplayLabel(
        cat.id,
        row.cadastro_valores ?? {},
        cadastroLookups,
        cadastroCategories,
        undefined,
        legacyCtx
      );
      if (!value) return null;
      return { label: cat.label, value };
    })
    .filter(Boolean) as { label: string; value: string }[];

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
      className={`cursor-pointer rounded-lg border bg-white p-2.5 text-left shadow-sm transition hover:shadow-md dark:bg-zinc-900 ${
        isSel
          ? "border-zinc-900 ring-2 ring-zinc-900/20 dark:border-zinc-100 dark:ring-zinc-100/20"
          : "border-zinc-200 dark:border-zinc-700"
      } ${prioStyle?.rowAccent ?? ""}`}
    >
      <div className="flex items-start justify-between gap-1.5">
        <span className="font-mono text-[10px] font-bold text-zinc-800 dark:text-zinc-100">
          {formatCreatedAt(row.created_at)}
        </span>
        {priorityLawEnabled && prioStyle ? (
          <span className={`shrink-0 whitespace-nowrap ${prioStyle.badge}`}>{prioStyle.label}</span>
        ) : null}
      </div>

      <p className="mt-1 truncate text-xs font-semibold uppercase tracking-wide text-zinc-800 dark:text-zinc-100">
        {row.nome ?? "—"}
      </p>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
        <span>Hora: {formatHoraMarcada(row.hora_marcada)}</span>
        <span className={`font-medium ${statusStyle(row.status)}`}>{row.status ?? "—"}</span>
      </div>

      {categoryLines.length > 0 ? (
        <ul className="mt-1.5 space-y-0.5 text-[10px] text-zinc-600 dark:text-zinc-400">
          {categoryLines.slice(0, 3).map((line) => (
            <li key={line.label} className="truncate">
              <span className="text-zinc-400 dark:text-zinc-500">{line.label}:</span> {line.value}
            </li>
          ))}
        </ul>
      ) : null}

      {observacoesAlwaysVisible ? (
        <ObservacaoPopover
          observacao={row.observacao}
          inlineVisible
          inlineClassName="mt-1 max-w-full truncate text-[10px] text-zinc-500 dark:text-zinc-400"
        />
      ) : null}

      <div
        className="mt-2 flex items-center justify-between border-t border-dotted border-zinc-300 pt-2 dark:border-zinc-600"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="truncate text-[10px] text-zinc-400 dark:text-zinc-500">
          {row.id.slice(0, 8)}
        </span>
        <div className="flex shrink-0 gap-0.5">
          {!observacoesAlwaysVisible ? (
            <ObservacaoPopover observacao={row.observacao} className="shrink-0" />
          ) : null}
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
            className="inline-flex rounded p-0.5 text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-950/50"
            onClick={() => onDelete(row)}
          >
            <Trash2 className="size-3.5" strokeWidth={1.75} />
            <span className="sr-only">Excluir</span>
          </button>
        </div>
      </div>
    </article>
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
  const [deleting, setDeleting] = useState<string | null>(null);
  const enabledCategories = cadastroCategories.filter((c) => c.enabled);
  const observacoesAlwaysVisible = observacoesVisibility === "always";

  const flowTabs = useMemo(() => queueTabs.filter((t) => t.preset !== "todos"), [queueTabs]);

  const columnsToShow = useMemo(() => {
    const active = queueTabs.find((t) => t.id === queueTabId);
    if (!active || active.preset === "todos") return flowTabs;
    return [active];
  }, [queueTabId, queueTabs, flowTabs]);

  const columnRows = useMemo(() => {
    const map: Record<string, AtendimentoLite[]> = {};
    for (const tab of columnsToShow) {
      map[tab.id] = filterAndSortQueue(rows, tab, { priorityLawEnabled });
    }
    return map;
  }, [rows, columnsToShow, priorityLawEnabled]);

  const columnWidth =
    columnsToShow.length === 1 ? "min-w-[min(100%,320px)] flex-1" : "w-[240px] min-w-[240px] shrink-0";

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
          <button
            type="button"
            onClick={onRegisterClick}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <UserPlus className="size-3.5" strokeWidth={1.75} aria-hidden />
            Novo registro
          </button>
        </div>

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
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2">
        {loading ? (
          <p className="flex flex-1 items-center justify-center text-xs text-zinc-500">Carregando registros…</p>
        ) : columnsToShow.length === 0 ? (
          <p className="flex flex-1 items-center justify-center text-xs text-zinc-500">
            Nenhuma coluna de fluxo configurada.
          </p>
        ) : (
          <div
            className={`flex min-h-0 flex-1 gap-2 overflow-x-auto sf-scroll-y-hidden ${
              columnsToShow.length === 1 ? "" : "pb-0.5"
            }`}
          >
            {columnsToShow.map((tab) => {
              const cards = columnRows[tab.id] ?? [];
              const count = tabCounts[tab.id] ?? cards.length;
              return (
                <section
                  key={tab.id}
                  className={`flex ${columnWidth} flex-col overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700`}
                >
                  <header className="z-[1] shrink-0 rounded-t-lg bg-zinc-700 px-3 py-2 dark:bg-zinc-800">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate text-[10px] font-bold uppercase tracking-wide text-white">
                        {tab.label}
                      </h3>
                      <span className="shrink-0 rounded bg-white/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
                        {count}
                      </span>
                    </div>
                  </header>

                  <div className="sf-scroll-y-hidden flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto bg-zinc-100/90 p-2 dark:bg-zinc-950/50">
                    {cards.length === 0 ? (
                      <p className="py-6 text-center text-[10px] text-zinc-500 dark:text-zinc-400">
                        Nenhum registro
                      </p>
                    ) : (
                      cards.map((row) => (
                        <KanbanCard
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
