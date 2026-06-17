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
import {
  SALAO_TAB,
  buildSalaoProfissionalKanbanColumns,
  buildSalaoProfissionalListTabs,
  filterAndSortSalaoProfissionalKanbanColumn,
  filterAndSortSalaoQueue,
  filterSalaoProfissionalListTabRows,
  filterSalaoProfissionalListTabRowsById,
  isSalaoPoolTabId,
  isSalaoProfissionalListTodosTab,
  isSalaoQueueTabSelected,
  isSalaoWaitingStatus,
  normalizeSalaoStatusLabel,
  resolveSalaoCategoryDisplay,
  resolveSalaoKanbanColumnLabel,
  resolveSalaoKanbanMeta,
  resolveSalaoHoraMarcadaBadgeMeta,
  resolveSalaoProfissionalListActiveTab,
  resolveSalaoProfissionalListDefaultTabId,
  resolveSalaoQueueTabClickId,
  rowMatchesSalaoQueueSearch,
  type SalaoProfissionalKanbanColumn,
} from "@/lib/salao-estetica-logistics";
import { buildAtendimentoShareSummary, copyAtendimentoShareSummary } from "@/lib/atendimento-share-summary";
import { isMroPatioCompactSegment } from "@/lib/mro-segment-profile";
import { resolveDocasCategoryDisplay, resolveDocasKanbanMeta } from "@/lib/docas-logistics";
import { type CadastroCategoryEntry, type ObservacoesVisibility, type QueueTabEntry } from "@/lib/tenant-config";
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
  ChevronsUp,
  ChevronDown,
  ChevronUp,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { formatObservacaoForDisplay } from "@/lib/fila-preset";
import {
  SalaoProUpsellModal,
  type SalaoProUpsellContext,
} from "@/components/screenflow/salao-pro-upsell-modal";
import { SalaoProWalletButton } from "@/components/screenflow/salao-pro-wallet-button";

export type QueueViewMode = "list" | "kanban";

function queueStatusStyle(label: string): string {
  const l = label.toLowerCase();
  if (l === "próximo" || l === "proximo") return "text-violet-700 dark:text-violet-400";
  if (l === "chamado") return "text-sky-700 dark:text-sky-400";
  if (l === "rechamado" || l === "em atendimento") return "text-amber-700 dark:text-amber-400";
  return "text-zinc-600 dark:text-zinc-400";
}

function resolveKanbanMeta(
  row: AtendimentoLite,
  cadastroCategories: CadastroCategoryEntry[],
  cadastroLookups: CadastroLookups,
  docasLogisticsActive: boolean,
  aviacaoLogisticsActive: boolean,
  salaoEsteticaActive: boolean
): {
  title: string;
  profissional: string | null;
  local: string | null;
  servico: string | null;
  docaAlocada?: string | null;
  hangarAlocado?: string | null;
  salaoTotalLabel?: string | null;
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
  if (salaoEsteticaActive) {
    const meta = resolveSalaoKanbanMeta(row, cadastroCategories, cadastroLookups);
    return {
      title: meta.title,
      profissional: meta.profissional,
      local: meta.local,
      servico: meta.servico,
      hangarAlocado: meta.cadeiraLabel,
      salaoTotalLabel: meta.salaoTotalLabel,
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
const SALAO_ESTETICA_SEGMENT_ID = "salao_estetica";

function queueListTabButtonClass(isActive: boolean): string {
  return [
    "shrink-0 cursor-pointer whitespace-nowrap rounded-t-md border-b-2 px-3 py-1.5 text-[11px] transition-colors",
    isActive
      ? "border-orange-500 bg-orange-50/60 font-semibold text-orange-700 dark:border-orange-400 dark:bg-orange-950/30 dark:text-orange-300"
      : "border-transparent font-medium text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200",
  ].join(" ");
}

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
  if (
    segmentoId === CLINICAS_SEGMENT_ID ||
    segmentoId === SALAO_ESTETICA_SEGMENT_ID ||
    !segmentoId?.trim()
  ) {
    return {
      primary: meta.title,
      secondary: meta.servico,
      allocated: meta.local ?? meta.hangarAlocado ?? null,
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
  salaoEsteticaActive: boolean;
  segmentoId: string | null | undefined;
  meta: ReturnType<typeof resolveKanbanMeta>;
  deleting: string | null;
  onSelectId: (id: string) => void;
  onEditRow: (row: AtendimentoLite) => void;
  onPrintRow: (row: AtendimentoLite) => void;
  onCopyRow: (row: AtendimentoLite) => void;
  onDelete: (row: AtendimentoLite) => void;
  onSalaoDefinirProximo?: (row: AtendimentoLite) => void;
  kanbanColumnId?: string;
  salaoFilaAtivaIndex?: number;
  salaoFilaAtivaCount?: number;
  onSalaoAtenderAgora?: (row: AtendimentoLite) => void;
  onSalaoMoveFilaUp?: (row: AtendimentoLite) => void;
  onSalaoMoveFilaDown?: (row: AtendimentoLite) => void;
};

const KanbanCard = memo(function KanbanCard({
  row,
  isSel,
  isCompactView,
  priorityLawEnabled,
  notesInline,
  aviacaoLogisticsActive,
  docasLogisticsActive,
  salaoEsteticaActive,
  segmentoId,
  meta,
  deleting,
  onSelectId,
  onEditRow,
  onPrintRow,
  onCopyRow,
  onDelete,
  onSalaoDefinirProximo,
  kanbanColumnId,
  salaoFilaAtivaIndex = -1,
  salaoFilaAtivaCount = 0,
  onSalaoAtenderAgora,
  onSalaoMoveFilaUp,
  onSalaoMoveFilaDown,
}: KanbanCardProps) {
  const prioStyle = priorityLawEnabled
    ? classificacaoBadgeStyle(row.classificacao_prioridade, row.prioridade)
    : null;
  const statusLabel = salaoEsteticaActive
    ? normalizeSalaoStatusLabel(row.status)
    : normalizeQueueStatusLabel(row.status);
  const clientName = meta.title;
  const contextLine = formatKanbanContextLine(meta);
  const horaMarcadaLabel = row.hora_marcada ? formatHoraMarcada(row.hora_marcada) : null;
  const horaMarcadaBadge = resolveSalaoHoraMarcadaBadgeMeta(salaoEsteticaActive);
  const observacaoText = aviacaoLogisticsActive
    ? formatAviacaoObservacaoForDisplay(row.observacao)
    : formatObservacaoForDisplay(row.observacao);
  const isSalaoFilaAtivaColumn = salaoEsteticaActive && kanbanColumnId === SALAO_TAB.FILA_ATIVA;
  const isSalaoPoolColumn =
    salaoEsteticaActive && kanbanColumnId != null && isSalaoPoolTabId(kanbanColumnId);

  const cardShellClass = `group cursor-pointer border-l-2 bg-white text-left transition hover:bg-zinc-50/90 dark:bg-zinc-900 dark:hover:bg-zinc-800/40 ${
    isSel
      ? "border-l-orange-500 bg-orange-50/30 dark:bg-orange-950/15"
      : "border-l-zinc-300 dark:border-l-zinc-600"
  } ${isCompactView ? "px-2 py-1" : "px-2 py-1.5"}`;

  const actionButtons = (
    <div className="flex shrink-0 items-center gap-px" onClick={(e) => e.stopPropagation()}>
      {isSalaoFilaAtivaColumn && onSalaoMoveFilaUp && salaoFilaAtivaIndex > 0 ? (
        <button
          type="button"
          title="Subir na fila"
          className="inline-flex rounded p-0.5 text-zinc-400 transition hover:text-zinc-700 dark:hover:text-zinc-200"
          onClick={() => onSalaoMoveFilaUp(row)}
        >
          <ChevronUp className="size-3.5" strokeWidth={2} />
          <span className="sr-only">Subir</span>
        </button>
      ) : null}
      {isSalaoFilaAtivaColumn && onSalaoMoveFilaDown && salaoFilaAtivaIndex >= 0 && salaoFilaAtivaIndex < salaoFilaAtivaCount - 1 ? (
        <button
          type="button"
          title="Descer na fila"
          className="inline-flex rounded p-0.5 text-zinc-400 transition hover:text-zinc-700 dark:hover:text-zinc-200"
          onClick={() => onSalaoMoveFilaDown(row)}
        >
          <ChevronDown className="size-3.5" strokeWidth={2} />
          <span className="sr-only">Descer</span>
        </button>
      ) : null}
      {isSalaoPoolColumn && onSalaoAtenderAgora ? (
        <button
          type="button"
          title="Atender Agora"
          className="inline-flex rounded px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
          onClick={() => onSalaoAtenderAgora(row)}
        >
          Atender
        </button>
      ) : null}
      {salaoEsteticaActive && onSalaoDefinirProximo && isSalaoWaitingStatus(row.status) && !isSalaoPoolColumn && !isSalaoFilaAtivaColumn ? (
        <button
          type="button"
          title="Definir como Próximo"
          className="inline-flex rounded p-0.5 text-sky-600 transition hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-200"
          onClick={() => onSalaoDefinirProximo(row)}
        >
          <ChevronsUp className="size-3.5" strokeWidth={2} />
          <span className="sr-only">Definir como Próximo</span>
        </button>
      ) : null}
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
            title={`${horaMarcadaBadge.titlePrefix}: ${horaMarcadaLabel}`}
          >
            {horaMarcadaBadge.prefix} {horaMarcadaLabel}
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
            {salaoEsteticaActive && meta.salaoTotalLabel ? (
              <span
                className="shrink-0 truncate text-[9px] font-bold uppercase leading-none tracking-wide text-emerald-700 dark:text-emerald-400"
                title={`Total: ${meta.salaoTotalLabel}`}
              >
                TOTAL: {meta.salaoTotalLabel}
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
          title={`${horaMarcadaBadge.titlePrefix}: ${horaMarcadaLabel}`}
        >
          {horaMarcadaBadge.prefix} {horaMarcadaLabel}
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
        {salaoEsteticaActive ? (
          <>
            {meta.servico ? (
              <p
                className="truncate text-[9px] uppercase leading-tight tracking-wide text-zinc-500 dark:text-zinc-400"
                title={meta.servico}
              >
                {meta.servico}
              </p>
            ) : null}
            {meta.profissional ? (
              <p
                className="truncate text-[9px] uppercase leading-tight tracking-wide text-zinc-600 dark:text-zinc-300"
                title={meta.profissional}
              >
                {meta.profissional}
              </p>
            ) : null}
            {meta.local ? (
              <p
                className="truncate text-[9px] font-semibold uppercase leading-tight tracking-wide text-orange-700 dark:text-orange-400"
                title={meta.local}
              >
                {meta.local}
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
            {salaoEsteticaActive && meta.salaoTotalLabel ? (
              <p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                TOTAL: {meta.salaoTotalLabel}
              </p>
            ) : null}
          </>
        ) : (
          <>
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
          </>
        )}
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
  salaoEsteticaActive: boolean;
  cadastroCategories: CadastroCategoryEntry[];
  cadastroLookups: CadastroLookups;
  deleting: string | null;
  onSelectId: (id: string) => void;
  onEditRow: (row: AtendimentoLite) => void;
  onPrintRow: (row: AtendimentoLite) => void;
  onCopyRow: (row: AtendimentoLite) => void;
  onDelete: (row: AtendimentoLite) => void;
  onSalaoDefinirProximo?: (row: AtendimentoLite) => void;
  listTabId?: string;
  salaoFilaAtivaIndex?: number;
  salaoFilaAtivaCount?: number;
  onSalaoAtenderAgora?: (row: AtendimentoLite) => void;
  onSalaoMoveFilaUp?: (row: AtendimentoLite) => void;
  onSalaoMoveFilaDown?: (row: AtendimentoLite) => void;
};

const QueueRow = memo(function QueueRow({
  row,
  isSel,
  priorityLawEnabled,
  notesInline,
  docasLogisticsActive,
  aviacaoLogisticsActive,
  salaoEsteticaActive,
  cadastroCategories,
  cadastroLookups,
  deleting,
  onSelectId,
  onEditRow,
  onPrintRow,
  onCopyRow,
  onDelete,
  onSalaoDefinirProximo,
  listTabId,
  salaoFilaAtivaIndex = -1,
  salaoFilaAtivaCount = 0,
  onSalaoAtenderAgora,
  onSalaoMoveFilaUp,
  onSalaoMoveFilaDown,
}: QueueRowProps) {
  const prioStyle = priorityLawEnabled
    ? classificacaoBadgeStyle(row.classificacao_prioridade, row.prioridade)
    : null;
  const statusLabel = salaoEsteticaActive
    ? normalizeSalaoStatusLabel(row.status)
    : normalizeQueueStatusLabel(row.status);
  const observacaoText = aviacaoLogisticsActive
    ? formatAviacaoObservacaoForDisplay(row.observacao)
    : formatObservacaoForDisplay(row.observacao);
  const isSalaoFilaAtivaList = salaoEsteticaActive && listTabId === SALAO_TAB.FILA_ATIVA;
  const isSalaoPoolList = salaoEsteticaActive && listTabId != null && isSalaoPoolTabId(listTabId);
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
            : salaoEsteticaActive
              ? resolveSalaoCategoryDisplay(
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
        className={`w-24 overflow-hidden truncate px-2 py-1.5 capitalize ${queueStatusStyle(statusLabel)}`}
      >
        {statusLabel}
      </td>
      <td className="w-[108px] px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-row items-center justify-end gap-1">
        {isSalaoFilaAtivaList && onSalaoMoveFilaUp && salaoFilaAtivaIndex > 0 ? (
          <button
            type="button"
            title="Subir na fila"
            className="inline-flex shrink-0 rounded p-0.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-zinc-50"
            onClick={() => onSalaoMoveFilaUp(row)}
          >
            <ChevronUp className="size-3.5" strokeWidth={2} />
            <span className="sr-only">Subir</span>
          </button>
        ) : null}
        {isSalaoFilaAtivaList && onSalaoMoveFilaDown && salaoFilaAtivaIndex >= 0 && salaoFilaAtivaIndex < salaoFilaAtivaCount - 1 ? (
          <button
            type="button"
            title="Descer na fila"
            className="inline-flex shrink-0 rounded p-0.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-zinc-50"
            onClick={() => onSalaoMoveFilaDown(row)}
          >
            <ChevronDown className="size-3.5" strokeWidth={2} />
            <span className="sr-only">Descer</span>
          </button>
        ) : null}
        {isSalaoPoolList && onSalaoAtenderAgora ? (
          <button
            type="button"
            title="Atender Agora"
            className="inline-flex shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
            onClick={() => onSalaoAtenderAgora(row)}
          >
            Atender
          </button>
        ) : null}
        {salaoEsteticaActive && onSalaoDefinirProximo && isSalaoWaitingStatus(row.status) && !isSalaoPoolList && !isSalaoFilaAtivaList ? (
          <button
            type="button"
            title="Definir como Próximo"
            className="inline-flex shrink-0 rounded p-0.5 text-sky-600 hover:bg-sky-50 hover:text-sky-800 dark:text-sky-400 dark:hover:bg-sky-950/40"
            onClick={() => onSalaoDefinirProximo(row)}
          >
            <ChevronsUp className="size-3.5" strokeWidth={2} />
            <span className="sr-only">Definir como Próximo</span>
          </button>
        ) : null}
        <button
          type="button"
          title="Copiar resumo"
          className="inline-flex shrink-0 rounded p-0.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-zinc-50"
          onClick={() => onCopyRow(row)}
        >
          <Copy className="size-3.5" strokeWidth={1.75} />
          <span className="sr-only">Copiar resumo</span>
        </button>
        <button
          type="button"
          title="Imprimir ficha"
          className="inline-flex shrink-0 rounded p-0.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-zinc-50"
          onClick={() => onPrintRow(row)}
        >
          <Printer className="size-3.5" strokeWidth={1.75} />
          <span className="sr-only">Imprimir ficha</span>
        </button>
        <button
          type="button"
          title="Editar"
          className="inline-flex shrink-0 rounded p-0.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-zinc-50"
          onClick={() => onEditRow(row)}
        >
          <Pencil className="size-3.5" strokeWidth={1.75} />
          <span className="sr-only">Editar</span>
        </button>
        <button
          type="button"
          title="Excluir"
          disabled={deleting === row.id}
          className="inline-flex shrink-0 rounded p-0.5 text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-950/50"
          onClick={() => onDelete(row)}
        >
          <Trash2 className="size-3.5" strokeWidth={1.75} />
          <span className="sr-only">Excluir</span>
        </button>
        </div>
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
  salaoEsteticaActive?: boolean;
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
  onSalaoQuickAddProfissional?: () => void;
  onSalaoQuickAddLocal?: () => void;
  onSalaoQuickAddServicos?: () => void;
  queueSearchQuery?: string;
  onQueueSearchQueryChange?: (query: string) => void;
  onQueueSearchMatch?: (row: AtendimentoLite) => void;
  onSalaoDefinirProximo?: (row: AtendimentoLite) => void;
  onSalaoAtenderAgora?: (row: AtendimentoLite) => void;
  onSalaoMoveFilaUp?: (row: AtendimentoLite) => void;
  onSalaoMoveFilaDown?: (row: AtendimentoLite) => void;
  /** Espelho diário por profissional (preset salao_estetica). */
  salaoProfissionalMirror?: boolean;
  /** Exibir aba TODOS no espelho (modo Lista/Kanban salão). */
  showTodosTab?: boolean;
  /** Pool ampliado para busca (agenda passado/futuro) — preset salao_estetica. */
  salaoSearchRows?: AtendimentoLite[];
  /** Exibe ícones de carteira PRO (salão, plano free). */
  salaoProPaywallActive?: boolean;
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
  salaoEsteticaActive = false,
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
  onSalaoQuickAddProfissional,
  onSalaoQuickAddLocal,
  onSalaoQuickAddServicos,
  queueSearchQuery = "",
  onQueueSearchQueryChange,
  onQueueSearchMatch,
  onSalaoDefinirProximo,
  onSalaoAtenderAgora,
  onSalaoMoveFilaUp,
  onSalaoMoveFilaDown,
  salaoProfissionalMirror = false,
  showTodosTab = true,
  salaoSearchRows,
  salaoProPaywallActive = false,
}: QueueSectionProps) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [salaoUpsellOpen, setSalaoUpsellOpen] = useState(false);
  const [salaoUpsellContext, setSalaoUpsellContext] = useState<SalaoProUpsellContext>("daily");
  const lastSearchOpenRef = useRef<string | null>(null);
  const [isCompactView, setIsCompactView] = useState(false);
  const enabledCategories = cadastroCategories.filter((c) => c.enabled);
  const notesInline = observacoesVisibility === "always";
  const colSpan = 4 + enabledCategories.length;
  const compactKanbanActive = viewMode === "kanban" && isCompactView;

  const flowTabs = useMemo(() => queueTabs.filter((t) => t.preset !== "todos"), [queueTabs]);
  const mroProfile = useMemo(() => resolveMroProfile(mroSegmentId), [mroSegmentId]);

  const salaoProfissionalColumns = useMemo(() => {
    if (!salaoProfissionalMirror) return [] as SalaoProfissionalKanbanColumn[];
    return buildSalaoProfissionalKanbanColumns(cadastroLookups, rows);
  }, [salaoProfissionalMirror, cadastroLookups, rows]);

  const salaoListTabs = useMemo(() => {
    if (!salaoProfissionalMirror) return [];
    return buildSalaoProfissionalListTabs(salaoProfissionalColumns, showTodosTab);
  }, [salaoProfissionalMirror, salaoProfissionalColumns, showTodosTab]);

  const salaoSearchPool = useMemo(() => {
    if (!salaoEsteticaActive) return rows;
    if (salaoSearchRows && salaoSearchRows.length > 0) return salaoSearchRows;
    return rows;
  }, [salaoEsteticaActive, rows, salaoSearchRows]);

  const isTabActive = useCallback(
    (tabId: string) => {
      if (salaoProfissionalMirror) {
        return queueTabId === tabId;
      }
      if (aviacaoLogisticsActive) {
        return isAviacaoQueueTabSelected(queueTabId, tabId, mroSegmentId);
      }
      if (salaoEsteticaActive) {
        return isSalaoQueueTabSelected(queueTabId, tabId);
      }
      return queueTabId === tabId;
    },
    [salaoProfissionalMirror, aviacaoLogisticsActive, salaoEsteticaActive, queueTabId, mroSegmentId]
  );

  const filterRowsForTab = useCallback(
    (tab: QueueTabEntry) => {
      if (aviacaoLogisticsActive) {
        return filterAndSortMroQueue(rows, tab, mroSegmentId);
      }
      if (salaoEsteticaActive && !salaoProfissionalMirror) {
        return filterAndSortSalaoQueue(rows, tab, queueTabs);
      }
      return filterAndSortQueue(rows, tab, { priorityLawEnabled });
    },
    [
      aviacaoLogisticsActive,
      salaoEsteticaActive,
      salaoProfissionalMirror,
      rows,
      queueTabs,
      mroSegmentId,
      priorityLawEnabled,
    ]
  );

  useEffect(() => {
    if ((!aviacaoLogisticsActive && !salaoEsteticaActive) || !onQueueSearchMatch) return;
    const q = queueSearchQuery.trim();
    if (!q) {
      lastSearchOpenRef.current = null;
      return;
    }
    const timer = window.setTimeout(() => {
      const match = salaoSearchPool.find((r) =>
        salaoEsteticaActive ? rowMatchesSalaoQueueSearch(r, q) : rowMatchesMroQueueSearch(r, q)
      );
      if (!match) return;
      const key = `${q.toLowerCase()}:${match.id}`;
      if (lastSearchOpenRef.current === key) return;
      lastSearchOpenRef.current = key;
      onQueueSearchMatch(match);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [
    queueSearchQuery,
    salaoSearchPool,
    aviacaoLogisticsActive,
    salaoEsteticaActive,
    onQueueSearchMatch,
  ]);

  const handleCopyRow = useCallback(
    async (row: AtendimentoLite) => {
      const text = buildAtendimentoShareSummary(row, {
        cadastroCategories: enabledCategories,
        cadastroLookups,
        segmentoAplicado: salaoEsteticaActive ? SALAO_ESTETICA_SEGMENT_ID : mroSegmentId,
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

  const activeSalaoListTab = useMemo(() => {
    if (!salaoProfissionalMirror || salaoListTabs.length === 0) return null;
    return resolveSalaoProfissionalListActiveTab(salaoListTabs, queueTabId);
  }, [salaoProfissionalMirror, salaoListTabs, queueTabId]);

  const listRows = useMemo(() => {
    if (salaoProfissionalMirror && activeSalaoListTab) {
      return filterSalaoProfissionalListTabRows(rows, activeSalaoListTab);
    }
    if (salaoProfissionalMirror) {
      return filterSalaoProfissionalListTabRowsById(rows, queueTabId);
    }
    const tab = activeTab ?? { id: "tab-ordem", preset: "ordem" as const, label: "Ordem" };
    return filterRowsForTab(tab);
  }, [salaoProfissionalMirror, activeSalaoListTab, rows, queueTabId, activeTab, filterRowsForTab]);

  const isSalaoListPaymentTab =
    salaoProfissionalMirror &&
    activeSalaoListTab != null &&
    !isSalaoProfissionalListTodosTab(activeSalaoListTab) &&
    activeSalaoListTab.kind === "aguardando_pagamento";

  const kanbanColumns = salaoProfissionalMirror ? [] : flowTabs;

  const salaoProfissionalColumnRows = useMemo(() => {
    if (!salaoProfissionalMirror) return {} as Record<string, AtendimentoLite[]>;
    const map: Record<string, AtendimentoLite[]> = {};
    for (const column of salaoProfissionalColumns) {
      map[column.id] = filterAndSortSalaoProfissionalKanbanColumn(rows, column);
    }
    return map;
  }, [salaoProfissionalMirror, salaoProfissionalColumns, rows]);

  const columnRows = useMemo(() => {
    if (salaoProfissionalMirror) return salaoProfissionalColumnRows;
    const map: Record<string, AtendimentoLite[]> = {};
    for (const tab of kanbanColumns) {
      map[tab.id] = filterRowsForTab(tab);
    }
    return map;
  }, [salaoProfissionalMirror, salaoProfissionalColumnRows, kanbanColumns, filterRowsForTab]);

  async function handleDelete(row: AtendimentoLite) {
    if (!confirm(`Excluir registro de “${row.nome ?? "cliente"}”?`)) return;
    setDeleting(row.id);
    try {
      await onDeleteRow(row);
    } finally {
      setDeleting(null);
    }
  }

  const handleViewModeChange = useCallback(
    (mode: QueueViewMode) => {
      if (salaoProfissionalMirror) {
        onQueueTabId(
          resolveSalaoProfissionalListDefaultTabId(salaoProfissionalColumns, showTodosTab)
        );
      }
      onViewModeChange(mode);
    },
    [salaoProfissionalMirror, salaoProfissionalColumns, showTodosTab, onQueueTabId, onViewModeChange]
  );

  const openSalaoProUpsell = useCallback((context: SalaoProUpsellContext) => {
    setSalaoUpsellContext(context);
    setSalaoUpsellOpen(true);
  }, []);

  const showSalaoProfWallet =
    salaoProPaywallActive && salaoEsteticaActive && salaoProfissionalMirror;

  return (
    <TooltipProvider>
    <div
      id={id}
      className="relative flex h-full min-h-0 w-full max-w-full flex-1 flex-col overflow-x-hidden overflow-y-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      {copyFeedback ? (
        <div
          role="status"
          className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 whitespace-nowrap rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-800 shadow-md dark:border-emerald-900/60 dark:bg-emerald-950/95 dark:text-emerald-200"
        >
          {copyFeedback}
        </div>
      ) : null}
      <div className="shrink-0 border-b border-zinc-200 px-2 py-2 dark:border-zinc-800">
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex min-w-0 shrink-0 items-center gap-1.5">
            <h2 className="shrink-0 text-xs font-semibold text-zinc-800 dark:text-zinc-100">
              {salaoProfissionalMirror ? "Espelho de Profissionais" : "Fila em tempo real"}
            </h2>
            {!salaoProfissionalMirror ? (
            <button
              type="button"
              title="Configurar fluxo de abas"
              aria-label="Configurar fluxo de abas"
              onClick={onOpenFlowSettings}
              className="flex size-6 shrink-0 items-center justify-center rounded-md border border-zinc-300 text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Plus className="size-3.5" strokeWidth={2} aria-hidden />
            </button>
            ) : null}
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
            {salaoEsteticaActive && onQueueSearchQueryChange ? (
              <label className="relative flex min-w-[9rem] max-w-[12rem] shrink-0 items-center">
                <Search
                  className="pointer-events-none absolute left-1.5 size-3 text-zinc-400"
                  strokeWidth={2}
                  aria-hidden
                />
                <input
                  type="search"
                  value={queueSearchQuery}
                  onChange={(e) => onQueueSearchQueryChange(e.target.value)}
                  placeholder="Nome do cliente…"
                  aria-label="Buscar por nome do cliente"
                  className="w-full rounded-md border border-zinc-300 bg-white py-0.5 pl-6 pr-1.5 text-[10px] text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500"
                />
              </label>
            ) : null}
            {salaoEsteticaActive &&
            (onSalaoQuickAddProfissional || onSalaoQuickAddLocal || onSalaoQuickAddServicos) ? (
              <div className="flex shrink-0 items-center gap-1">
                {onSalaoQuickAddProfissional ? (
                  <button
                    type="button"
                    title="Cadastrar profissional"
                    onClick={onSalaoQuickAddProfissional}
                    className="rounded-md border border-zinc-300 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    + Profissional
                  </button>
                ) : null}
                {onSalaoQuickAddLocal ? (
                  <button
                    type="button"
                    title="Cadastrar cadeira ou sala de atendimento"
                    onClick={onSalaoQuickAddLocal}
                    className="rounded-md border border-zinc-300 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    + Cadeira / Sala
                  </button>
                ) : null}
                {onSalaoQuickAddServicos ? (
                  <button
                    type="button"
                    title="Cadastrar serviços"
                    onClick={onSalaoQuickAddServicos}
                    className="rounded-md border border-zinc-300 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    + Serviços
                  </button>
                ) : null}
              </div>
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
                onClick={() => handleViewModeChange("kanban")}
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
                onClick={() => handleViewModeChange("list")}
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
            className="mt-2 flex gap-1 overflow-x-auto border-b border-zinc-200 pb-0 sf-scroll-y-hidden dark:border-zinc-800"
            role="tablist"
            aria-label="Vistas da fila"
          >
            {salaoProfissionalMirror
              ? salaoListTabs.map((tab) => {
                  const count = tabCounts[tab.id];
                  const tabLabel = tab.label.toUpperCase();
                  const label = typeof count === "number" ? `${tabLabel} (${count})` : tabLabel;
                  const active = isTabActive(tab.id);
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => onQueueTabId(tab.id)}
                      className={queueListTabButtonClass(active)}
                    >
                      <span className="inline-flex items-center gap-1">
                        <span>{label}</span>
                        {showSalaoProfWallet && tab.kind === "profissional" ? (
                          <SalaoProWalletButton
                            tooltip="Faturamento diário (PRO)"
                            onClick={() => openSalaoProUpsell("daily")}
                            iconClassName="size-3"
                          />
                        ) : null}
                      </span>
                    </button>
                  );
                })
              : queueTabs.map((t) => {
              const count = tabCounts[t.id];
              const tabLabel = aviacaoLogisticsActive
                ? resolveAviacaoKanbanColumnLabel(t, mroSegmentId)
                : salaoEsteticaActive
                  ? (t.label?.trim() || resolveSalaoKanbanColumnLabel(t))
                  : t.label;
              const label = typeof count === "number" ? `${tabLabel} (${count})` : tabLabel;
              const active = isTabActive(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() =>
                    onQueueTabId(
                      aviacaoLogisticsActive
                        ? resolveAviacaoQueueTabClickId(t.id, mroSegmentId)
                        : salaoEsteticaActive
                          ? resolveSalaoQueueTabClickId(t.id)
                          : t.id
                    )
                  }
                  className={queueListTabButtonClass(active)}
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
          salaoProfissionalMirror && salaoProfissionalColumns.length === 0 ? (
            <p className="flex flex-1 items-center justify-center text-xs text-zinc-500">
              Nenhum profissional cadastrado para este tenant.
            </p>
          ) : (
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
                  <th className="w-[108px] px-2 py-1.5 text-right">Ações</th>
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
                  listRows.map((row, rowIdx) => (
                    <QueueRow
                      key={row.id}
                      row={row}
                      isSel={row.id === selectedId}
                      priorityLawEnabled={priorityLawEnabled}
                      notesInline={notesInline}
                      docasLogisticsActive={docasLogisticsActive}
                      aviacaoLogisticsActive={aviacaoLogisticsActive}
                      salaoEsteticaActive={salaoEsteticaActive}
                      cadastroCategories={enabledCategories}
                      cadastroLookups={cadastroLookups}
                      deleting={deleting}
                      onSelectId={onSelectId}
                      onEditRow={onEditRow}
                      onPrintRow={onPrintRow}
                      onCopyRow={(r) => void handleCopyRow(r)}
                      onDelete={(r) => void handleDelete(r)}
                      onSalaoDefinirProximo={
                        isSalaoListPaymentTab ? undefined : onSalaoDefinirProximo
                      }
                      listTabId={
                        salaoProfissionalMirror ? activeSalaoListTab?.id : activeTab?.id
                      }
                      salaoFilaAtivaIndex={
                        !salaoProfissionalMirror &&
                        salaoEsteticaActive &&
                        activeTab?.id === SALAO_TAB.FILA_ATIVA
                          ? rowIdx
                          : -1
                      }
                      salaoFilaAtivaCount={
                        !salaoProfissionalMirror &&
                        salaoEsteticaActive &&
                        activeTab?.id === SALAO_TAB.FILA_ATIVA
                          ? listRows.length
                          : 0
                      }
                      onSalaoAtenderAgora={
                        salaoProfissionalMirror ? undefined : onSalaoAtenderAgora
                      }
                      onSalaoMoveFilaUp={salaoProfissionalMirror ? undefined : onSalaoMoveFilaUp}
                      onSalaoMoveFilaDown={
                        salaoProfissionalMirror ? undefined : onSalaoMoveFilaDown
                      }
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
          )
        ) : salaoProfissionalMirror ? (
          salaoProfissionalColumns.length === 0 ? (
            <p className="flex flex-1 items-center justify-center text-xs text-zinc-500">
              Nenhum profissional cadastrado para este tenant.
            </p>
          ) : (
            <div className="flex min-h-0 w-full max-w-full flex-1 overflow-x-auto overflow-y-hidden pb-3 sf-scroll-x-hover">
              <div className="flex h-full min-h-full w-max min-w-full gap-2">
                {salaoProfissionalColumns.map((column) => {
                  const cards = columnRows[column.id] ?? [];
                  const count = tabCounts[column.id] ?? cards.length;
                  const isPaymentColumn = column.kind === "aguardando_pagamento";
                  return (
                    <section
                      key={column.id}
                      className={`flex h-full min-h-0 max-h-full w-[240px] shrink-0 flex-col overflow-hidden bg-zinc-100 dark:bg-zinc-950/50 ${
                        isPaymentColumn
                          ? "sticky right-0 z-10 border-l border-zinc-200 bg-zinc-50 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.1)] dark:border-zinc-700 dark:bg-zinc-900/95 dark:shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.35)]"
                          : ""
                      }`}
                    >
                      <header
                        className={`shrink-0 border-y border-zinc-200 px-2 py-0.5 dark:border-zinc-700 ${
                          isPaymentColumn
                            ? "bg-zinc-50 dark:bg-zinc-900/95"
                            : "bg-zinc-100 dark:bg-zinc-800/80"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex min-w-0 flex-1 items-center gap-0.5">
                            <h3
                              className="truncate text-[8px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300"
                              title={column.label}
                            >
                              {column.label}
                            </h3>
                            {showSalaoProfWallet && column.kind === "profissional" ? (
                              <SalaoProWalletButton
                                tooltip="Faturamento diário (PRO)"
                                onClick={() => openSalaoProUpsell("daily")}
                                iconClassName="size-2.5"
                              />
                            ) : null}
                          </div>
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
                                aviacaoLogisticsActive={false}
                                docasLogisticsActive={false}
                                salaoEsteticaActive={salaoEsteticaActive}
                                segmentoId={SALAO_ESTETICA_SEGMENT_ID}
                                meta={resolveKanbanMeta(
                                  row,
                                  enabledCategories,
                                  cadastroLookups,
                                  false,
                                  false,
                                  salaoEsteticaActive
                                )}
                                deleting={deleting}
                                onSelectId={onSelectId}
                                onEditRow={onEditRow}
                                onPrintRow={onPrintRow}
                                onCopyRow={(r) => void handleCopyRow(r)}
                                onDelete={(r) => void handleDelete(r)}
                                onSalaoDefinirProximo={
                                  !isPaymentColumn ? onSalaoDefinirProximo : undefined
                                }
                                kanbanColumnId={column.id}
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
          )
        ) : kanbanColumns.length === 0 ? (
          <p className="flex flex-1 items-center justify-center text-xs text-zinc-500">
            Nenhuma coluna de fluxo configurada.
          </p>
        ) : (
          <div className="flex min-h-0 w-full max-w-full flex-1 flex-col overflow-x-auto overflow-y-hidden pb-3 sf-scroll-x-hover">
            <div className="flex h-full min-h-full w-max min-w-full gap-2">
            {kanbanColumns.map((tab) => {
              const cards = columnRows[tab.id] ?? [];
              const count = tabCounts[tab.id] ?? cards.length;
              const columnLabel = aviacaoLogisticsActive
                ? resolveAviacaoKanbanColumnLabel(tab, mroSegmentId)
                : salaoEsteticaActive
                  ? resolveSalaoKanbanColumnLabel(tab)
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
                        {cards.map((row, cardIdx) => (
                          <KanbanCard
                            key={row.id}
                            row={row}
                            isSel={row.id === selectedId}
                            isCompactView={compactKanbanActive}
                            priorityLawEnabled={priorityLawEnabled}
                            notesInline={notesInline}
                            aviacaoLogisticsActive={aviacaoLogisticsActive}
                            docasLogisticsActive={docasLogisticsActive}
                            salaoEsteticaActive={salaoEsteticaActive}
                            segmentoId={
                              salaoEsteticaActive ? SALAO_ESTETICA_SEGMENT_ID : mroSegmentId
                            }
                            meta={resolveKanbanMeta(
                              row,
                              enabledCategories,
                              cadastroLookups,
                              docasLogisticsActive,
                              aviacaoLogisticsActive,
                              salaoEsteticaActive
                            )}
                            deleting={deleting}
                            onSelectId={onSelectId}
                            onEditRow={onEditRow}
                            onPrintRow={onPrintRow}
                            onCopyRow={(r) => void handleCopyRow(r)}
                            onDelete={(r) => void handleDelete(r)}
                            onSalaoDefinirProximo={onSalaoDefinirProximo}
                            kanbanColumnId={tab.id}
                            salaoFilaAtivaIndex={
                              salaoEsteticaActive && tab.id === SALAO_TAB.FILA_ATIVA ? cardIdx : -1
                            }
                            salaoFilaAtivaCount={
                              salaoEsteticaActive && tab.id === SALAO_TAB.FILA_ATIVA ? cards.length : 0
                            }
                            onSalaoAtenderAgora={onSalaoAtenderAgora}
                            onSalaoMoveFilaUp={onSalaoMoveFilaUp}
                            onSalaoMoveFilaDown={onSalaoMoveFilaDown}
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
      <SalaoProUpsellModal
        open={salaoUpsellOpen}
        onClose={() => setSalaoUpsellOpen(false)}
        context={salaoUpsellContext}
      />
    </TooltipProvider>
  );
}
