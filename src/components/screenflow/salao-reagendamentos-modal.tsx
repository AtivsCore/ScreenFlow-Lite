"use client";

import type { AtendimentoLite } from "@/lib/atendimentos-lite";
import { formatCreatedAt, formatHoraMarcada } from "@/lib/atendimentos-lite";
import type { CadastroLookups } from "@/lib/cadastro-valores";
import {
  filterSalaoReagendamentoRescueRows,
  formatSalaoServicosItemizedLine,
  formatSalaoTotalLabel,
  normalizeSalaoStatusLabel,
  resolveSalaoKanbanMeta,
} from "@/lib/salao-estetica-logistics";
import type { CadastroCategoryEntry } from "@/lib/tenant-config";
import { CalendarClock, X } from "lucide-react";
import { useMemo } from "react";

type SalaoReagendamentosModalProps = {
  open: boolean;
  onClose: () => void;
  rows: AtendimentoLite[];
  cadastroCategories: CadastroCategoryEntry[];
  cadastroLookups: CadastroLookups;
  onRescueRow: (row: AtendimentoLite) => void;
};

export function SalaoReagendamentosModal({
  open,
  onClose,
  rows,
  cadastroCategories,
  cadastroLookups,
  onRescueRow,
}: SalaoReagendamentosModalProps) {
  const rescueRows = useMemo(() => filterSalaoReagendamentoRescueRows(rows), [rows]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="salao-reagendamentos-title"
    >
      <div className="flex max-h-[min(85vh,40rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <CalendarClock className="size-5 text-amber-600 dark:text-amber-400" strokeWidth={1.75} />
            <div>
              <h2
                id="salao-reagendamentos-title"
                className="text-sm font-semibold text-zinc-900 dark:text-zinc-50"
              >
                Reagendamentos
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Clique no cliente para reagendar e devolver à fila ativa.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {rescueRows.length === 0 ? (
            <p className="px-4 py-10 text-center text-xs text-zinc-500 dark:text-zinc-400">
              Nenhum reagendamento pendente no momento.
            </p>
          ) : (
            <table className="w-full border-collapse text-[11px]">
              <thead className="sticky top-0 bg-zinc-50 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/95 dark:text-zinc-400">
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="px-3 py-2">Horário</th>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Serviços</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rescueRows.map((row) => {
                  const meta = resolveSalaoKanbanMeta(row, cadastroCategories, cadastroLookups);
                  const servicos =
                    formatSalaoServicosItemizedLine(row, cadastroLookups) ?? meta.servico ?? "—";
                  const totalLabel = formatSalaoTotalLabel(row, cadastroLookups);
                  return (
                    <tr
                      key={row.id}
                      className="cursor-pointer border-b border-zinc-100 transition hover:bg-amber-50/80 dark:border-zinc-800 dark:hover:bg-amber-950/20"
                      onClick={() => onRescueRow(row)}
                    >
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-zinc-600 dark:text-zinc-300">
                        {row.hora_marcada
                          ? formatHoraMarcada(row.hora_marcada)
                          : formatCreatedAt(row.created_at)}
                      </td>
                      <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                        {meta.title}
                      </td>
                      <td className="max-w-[14rem] truncate px-3 py-2 text-zinc-600 dark:text-zinc-300">
                        {servicos}
                        {totalLabel ? ` · TOTAL: ${totalLabel}` : ""}
                      </td>
                      <td className="px-3 py-2 capitalize text-zinc-500 dark:text-zinc-400">
                        {normalizeSalaoStatusLabel(row.status)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
