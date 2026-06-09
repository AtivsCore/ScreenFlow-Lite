"use client";

import type { AtendimentoLite } from "@/lib/atendimentos-lite";
import { filterAndSortQueue, formatCreatedAt, formatHoraMarcada, normalizeQueueStatusLabel } from "@/lib/atendimentos-lite";
import { classificacaoBadgeStyle } from "@/lib/classificacao-prioridade";
import type { CadastroLookups } from "@/lib/cadastro-valores";
import { resolveCategoryDisplayLabel } from "@/lib/cadastro-valores";
import {
  formatAviacaoObservacaoForDisplay,
  isAviacaoQueueTabSelected,
  resolveAviacaoCategoryDisplay,
  resolveAviacaoKanbanColumnLabel,
  resolveMroProfile,
  resolveAviacaoKanbanMeta,
  resolveAviacaoQueueTabClickId,
  filterAndSortMroQueue,
  rowMatchesMroQueueSearch,
} from "@/lib/aviacao-logistics";
import { buildAtendimentoShareSummary, copyAtendimentoShareSummary } from "@/lib/atendimento-share-summary";
import { TODOS_QUEUE_TAB } from "@/lib/tenant-config";
import { isMroPatioCompactSegment } from "@/lib/mro-segment-profile";
import { resolveDocasCategoryDisplay, resolveDocasKanbanMeta } from "@/lib/docas-logistics";
import type { CadastroCategoryEntry, ObservacoesVisibility, QueueTabEntry } from "@/lib/tenant-config";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AviacaoHangarStepper } from "@/components/screenflow/aviacao-hangar-stepper";
import { AviacaoQueueFilterPopover } from "@/components/screenflow/aviacao-queue-filter-popover";
import { DocasStatusStepper } from "@/components/screenflow/docas-status-stepper";
import type { DocasQueueTabId } from "@/lib/docas-logistics";
import {
  Columns3,
  Copy,
  Eye,
  EyeOff,
  LayoutGrid,
  LayoutList,
  MessageSquareText,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { formatObservacaoForDisplay } from "@/lib/fila-preset";

export type QueueViewMode = "list" | "kanban";

function queueStatusStyle(label: ReturnType<typeof normalizeQueueStatusLabel>): string {
  if (label === "chamado") return "text-sky-700 dark:text-sky-400";
  if (label === "rechamado") return "text-amber-700 dark:text-amber-400";
  return "text-zinc-600 dark:text-zinc-400";
}

function resolveKanbanMeta(
  row: AtendimentoLite,
  cadastroCategories: CadastroCategoryEntry[],
  cadastroLookups: CadastroLookups,
  docasLogisticsActive: boolean,
  aviacaoLogisticsActive: boolean
): {
  title: string;
  profissional: string | null;
  local: string | null;
  servico: string | null;
  docaAlocada?: string | null;
  hangarAlocado?: string | null;
} {
  if (docasLogisticsActive) {
    return resolveDocasKanbanMeta(row, cadastroCategories, cadastroLookups);
  }
  if (aviacaoLogisticsActive) {
    const meta = resolveAviacaoKanbanMeta(row, cadastroCategories, cadastroLookups);
    return {
      title: meta.title,
      profissional: meta.profissional,
      local: meta.local,
      servico: meta.servico,
      hangarAlocado: meta.hangarLabel,
    };
  }
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
    title: row.nome?.trim() || "—",
    profissional: firstLabel("profissionais"),
    local: firstLabel("locais"),
    servico: firstLabel("servicos"),
  };
}

function formatKanbanContextLine(meta: { profissional: string | null; local: string | null }): string | null {
  const parts = [meta.profissional, meta.local].filter((v): v is string => Boolean(v?.trim()));
  return parts.length ? parts.join(" • ") : null;
}

const CLINICAS_SEGMENT_ID = "clinicas_consultorios";

type CompactKanbanLine = {
  primary: string;
  secondary: string | null;
  allocated: string | null;
  primaryMono: boolean;
};

function resolveCompactKanbanLine(
  segmentoId: string | null | undefined,
  meta: ReturnType<typeof resolveKanbanMeta>,
  docasLogisticsActive: boolean,
  aviacaoLogisticsActive: boolean
): CompactKanbanLine {
  if (isMroPatioCompactSegment(segmentoId)) {
    return {
      primary: meta.title,
      secondary: meta.servico,
      allocated: meta.hangarAlocado ?? null,
      primaryMono: true,
    };
  }
  if (segmentoId === CLINICAS_SEGMENT_ID || !segmentoId?.trim()) {
    return {
      primary: meta.title,
      secondary: meta.servico,
      allocated: meta.local,
      primaryMono: false,
    };
  }
  if (docasLogisticsActive) {
    return {
      primary: meta.title,
      secondary: meta.servico,
      allocated: meta.docaAlocada ?? null,
      primaryMono: false,
    };
  }
  if (aviacaoLogisticsActive) {
    return {
      primary: meta.title,
      secondary: meta.servico,
      allocated: meta.hangarAlocado ?? null,
      primaryMono: true,
    };
  }
  return {
    primary: meta.title,
    secondary: meta.servico,
    allocated: meta.local ?? meta.docaAlocada ?? meta.hangarAlocado ?? null,
    primaryMono: false,
  };
}

type KanbanCardProps = {
  row: AtendimentoLite;
  isSel: boolean;
  isCompactView: boolean;
  priorityLawEnabled: boolean;
  notesInline: boolean;
  aviacaoLogisticsActive: boolean;
  docasLogisticsActive: boolean;
  segmentoId: string | null | undefined;
  meta: ReturnType<typeof resolveKanbanMeta>;
  deleting: string | null;
  onSelectId: (id: string) => void;
  onEditRow: (row: AtendimentoLite) => void;
  onPrintRow: (row: AtendimentoLite) => void;
  onCopyRow: (row: AtendimentoLite) => void;
  onDelete: (row: AtendimentoLite) => void;
};

const KanbanCard = memo(function KanbanCard({
  row,
  isSel,
  isCompactView,
  priorityLawEnabled,
  notesInline,
  aviacaoLogisticsActive,
  docasLogisticsActive,
  segmentoId,
  meta,
  deleting,
  onSelectId,
  onEditRow,
  onPrintRow,
  onCopyRow,
  onDelete,
}: KanbanCardProps) {
  const prioStyle = priorityLawEnabled
    ? classificacaoBadgeStyle(row.classificacao_prioridade, row.prioridade)
    : null;
  const statusLabel = normalizeQueueStatusLabel(row.status);
  const clientName = meta.title;
  const contextLine = formatKanbanContextLine(meta);
  const horaMarcadaLabel = row.hora_marcada ? formatHoraMarcada(row.hora_marcada) : null;
  const observacaoText = aviacaoLogisticsActive
    ? formatAviacaoObservacaoForDisplay(row.observacao)
    : formatObservacaoForDisplay(row.observacao);

  const cardShellClass = `group cursor-pointer border-l-2 bg-white text-left transition hover:bg-zinc-50/90 dark:bg-zinc-900 dark:hover:bg-zinc-800/40 ${
    isSel
      ? "border-l-orange-500 bg-orange-50/30 dark:bg-orange-950/15"
      : "border-l-zinc-300 dark:border-l-zinc-600"
  } ${isCompactView ? "px-2 py-1" : "px-2 py-1.5"}`;

  const actionButtons = (
    <div className="flex shrink-0 items-center gap-px" onClick={(e) => e.stopPropagation()}>
      {!isCompactView && !notesInline && observacaoText ? (
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
        title="Copiar resumo"
        className="inline-flex rounded p-0.5 text-zinc-400 transition hover:text-zinc-700 dark:hover:text-zinc-200"
        onClick={() => onCopyRow(row)}
      >
        <Copy className="size-3" strokeWidth={1.75} />
        <span className="sr-only">Copiar resumo</span>
      </button>
      <button
        type="button"
        title="Imprimir ficha"
        className="inline-flex rounded p-0.5 text-zinc-400 transition hover:text-zinc-700 dark:hover:text-zinc-200"
        onClick={() => onPrintRow(row)}
      >
        <Printer className="size-3" strokeWidth={1.75} />
        <span className="sr-only">Imprimir ficha</span>
      </button>
      <button
        type="button"
        title="Editar"
        className="inline-flex rounded p-0.5 text-zinc-400 transition hover:text-blue-600 dark:hover:text-blue-400"
        onClick={() => onEditRow(row)}
      >
        <Pencil className="size-3" strokeWidth={1.75} />
        <span className="sr-only">Editar</span>
      </button>
      {!isCompactView ? (
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
      ) : null}
    </div>
  );

  if (isCompactView) {
    const line = resolveCompactKanbanLine(segmentoId, meta, docasLogisticsActive, aviacaoLogisticsActive);
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
        className={cardShellClass}
      >
        {horaMarcadaLabel ? (
          <p
            className="mb-0.5 truncate text-[9px] font-semibold leading-none tracking-wide text-teal-700 dark:text-teal-400"
            title={`Previsão de retirada: ${horaMarcadaLabel}`}
          >
            Retirada {horaMarcadaLabel}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-1">
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
            <span
              title={line.primary !== "—" ? line.primary : undefined}
              className={`shrink-0 text-[10px] font-bold uppercase leading-none tracking-wide text-zinc-900 dark:text-zinc-100 ${
                line.primaryMono ? "font-mono" : ""
              }`}
            >
              {line.primary}
            </span>
            {line.secondary ? (
              <span
                className="min-w-0 truncate text-[9px] uppercase leading-none tracking-wide text-zinc-500 dark:text-zinc-400"
                title={line.secondary}
              >
                {line.secondary}
              </span>
            ) : null}
            {line.allocated ? (
              <span
                className="shrink-0 truncate text-[9px] font-semibold uppercase leading-none tracking-wide text-orange-700 dark:text-orange-400"
                title={line.allocated}
              >
                {line.allocated}
              </span>
            ) : null}
          </div>
          {actionButtons}
        </div>
      </article>
    );
  }

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
      className={cardShellClass}
    >
      {horaMarcadaLabel ? (
        <p
          className="mb-0.5 truncate text-[9px] font-semibold leading-none tracking-wide text-teal-700 dark:text-teal-400"
          title={`Previsão de retirada: ${horaMarcadaLabel}`}
        >
          Retirada {horaMarcadaLabel}
        </p>
      ) : null}
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
        {meta.docaAlocada ? (
          <p
            className="truncate text-[9px] font-semibold uppercase leading-tight tracking-wide text-orange-700 dark:text-orange-400"
            title={meta.docaAlocada}
          >
            {meta.docaAlocada}
          </p>
        ) : null}
        {meta.hangarAlocado ? (
          <p
            className="truncate text-[9px] font-semibold uppercase leading-tight tracking-wide text-sky-700 dark:text-sky-400"
            title={meta.hangarAlocado}
          >
            {meta.hangarAlocado}
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
        {notesInline && observacaoText ? (
          <p
            title={observacaoText}
            className="line-clamp-2 text-[10px] leading-snug text-zinc-500 dark:text-zinc-400"
          >
            {observacaoText}
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
        {actionButtons}
      </div>
    </article>
  );
});

type QueueRowProps = {
  row: AtendimentoLite;
  isSel: boolean;
  priorityLawEnabled: boolean;
  notesInline: boolean;
  docasLogisticsActive: boolean;
  aviacaoLogisticsActive: boolean;
  cadastroCategories: CadastroCategoryEntry[];
  cadastroLookups: CadastroLookups;
  deleting: string | null;
  onSelectId: (id: string) => void;
  onEditRow: (row: AtendimentoLite) => void;
  onPrintRow: (row: AtendimentoLite) => void;
  onCopyRow: (row: AtendimentoLite) => void;
  onDelete: (row: AtendimentoLite) => void;
};

const QueueRow = memo(function QueueRow({
  row,
  isSel,
  priorityLawEnabled,
  notesInline,
  docasLogisticsActive,
  aviacaoLogisticsActive,
  cadastroCategories,
  cadastroLookups,
  deleting,
  onSelectId,
  onEditRow,
  onPrintRow,
  onCopyRow,
  onDelete,
}: QueueRowProps) {
  const prioStyle = priorityLawEnabled
    ? classificacaoBadgeStyle(row.classificacao_prioridade, row.prioridade)
    : null;
  const observacaoText = aviacaoLogisticsActive
    ? formatAviacaoObservacaoForDisplay(row.observacao)
    : formatObservacaoForDisplay(row.observacao);
  const clientLabel = aviacaoLogisticsActive
    ? resolveAviacaoKanbanMeta(row, cadastroCategories, cadastroLookups).title
    : row.nome?.trim() || "—";
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
      <td className="w-[100px] overflow-hidden truncate whitespace-nowrap px-2 py-1.5 font-mono text-zinc-500 dark:text-zinc-400">
        {formatCreatedAt(row.created_at)}
      </td>
      <td className="w-[110px] overflow-hidden truncate whitespace-nowrap px-2 py-1.5 font-mono font-medium text-zinc-800 dark:text-zinc-200">
        {formatHoraMarcada(row.hora_marcada)}
      </td>
      <td className="overflow-hidden px-2 py-1.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {priorityLawEnabled && prioStyle ? (
              <span className={`shrink-0 whitespace-nowrap ${prioStyle.badge}`}>{prioStyle.label}</span>
            ) : null}
            <span className="min-w-0 truncate font-medium" title={clientLabel !== "—" ? clientLabel : undefined}>
              {clientLabel}
            </span>
          </div>
          <div className="ml-12 w-[200px] shrink-0 sm:ml-16">
            {notesInline && observacaoText ? (
              <span
                className="block truncate text-[10px] text-zinc-500 dark:text-zinc-400"
                title={observacaoText}
              >
                {observacaoText}
              </span>
            ) : !notesInline && observacaoText ? (
              <Tooltip content={observacaoText} side="top">
                <span className="inline-flex rounded p-0.5 text-zinc-400">
                  <MessageSquareText className="size-3.5" strokeWidth={1.75} aria-hidden />
                </span>
              </Tooltip>
            ) : null}
          </div>
        </div>
      </td>
      {cadastroCategories.map((cat) => {
        const label = docasLogisticsActive
          ? resolveDocasCategoryDisplay(
              cat.id,
              row.observacao,
              row.cadastro_valores ?? {},
              cadastroLookups,
              cadastroCategories,
              legacyCtx
            )
          : aviacaoLogisticsActive
            ? resolveAviacaoCategoryDisplay(
                cat.id,
                row.observacao,
                row.cadastro_valores ?? {},
                cadastroLookups,
                cadastroCategories,
                legacyCtx
              )
            : resolveCategoryDisplayLabel(
              cat.id,
              row.cadastro_valores ?? {},
              cadastroLookups,
              cadastroCategories,
              undefined,
              legacyCtx
            );
        return (
          <td
            key={cat.id}
            className="w-32 overflow-hidden truncate px-2 py-1.5 text-zinc-700 dark:text-zinc-300"
            title={label ?? undefined}
          >
            {label ?? "—"}
          </td>
        );
      })}
      <td
        className={`w-24 overflow-hidden truncate px-2 py-1.5 capitalize ${queueStatusStyle(normalizeQueueStatusLabel(row.status))}`}
      >
        {normalizeQueueStatusLabel(row.status)}
      </td>
      <td className="w-[88px] px-2 py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          title="Copiar resumo"
          className="inline-flex rounded p-0.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-zinc-50"
          onClick={() => onCopyRow(row)}
        >
          <Copy className="size-3.5" strokeWidth={1.75} />
          <span className="sr-only">Copiar resumo</span>
        </button>
        <button
          type="button"
          title="Imprimir ficha"
          className="inline-flex rounded p-0.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-zinc-50"
          onClick={() => onPrintRow(row)}
        >
          <Printer className="size-3.5" strokeWidth={1.75} />
          <span className="sr-only">Imprimir ficha</span>
        </button>
        <button
          type="button"
          title="Editar"
          className="ml-0.5 inline-flex rounded p-0.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-zinc-50"
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
  onPrintRow: (row: AtendimentoLite) => void;
  viewMode: QueueViewMode;
  onViewModeChange: (mode: QueueViewMode) => void;
  onObservacoesVisibilityChange: (visibility: ObservacoesVisibility) => void;
  onDeleteRow: (row: AtendimentoLite) => void | Promise<void>;
  docasLogisticsActive?: boolean;
  docasStepLabel?: string | null;
  docasCurrentStep?: DocasQueueTabId | null;
  docasCanGoPrev?: boolean;
  docasCanGoNext?: boolean;
  docasStepperDisabled?: boolean;
  onDocasStepPrev?: () => void;
  onDocasStepNext?: () => void;
  aviacaoLogisticsActive?: boolean;
  mroSegmentId?: string | null;
  aviacaoHangarLabel?: string | null;
  aviacaoCanGoPrev?: boolean;
  aviacaoCanGoNext?: boolean;
  aviacaoStepperDisabled?: boolean;
  onAviacaoStepPrev?: () => void;
  onAviacaoStepNext?: () => void;
  aviacaoFilterPriorityOnly?: boolean;
  onAviacaoFilterPriorityOnlyChange?: (v: boolean) => void;
  aviacaoHideAguardandoPecas?: boolean;
  onAviacaoHideAguardandoPecasChange?: (v: boolean) => void;
  aviacaoSelectedHangarIds?: string[];
  onAviacaoSelectedHangarIdsChange?: (ids: string[]) => void;
  aviacaoHangarFilterOptions?: Array<{ id: string; nome: string | null }>;
  onAviacaoQuickAddHangar?: () => void;
  onAviacaoQuickAddServicos?: () => void;
  onAviacaoQuickAddBase?: () => void;
  onAviacaoQuickAddEquipe?: () => void;
  queueSearchQuery?: string;
  onQueueSearchQueryChange?: (query: string) => void;
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
  onPrintRow,
  viewMode,
  onViewModeChange,
  onObservacoesVisibilityChange,
  onDeleteRow,
  docasLogisticsActive = false,
  docasStepLabel = null,
  docasCurrentStep = null,
  docasCanGoPrev = false,
  docasCanGoNext = false,
  docasStepperDisabled = false,
  onDocasStepPrev,
  onDocasStepNext,
  aviacaoLogisticsActive = false,
  mroSegmentId = null,
  aviacaoHangarLabel = null,
  aviacaoCanGoPrev = false,
  aviacaoCanGoNext = false,
  aviacaoStepperDisabled = false,
  onAviacaoStepPrev,
  onAviacaoStepNext,
  aviacaoFilterPriorityOnly = false,
  onAviacaoFilterPriorityOnlyChange,
  aviacaoHideAguardandoPecas = false,
  onAviacaoHideAguardandoPecasChange,
  aviacaoSelectedHangarIds = [],
  onAviacaoSelectedHangarIdsChange,
  aviacaoHangarFilterOptions = [],
  onAviacaoQuickAddHangar,
  onAviacaoQuickAddServicos,
  onAviacaoQuickAddBase,
  onAviacaoQuickAddEquipe,
  queueSearchQuery = "",
  onQueueSearchQueryChange,
}: QueueSectionProps) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [isCompactView, setIsCompactView] = useState(false);
  const enabledCategories = cadastroCategories.filter((c) => c.enabled);
  const notesInline = observacoesVisibility === "always";
  const colSpan = 4 + enabledCategories.length;
  const compactKanbanActive = viewMode === "kanban" && isCompactView;

  const flowTabs = useMemo(() => queueTabs.filter((t) => t.preset !== "todos"), [queueTabs]);
  const mroProfile = useMemo(() => resolveMroProfile(mroSegmentId), [mroSegmentId]);

  const isTabActive = useCallback(
    (tabId: string) =>
      aviacaoLogisticsActive
        ? isAviacaoQueueTabSelected(queueTabId, tabId, mroSegmentId)
        : queueTabId === tabId,
    [aviacaoLogisticsActive, queueTabId, mroSegmentId]
  );

  const searchedRows = useMemo(() => {
    if (!aviacaoLogisticsActive || !queueSearchQuery.trim()) return rows;
    return rows.filter((r) => rowMatchesMroQueueSearch(r, queueSearchQuery));
  }, [rows, aviacaoLogisticsActive, queueSearchQuery]);

  const filterRowsForTab = useCallback(
    (tab: QueueTabEntry) => {
      if (aviacaoLogisticsActive) {
        return filterAndSortMroQueue(searchedRows, tab, mroSegmentId);
      }
      return filterAndSortQueue(searchedRows, tab, { priorityLawEnabled });
    },
    [aviacaoLogisticsActive, searchedRows, mroSegmentId, priorityLawEnabled]
  );

  const handleCopyRow = useCallback(
    async (row: AtendimentoLite) => {
      const text = buildAtendimentoShareSummary(row, {
        cadastroCategories: enabledCategories,
        cadastroLookups,
        segmentoAplicado: mroSegmentId,
        queueTabIds: queueTabs,
      });
      const ok = await copyAtendimentoShareSummary(text);
      setCopyFeedback(ok ? "Resumo copiado!" : "Não foi possível copiar.");
      window.setTimeout(() => setCopyFeedback(null), 1800);
    },
    [enabledCategories, cadastroLookups, mroSegmentId, queueTabs]
  );

  const activeTab = useMemo(() => {
    const exact = queueTabs.find((t) => t.id === queueTabId);
    if (exact) return exact;
    const matched = queueTabs.find((t) => isTabActive(t.id));
    return matched ?? queueTabs[0];
  }, [queueTabs, queueTabId, isTabActive]);

  const listRows = useMemo(() => {
    const tab = activeTab ?? { id: "tab-ordem", preset: "ordem" as const, label: "Ordem" };
    return filterRowsForTab(tab);
  }, [activeTab, filterRowsForTab]);

  const kanbanColumns = flowTabs;

  const visibleKanbanColumns = useMemo(() => {
    if (!aviacaoLogisticsActive || queueTabId === TODOS_QUEUE_TAB.id) return kanbanColumns;
    const active = kanbanColumns.find((t) => isTabActive(t.id));
    return active ? [active] : kanbanColumns;
  }, [aviacaoLogisticsActive, kanbanColumns, queueTabId, isTabActive]);

  const columnRows = useMemo(() => {
    const map: Record<string, AtendimentoLite[]> = {};
    for (const tab of kanbanColumns) {
      map[tab.id] = filterRowsForTab(tab);
    }
    return map;
  }, [kanbanColumns, filterRowsForTab]);

  async function handleDelete(row: AtendimentoLite) {
    if (!confirm(`Excluir registro de “${row.nome ?? "cliente"}”?`)) return;
    setDeleting(row.id);
    try {
      await onDeleteRow(row);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <TooltipProvider>
    <div
      id={id}
      className="flex h-full min-h-0 w-full max-w-full flex-1 flex-col overflow-x-hidden overflow-y-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="shrink-0 border-b border-zinc-200 px-2 py-2 dark:border-zinc-800">
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex min-w-0 shrink-0 items-center gap-1.5">
            <h2 className="shrink-0 text-xs font-semibold text-zinc-800 dark:text-zinc-100">Fila em tempo real</h2>
            <button
              type="button"
              title="Configurar fluxo de abas"
              aria-label="Configurar fluxo de abas"
              onClick={onOpenFlowSettings}
              className="flex size-6 shrink-0 items-center justify-center rounded-md border border-zinc-300 text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Plus className="size-3.5" strokeWidth={2} aria-hidden />
            </button>
            {aviacaoLogisticsActive &&
            onAviacaoFilterPriorityOnlyChange &&
            onAviacaoHideAguardandoPecasChange &&
            onAviacaoSelectedHangarIdsChange ? (
              <AviacaoQueueFilterPopover
                priorityOnly={aviacaoFilterPriorityOnly}
                onPriorityOnlyChange={onAviacaoFilterPriorityOnlyChange}
                hideAguardandoPecas={aviacaoHideAguardandoPecas}
                onHideAguardandoPecasChange={onAviacaoHideAguardandoPecasChange}
                selectedHangarIds={aviacaoSelectedHangarIds}
                onSelectedHangarIdsChange={onAviacaoSelectedHangarIdsChange}
                hangarOptions={aviacaoHangarFilterOptions}
              />
            ) : null}
            {aviacaoLogisticsActive &&
            (onAviacaoQuickAddHangar ||
              onAviacaoQuickAddServicos ||
              onAviacaoQuickAddBase ||
              onAviacaoQuickAddEquipe) ? (
              <div className="flex shrink-0 items-center gap-1">
                {onAviacaoQuickAddHangar ? (
                  <button
                    type="button"
                    title={mroProfile.hangarQuickAddButtonTitle}
                    onClick={onAviacaoQuickAddHangar}
                    className="rounded-md border border-zinc-300 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    {mroProfile.hangarQuickAddButtonLabel}
                  </button>
                ) : null}
                {onAviacaoQuickAddServicos ? (
                  <button
                    type="button"
                    title="Cadastrar serviços operacionais"
                    onClick={onAviacaoQuickAddServicos}
                    className="rounded-md border border-zinc-300 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    + Serviços
                  </button>
                ) : null}
                {onAviacaoQuickAddEquipe ? (
                  <button
                    type="button"
                    title={mroProfile.equipeQuickAddButtonTitle}
                    onClick={onAviacaoQuickAddEquipe}
                    className="rounded-md border border-zinc-300 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    {mroProfile.equipeQuickAddButtonLabel}
                  </button>
                ) : null}
                {onQueueSearchQueryChange ? (
                  <label className="relative flex min-w-[9rem] max-w-[12rem] flex-1 items-center">
                    <Search
                      className="pointer-events-none absolute left-1.5 size-3 text-zinc-400"
                      strokeWidth={2}
                      aria-hidden
                    />
                    <input
                      type="search"
                      value={queueSearchQuery}
                      onChange={(e) => onQueueSearchQueryChange(e.target.value)}
                      placeholder="S/N ou cliente…"
                      aria-label="Buscar por S/N ou nome do cliente"
                      className="w-full rounded-md border border-zinc-300 bg-white py-0.5 pl-6 pr-1.5 text-[10px] text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500"
                    />
                  </label>
                ) : null}
                {onAviacaoQuickAddBase ? (
                  <button
                    type="button"
                    title="Cadastrar nova base / aeroporto"
                    onClick={onAviacaoQuickAddBase}
                    className="rounded-md border border-zinc-300 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    + Base
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-center px-1">
            {docasLogisticsActive && docasCurrentStep && docasStepLabel && onDocasStepPrev && onDocasStepNext ? (
              <DocasStatusStepper
                stepLabel={docasStepLabel}
                currentStep={docasCurrentStep}
                canGoPrev={docasCanGoPrev}
                canGoNext={docasCanGoNext}
                disabled={docasStepperDisabled || !selectedId}
                onPrev={onDocasStepPrev}
                onNext={onDocasStepNext}
              />
            ) : null}
            {aviacaoLogisticsActive && aviacaoHangarLabel && onAviacaoStepPrev && onAviacaoStepNext ? (
              <AviacaoHangarStepper
                hangarLabel={aviacaoHangarLabel}
                canGoPrev={aviacaoCanGoPrev}
                canGoNext={aviacaoCanGoNext}
                disabled={aviacaoStepperDisabled || !selectedId}
                onPrev={onAviacaoStepPrev}
                onNext={onAviacaoStepNext}
              />
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {viewMode === "kanban" ? (
              <button
                type="button"
                aria-pressed={isCompactView}
                title={isCompactView ? "Desativar modo compacto" : "Ativar modo compacto"}
                onClick={() => setIsCompactView((v) => !v)}
                className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${
                  isCompactView
                    ? "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300"
                    : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                <LayoutGrid className="size-3" strokeWidth={2} aria-hidden />
                Modo Compacto
              </button>
            ) : null}

            <button
              type="button"
              aria-pressed={notesInline}
              aria-label={notesInline ? "Ocultar observações na fila" : "Mostrar observações na fila"}
              title={notesInline ? "Ocultar observações" : "Mostrar observações"}
              onClick={() => onObservacoesVisibilityChange(notesInline ? "hidden" : "always")}
              className={`flex size-7 items-center justify-center rounded-md border transition ${
                notesInline
                  ? "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300"
                  : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              {notesInline ? (
                <Eye className="size-3.5" strokeWidth={1.75} aria-hidden />
              ) : (
                <EyeOff className="size-3.5" strokeWidth={1.75} aria-hidden />
              )}
            </button>

            <div
              className="flex overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700"
              role="group"
              aria-label="Modo de visualização"
            >
              <button
                type="button"
                onClick={() => onViewModeChange("kanban")}
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
                onClick={() => onViewModeChange("list")}
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

        {copyFeedback ? (
          <p className="mt-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400" role="status">
            {copyFeedback}
          </p>
        ) : null}

        {aviacaoLogisticsActive || viewMode === "list" ? (
          <div
            className="mt-2 flex gap-0.5 overflow-x-auto pb-0.5 sf-scroll-y-hidden"
            role="tablist"
            aria-label="Vistas da fila"
          >
            {queueTabs.map((t) => {
              const count = tabCounts[t.id];
              const tabLabel = aviacaoLogisticsActive
                ? resolveAviacaoKanbanColumnLabel(t, mroSegmentId)
                : t.label;
              const label = typeof count === "number" ? `${tabLabel} (${count})` : tabLabel;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={isTabActive(t.id)}
                  onClick={() =>
                    onQueueTabId(aviacaoLogisticsActive ? resolveAviacaoQueueTabClickId(t.id) : t.id)
                  }
                  className={`shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-medium transition ${
                    isTabActive(t.id)
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
            <table className="w-full min-w-[880px] table-fixed border-collapse text-left text-[11px] text-zinc-800 dark:text-zinc-100">
              <thead className="sticky top-0 z-[1] border-b border-zinc-200 bg-zinc-50 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/95 dark:text-zinc-400">
                <tr>
                  <th className="w-[100px] px-2 py-1.5">Chegada</th>
                  <th className="w-[110px] px-2 py-1.5">Horário marc.</th>
                  <th className="w-[38%] px-2 py-1.5">Cliente</th>
                  {enabledCategories.map((cat) => (
                    <th key={cat.id} className="w-32 px-2 py-1.5">
                      <span className="block truncate" title={cat.label}>
                        {cat.label}
                      </span>
                    </th>
                  ))}
                  <th className="w-24 px-2 py-1.5">Status</th>
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
                      notesInline={notesInline}
                      docasLogisticsActive={docasLogisticsActive}
                      aviacaoLogisticsActive={aviacaoLogisticsActive}
                      cadastroCategories={enabledCategories}
                      cadastroLookups={cadastroLookups}
                      deleting={deleting}
                      onSelectId={onSelectId}
                      onEditRow={onEditRow}
                      onPrintRow={onPrintRow}
                      onCopyRow={(r) => void handleCopyRow(r)}
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
          <div className="flex min-h-0 w-full max-w-full flex-1 flex-col overflow-x-auto overflow-y-hidden pb-3 sf-scroll-x-hover">
            <div className="flex h-full min-h-full w-max min-w-full gap-2">
            {visibleKanbanColumns.map((tab) => {
              const cards = columnRows[tab.id] ?? [];
              const count = tabCounts[tab.id] ?? cards.length;
              const columnLabel = aviacaoLogisticsActive
                ? resolveAviacaoKanbanColumnLabel(tab, mroSegmentId)
                : tab.label;
              return (
                <section
                  key={tab.id}
                  className="flex h-full min-h-0 max-h-full w-[240px] shrink-0 flex-col overflow-hidden bg-zinc-100 dark:bg-zinc-950/50"
                >
                  <header className="shrink-0 border-y border-zinc-200 bg-zinc-100 px-2 py-0.5 dark:border-zinc-700 dark:bg-zinc-800/80">
                    <div className="flex items-center justify-between gap-1">
                      <h3
                        className="truncate text-[8px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300"
                        title={columnLabel}
                      >
                        {columnLabel}
                      </h3>
                      <span className="shrink-0 font-mono text-[8px] font-medium leading-none text-zinc-500 dark:text-zinc-400">
                        {count}
                      </span>
                    </div>
                  </header>

                  <div className="sf-scroll-y-hidden h-0 min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-zinc-100 p-1 dark:bg-zinc-900/60">
                    {cards.length === 0 ? (
                      <p className="py-6 text-center text-[9px] text-zinc-400 dark:text-zinc-500">—</p>
                    ) : (
                      <div className={`flex flex-col ${compactKanbanActive ? "gap-0.5" : "gap-1"}`}>
                        {cards.map((row) => (
                          <KanbanCard
                            key={row.id}
                            row={row}
                            isSel={row.id === selectedId}
                            isCompactView={compactKanbanActive}
                            priorityLawEnabled={priorityLawEnabled}
                            notesInline={notesInline}
                            aviacaoLogisticsActive={aviacaoLogisticsActive}
                            docasLogisticsActive={docasLogisticsActive}
                            segmentoId={mroSegmentId}
                            meta={resolveKanbanMeta(
                              row,
                              enabledCategories,
                              cadastroLookups,
                              docasLogisticsActive,
                              aviacaoLogisticsActive
                            )}
                            deleting={deleting}
                            onSelectId={onSelectId}
                            onEditRow={onEditRow}
                            onPrintRow={onPrintRow}
                            onCopyRow={(r) => void handleCopyRow(r)}
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
