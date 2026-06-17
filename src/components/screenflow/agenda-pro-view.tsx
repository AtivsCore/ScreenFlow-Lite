"use client";

import type { AtendimentoLite } from "@/lib/atendimentos-lite";
import { formatHoraMarcada, isActiveQueueRow } from "@/lib/atendimentos-lite";
import { isFutureHoraMarcada } from "@/lib/hora-marcada";
import type { RegistryInitialDraft } from "@/lib/salao-agenda-matrix";
import type { CadastroLookups } from "@/lib/cadastro-valores";
import { resolveCategoryDisplayLabel } from "@/lib/cadastro-valores";
import {
  isSalaoAgendaEligibleRow,
  isSalaoEsteticaSegment,
} from "@/lib/salao-estetica-logistics";
import type { CadastroCategoryEntry, QueueTabEntry } from "@/lib/tenant-config";
import type { ResolvedTenantConfig } from "@/lib/tenant-config";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CalendarPlus, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { AgendaBookingModal } from "@/components/screenflow/agenda-booking-modal";
import { SalaoAgendaMatrixView } from "@/components/screenflow/salao-agenda-matrix-view";

type AgendaProViewProps = {
  rows: AtendimentoLite[];
  loading: boolean;
  supabase: SupabaseClient | null;
  tenantId: string | null;
  tenantConfig: ResolvedTenantConfig;
  cadastroCategories: CadastroCategoryEntry[];
  cadastroLookups: CadastroLookups;
  queueTabs?: QueueTabEntry[];
  onRefresh: () => void;
  onEditRow: (row: AtendimentoLite) => void;
  onDeleteRow: (row: AtendimentoLite) => void | Promise<void>;
  /** Salão: abre o modal "Novo registro" do balcão, com pré-preenchimento opcional. */
  onOpenRegistry?: (draft?: RegistryInitialDraft) => void;
  onSalaoSendToBalcao?: (row: AtendimentoLite) => void | Promise<void>;
  onSalaoAnteciparOrdem?: (row: AtendimentoLite) => void | Promise<void>;
  /** Exibe paywall de faturamento PRO (salão, plano free). */
  salaoProPaywallActive?: boolean;
};

export function AgendaProView({
  rows,
  loading,
  supabase,
  tenantId,
  tenantConfig,
  cadastroCategories,
  cadastroLookups,
  queueTabs = [],
  onRefresh,
  onEditRow,
  onDeleteRow,
  onOpenRegistry,
  onSalaoSendToBalcao,
  onSalaoAnteciparOrdem,
  salaoProPaywallActive = false,
}: AgendaProViewProps) {
  const salaoMode = isSalaoEsteticaSegment(tenantConfig.segmentoAplicado);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const agendaRows = useMemo(() => {
    return rows
      .filter((r) => {
        if (!isActiveQueueRow(r)) return false;
        if (salaoMode) {
          return isSalaoAgendaEligibleRow(r, queueTabs);
        }
        return isFutureHoraMarcada(r.hora_marcada);
      })
      .sort((a, b) => {
        const ta = Date.parse(a.hora_marcada ?? "") || 0;
        const tb = Date.parse(b.hora_marcada ?? "") || 0;
        return ta - tb;
      });
  }, [rows, salaoMode, queueTabs]);

  function handleNewBookingClick() {
    if (salaoMode && onOpenRegistry) {
      onOpenRegistry();
      return;
    }
    setBookingOpen(true);
  }

  async function handleDelete(row: AtendimentoLite) {
    if (!confirm(`Excluir agendamento de “${row.nome ?? "cliente"}”?`)) return;
    setDeleting(row.id);
    try {
      await onDeleteRow(row);
    } finally {
      setDeleting(null);
    }
  }

  if (salaoMode) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <SalaoAgendaMatrixView
          rows={rows}
          loading={loading}
          tenantId={tenantId}
          cadastroCategories={cadastroCategories}
          cadastroLookups={cadastroLookups}
          queueTabs={queueTabs}
          onOpenRegistry={(draft) => onOpenRegistry?.(draft)}
          onEditRow={onEditRow}
          onDeleteRow={onDeleteRow}
          salaoProPaywallActive={salaoProPaywallActive}
        />
      </div>
    );
  }

  const title = "Agenda — agendamentos futuros";
  const subtitle = "Registros com data posterior a hoje. Edite, exclua ou crie novos agendamentos.";
  const emptyMessage = "Nenhum agendamento futuro cadastrado.";

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <div>
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{title}</h2>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={handleNewBookingClick}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <CalendarPlus className="size-3.5" strokeWidth={2} aria-hidden />
          Novo agendamento
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto sf-scroll-y p-2">
        {loading ? (
          <p className="py-8 text-center text-xs text-zinc-500">Carregando agenda…</p>
        ) : agendaRows.length === 0 ? (
          <p className="py-8 text-center text-xs text-zinc-500">{emptyMessage}</p>
        ) : (
          <table className="w-full border-collapse text-left text-[11px]">
            <thead className="sticky top-0 z-[1] border-b border-zinc-200 bg-zinc-50 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/95">
              <tr>
                <th className="px-2 py-1.5">Data/hora</th>
                <th className="px-2 py-1.5">Cliente</th>
                {cadastroCategories.map((cat) => (
                  <th key={cat.id} className="px-2 py-1.5">
                    {cat.label}
                  </th>
                ))}
                <th className="min-w-[7rem] px-2 py-1.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {agendaRows.map((row) => {
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
                    key={row.id}
                    className="border-b border-zinc-100 hover:bg-zinc-50/80 dark:border-zinc-800 dark:hover:bg-zinc-800/40"
                  >
                    <td className="whitespace-nowrap px-2 py-1.5 font-mono text-zinc-700 dark:text-zinc-300">
                      {formatHoraMarcada(row.hora_marcada)}
                    </td>
                    <td className="px-2 py-1.5 font-medium">{row.nome ?? "—"}</td>
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
                        <td key={cat.id} className="max-w-[8rem] truncate px-2 py-1.5 text-zinc-600 dark:text-zinc-400">
                          {label ?? "—"}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5 text-right">
                      <button
                        type="button"
                        title="Editar"
                        className="inline-flex rounded p-0.5 text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400"
                        onClick={() => onEditRow(row)}
                      >
                        <Pencil className="size-3.5" strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        title="Excluir"
                        disabled={deleting === row.id}
                        className="ml-0.5 inline-flex rounded p-0.5 text-zinc-500 hover:text-red-600 disabled:opacity-40 dark:hover:text-red-400"
                        onClick={() => void handleDelete(row)}
                      >
                        <Trash2 className="size-3.5" strokeWidth={1.75} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <AgendaBookingModal
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        supabase={supabase}
        tenantId={tenantId}
        tenantConfig={tenantConfig}
        onBooked={onRefresh}
      />
    </div>
  );
}
