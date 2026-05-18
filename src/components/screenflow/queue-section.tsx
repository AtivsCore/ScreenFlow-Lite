"use client";

import type { AtendimentoLite } from "@/lib/atendimentos-lite";
import {
  formatCreatedAt,
  formatHoraMarcada,
} from "@/lib/atendimentos-lite";
import type { QueueTabEntry } from "@/lib/tenant-config";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Pencil, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";

function statusStyle(status: string | null): string {
  const s = (status ?? "").toLowerCase();
  if (s.includes("finaliz")) return "text-emerald-700 dark:text-emerald-400";
  if (s.includes("cham")) return "text-sky-700 dark:text-sky-400";
  if (s.includes("rech")) return "text-amber-700 dark:text-amber-400";
  return "text-zinc-600 dark:text-zinc-400";
}

type QueueSectionProps = {
  id?: string;
  displayRows: AtendimentoLite[];
  queueTabs: QueueTabEntry[];
  queueTabId: string;
  onQueueTabId: (id: string) => void;
  priorityLawEnabled: boolean;
  selectedId: string | null;
  onSelectId: (id: string) => void;
  loading: boolean;
  supabase: SupabaseClient | null;
  onRefresh: () => void;
  onRegisterClick: () => void;
  onEditRow: (row: AtendimentoLite) => void;
};

export function QueueSection({
  id = "sf-queue",
  displayRows,
  queueTabs,
  queueTabId,
  onQueueTabId,
  priorityLawEnabled,
  selectedId,
  onSelectId,
  loading,
  supabase,
  onRefresh,
  onRegisterClick,
  onEditRow,
}: QueueSectionProps) {
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(row: AtendimentoLite) {
    if (!supabase || !confirm(`Excluir registro de “${row.nome ?? "cliente"}”?`)) return;
    setDeleting(row.id);
    const { error } = await supabase.from("atendimentos_lite").delete().eq("id", row.id);
    if (error) alert(error.message);
    else onRefresh();
    setDeleting(null);
  }

  return (
    <div id={id} className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="shrink-0 border-b border-zinc-200 px-2 py-2 dark:border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">Fila em tempo real</h2>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              Finalizados ocultos • Supabase Realtime
            </p>
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
          className="mt-2 flex gap-0.5 overflow-x-auto pb-0.5"
          role="tablist"
          aria-label="Vistas da fila"
        >
          {queueTabs.map((t) => (
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
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[720px] table-fixed border-collapse text-left text-[11px] text-zinc-800 dark:text-zinc-100">
          <thead className="sticky top-0 z-[1] border-b border-zinc-200 bg-zinc-50 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/95 dark:text-zinc-400">
            <tr>
              <th className="w-[100px] px-2 py-1.5">Chegada</th>
              <th className="w-[110px] px-2 py-1.5">Horário marc.</th>
              {priorityLawEnabled ? <th className="w-[60px] px-2 py-1.5">Prior.</th> : null}
              <th className="min-w-[100px] px-2 py-1.5">Cliente</th>
              <th className="min-w-[80px] px-2 py-1.5">Profissional</th>
              <th className="min-w-[70px] px-2 py-1.5">Status</th>
              <th className="w-[72px] px-2 py-1.5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={priorityLawEnabled ? 7 : 6} className="px-2 py-6 text-center text-zinc-500">
                  Carregando registros…
                </td>
              </tr>
            )}
            {!loading && displayRows.length === 0 && (
              <tr>
                <td colSpan={priorityLawEnabled ? 7 : 6} className="px-2 py-6 text-center text-zinc-500">
                  Nenhum registro ativo nesta vista.
                </td>
              </tr>
            )}
            {!loading &&
              displayRows.map((row) => {
                const isSel = row.id === selectedId;
                return (
                  <tr
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectId(row.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectId(row.id);
                      }
                    }}
                    className={`cursor-pointer border-b border-zinc-100 transition hover:bg-zinc-50/80 dark:border-zinc-800 dark:hover:bg-zinc-800/40 ${
                      isSel ? "bg-zinc-100 dark:bg-zinc-800/60" : ""
                    }`}
                  >
                    <td className="whitespace-nowrap px-2 py-1 font-mono text-zinc-500 dark:text-zinc-400">
                      {formatCreatedAt(row.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1 font-mono font-medium text-zinc-800 dark:text-zinc-200">
                      {formatHoraMarcada(row.hora_marcada)}
                    </td>
                    {priorityLawEnabled ? (
                      <td className="px-2 py-1">
                        <span
                          className={
                            row.prioridade === true
                              ? "rounded bg-amber-200 px-1 py-0.5 font-medium text-amber-950 dark:bg-amber-900/70 dark:text-amber-100"
                              : "rounded bg-zinc-200 px-1 py-0.5 font-medium text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100"
                          }
                        >
                          {row.prioridade === true ? "Sim" : "Não"}
                        </span>
                      </td>
                    ) : null}
                    <td className="truncate px-2 py-1 font-medium">{row.nome ?? "—"}</td>
                    <td className="truncate px-2 py-1 text-zinc-700 dark:text-zinc-300">{row.profissionalNome ?? "—"}</td>
                    <td className={`truncate px-2 py-1 ${statusStyle(row.status)}`}>{row.status ?? "—"}</td>
                    <td className="px-2 py-1 text-right" onClick={(e) => e.stopPropagation()}>
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
                        onClick={() => void handleDelete(row)}
                      >
                        <Trash2 className="size-3.5" strokeWidth={1.75} />
                        <span className="sr-only">Excluir</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
