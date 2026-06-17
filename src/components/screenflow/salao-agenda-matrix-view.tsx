"use client";

import type { AtendimentoLite } from "@/lib/atendimentos-lite";
import type { CadastroLookups } from "@/lib/cadastro-valores";
import {
  addLocalDays,
  buildSalaoAgendaProfissionalColumns,
  buildSalaoAgendaRegistryDraft,
  buildSalaoAgendaSlotOccupancy,
  computeSalaoAgendaTimeSlots,
  filterSalaoAgendaRowsForDay,
  formatDayForDateInput,
  formatLocalDayLabel,
  gridHoursToTimeInputValue,
  isLocalDayToday,
  parseDateInputValue,
  readSalaoAgendaGridHours,
  resolveSalaoAgendaServicoLabel,
  resolveSalaoAgendaSlotAppearance,
  startOfLocalDay,
  timeInputValueToHour,
  writeSalaoAgendaGridHours,
  type RegistryInitialDraft,
  type SalaoAgendaGridHours,
  type SalaoAgendaSlotIntervalMinutes,
} from "@/lib/salao-agenda-matrix";
import type { CadastroCategoryEntry, QueueTabEntry } from "@/lib/tenant-config";
import {
  SalaoProUpsellModal,
  type SalaoProUpsellContext,
} from "@/components/screenflow/salao-pro-upsell-modal";
import { SalaoProWalletButton } from "@/components/screenflow/salao-pro-wallet-button";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SalaoAgendaMatrixViewProps = {
  rows: AtendimentoLite[];
  loading: boolean;
  tenantId?: string | null;
  cadastroCategories: CadastroCategoryEntry[];
  cadastroLookups: CadastroLookups;
  queueTabs: QueueTabEntry[];
  onOpenRegistry: (draft?: RegistryInitialDraft) => void;
  onEditRow: (row: AtendimentoLite) => void;
  onDeleteRow: (row: AtendimentoLite) => void | Promise<void>;
  /** Exibe ícones de carteira PRO (salão, plano free). */
  salaoProPaywallActive?: boolean;
};

function SalaoAgendaGridSettingsPopover({
  tenantId,
  gridHours,
  onSave,
}: {
  tenantId: string | null | undefined;
  gridHours: SalaoAgendaGridHours;
  onSave: (hours: SalaoAgendaGridHours) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(() => gridHoursToTimeInputValue(gridHours.startHour));
  const [draftEnd, setDraftEnd] = useState(() => gridHoursToTimeInputValue(gridHours.endHour));
  const [draftInterval, setDraftInterval] = useState<SalaoAgendaSlotIntervalMinutes>(
    () => gridHours.slotIntervalMinutes
  );
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setDraftStart(gridHoursToTimeInputValue(gridHours.startHour));
    setDraftEnd(gridHoursToTimeInputValue(gridHours.endHour));
    setDraftInterval(gridHours.slotIntervalMinutes);
  }, [open, gridHours.startHour, gridHours.endHour, gridHours.slotIntervalMinutes]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function handleSave() {
    const startHour = timeInputValueToHour(draftStart);
    const endHour = timeInputValueToHour(draftEnd);
    if (startHour === null || endHour === null) return;
    const saved = writeSalaoAgendaGridHours(tenantId, {
      startHour,
      endHour,
      slotIntervalMinutes: draftInterval,
    });
    onSave(saved);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        title="Configurar grade"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-[10px] font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:bg-zinc-700"
        onClick={() => setOpen((v) => !v)}
      >
        <Settings2 className="size-3.5" strokeWidth={2} aria-hidden />
        <span className="hidden sm:inline">Horário</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Horário comercial da grade"
          className="absolute right-0 top-full z-30 mt-1.5 w-[min(16rem,calc(100vw-1.5rem))] rounded-lg border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        >
          <p className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-100">
            Horário comercial
          </p>
          <p className="mt-0.5 text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
            Define o intervalo padrão da grade. Agendamentos fora desse horário esticam a visualização
            automaticamente.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">Início</span>
              <input
                type="time"
                value={draftStart}
                step={1800}
                onChange={(e) => setDraftStart(e.target.value)}
                className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[11px] font-mono text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">Fim</span>
              <input
                type="time"
                value={draftEnd}
                step={1800}
                onChange={(e) => setDraftEnd(e.target.value)}
                className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[11px] font-mono text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </label>
          </div>
          <fieldset className="mt-3">
            <legend className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
              Intervalo da grade
            </legend>
            <div className="mt-1.5 flex flex-col gap-1">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-zinc-200 px-2 py-1.5 text-[10px] text-zinc-700 has-[:checked]:border-zinc-400 has-[:checked]:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:has-[:checked]:border-zinc-500 dark:has-[:checked]:bg-zinc-800/80">
                <input
                  type="radio"
                  name="salao-agenda-interval"
                  value={30}
                  checked={draftInterval === 30}
                  onChange={() => setDraftInterval(30)}
                  className="size-3 accent-zinc-900 dark:accent-zinc-100"
                />
                De 30 em 30 minutos
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-zinc-200 px-2 py-1.5 text-[10px] text-zinc-700 has-[:checked]:border-zinc-400 has-[:checked]:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:has-[:checked]:border-zinc-500 dark:has-[:checked]:bg-zinc-800/80">
                <input
                  type="radio"
                  name="salao-agenda-interval"
                  value={60}
                  checked={draftInterval === 60}
                  onChange={() => setDraftInterval(60)}
                  className="size-3 accent-zinc-900 dark:accent-zinc-100"
                />
                De 1 em 1 hora
              </label>
            </div>
          </fieldset>
          <div className="mt-3 flex justify-end gap-1.5">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-[10px] font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="rounded-md bg-zinc-900 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              onClick={handleSave}
            >
              Salvar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SalaoAgendaMatrixView({
  rows,
  loading,
  tenantId = null,
  cadastroCategories,
  cadastroLookups,
  queueTabs,
  onOpenRegistry,
  onEditRow,
  onDeleteRow,
  salaoProPaywallActive = false,
}: SalaoAgendaMatrixViewProps) {
  const [selectedDay, setSelectedDay] = useState(() => startOfLocalDay(new Date()));
  const [gridHours, setGridHours] = useState<SalaoAgendaGridHours>(() =>
    readSalaoAgendaGridHours(tenantId)
  );
  const [deleting, setDeleting] = useState<string | null>(null);
  const [salaoUpsellOpen, setSalaoUpsellOpen] = useState(false);
  const [salaoUpsellContext, setSalaoUpsellContext] = useState<SalaoProUpsellContext>("monthly");

  useEffect(() => {
    setGridHours(readSalaoAgendaGridHours(tenantId));
  }, [tenantId]);

  const profissionais = useMemo(
    () => buildSalaoAgendaProfissionalColumns(cadastroLookups),
    [cadastroLookups]
  );

  const dayRows = useMemo(
    () => filterSalaoAgendaRowsForDay(rows, selectedDay, queueTabs),
    [rows, selectedDay, queueTabs]
  );

  const timeSlots = useMemo(
    () => computeSalaoAgendaTimeSlots(gridHours, dayRows),
    [gridHours, dayRows]
  );

  const occupancy = useMemo(
    () => buildSalaoAgendaSlotOccupancy(dayRows, profissionais.map((p) => p.id)),
    [dayRows, profissionais]
  );

  const dayLabel = formatLocalDayLabel(selectedDay);
  const isToday = isLocalDayToday(selectedDay);
  const dateInputValue = formatDayForDateInput(selectedDay);

  const handleDateInputChange = useCallback((value: string) => {
    const parsed = parseDateInputValue(value);
    if (parsed) setSelectedDay(parsed);
  }, []);

  async function handleDelete(row: AtendimentoLite) {
    if (!confirm(`Excluir agendamento de “${row.nome ?? "cliente"}”?`)) return;
    setDeleting(row.id);
    try {
      await onDeleteRow(row);
    } finally {
      setDeleting(null);
    }
  }

  function openSlotRegistry(profissionalId: string, slotHHMM: string) {
    onOpenRegistry(buildSalaoAgendaRegistryDraft(selectedDay, profissionalId, slotHHMM));
  }

  function openSalaoProUpsell(context: SalaoProUpsellContext) {
    setSalaoUpsellContext(context);
    setSalaoUpsellOpen(true);
  }

  return (
    <TooltipProvider>
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <div>
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            Grade de disponibilidade
          </h2>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Lacunas livres e horários ocupados por profissional — clique em um slot vazio para agendar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/80">
            <button
              type="button"
              title="Dia anterior"
              className="rounded-l-lg px-2 py-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
              onClick={() => setSelectedDay((d) => addLocalDays(d, -1))}
            >
              <ChevronLeft className="size-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              className={`border-x border-zinc-200 px-2.5 py-1.5 text-[11px] font-semibold dark:border-zinc-700 ${
                isToday
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-700"
              }`}
              onClick={() => setSelectedDay(startOfLocalDay(new Date()))}
            >
              Hoje
            </button>
            <button
              type="button"
              title="Próximo dia"
              className="rounded-r-lg px-2 py-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
              onClick={() => setSelectedDay((d) => addLocalDays(d, 1))}
            >
              <ChevronRight className="size-4" strokeWidth={2} />
            </button>
          </div>

          <label className="relative inline-flex items-center">
            <span className="sr-only">Ir para data</span>
            <input
              type="date"
              value={dateInputValue}
              onChange={(e) => handleDateInputChange(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-[11px] font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-200 [color-scheme:light] dark:[color-scheme:dark]"
              title="Selecionar data"
            />
          </label>

          <SalaoAgendaGridSettingsPopover
            tenantId={tenantId}
            gridHours={gridHours}
            onSave={setGridHours}
          />

          <span className="hidden min-[480px]:inline text-[11px] font-medium capitalize text-zinc-600 dark:text-zinc-300">
            {dayLabel}
          </span>
          <button
            type="button"
            onClick={() => onOpenRegistry()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <CalendarPlus className="size-3.5" strokeWidth={2} aria-hidden />
            <span className="hidden sm:inline">Novo agendamento</span>
            <span className="sm:hidden">Novo</span>
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto sf-scroll-y">
        {loading ? (
          <p className="py-8 text-center text-xs text-zinc-500">Carregando grade…</p>
        ) : profissionais.length === 0 ? (
          <p className="py-8 text-center text-xs text-zinc-500">
            Nenhum profissional cadastrado para este tenant.
          </p>
        ) : (
            <table className="min-w-full border-collapse text-[11px]">
              <thead className="sticky top-0 z-20 bg-zinc-50 shadow-sm dark:bg-zinc-800/95">
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="sticky top-0 left-0 z-30 min-w-[4.5rem] border-r border-zinc-200 bg-zinc-50 px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-800/95">
                    Horário
                  </th>
                  {profissionais.map((prof) => (
                    <th
                      key={prof.id}
                      className="sticky top-0 z-20 min-w-[9rem] bg-zinc-50 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-600 shadow-sm dark:bg-zinc-800/95 dark:text-zinc-300"
                    >
                      <span className="inline-flex items-center justify-center gap-0.5">
                        <span>{prof.label}</span>
                        {salaoProPaywallActive ? (
                          <SalaoProWalletButton
                            tooltip="Previsão mensal (PRO)"
                            onClick={() => openSalaoProUpsell("monthly")}
                            iconClassName="size-2.5"
                          />
                        ) : null}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map((slot) => (
                  <tr key={slot} className="border-b border-zinc-100 dark:border-zinc-800/80">
                    <td className="sticky left-0 z-10 border-r border-zinc-200 bg-white px-2 py-1.5 font-mono text-[10px] font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                      {slot}
                    </td>
                    {profissionais.map((prof) => {
                      const row = occupancy.get(`${prof.id}|${slot}`);
                      if (!row) {
                        return (
                          <td key={prof.id} className="p-1 align-top">
                            <button
                              type="button"
                              title={`Agendar ${slot} — ${prof.label}`}
                              onClick={() => openSlotRegistry(prof.id, slot)}
                              className="group flex h-[3.25rem] w-full items-center justify-center rounded-md border border-dashed border-zinc-200 bg-zinc-50/80 text-zinc-400 transition hover:border-emerald-300 hover:bg-emerald-50/60 hover:text-emerald-700 dark:border-zinc-700 dark:bg-zinc-800/30 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-300"
                            >
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium opacity-0 transition group-hover:opacity-100">
                                <Plus className="size-3" strokeWidth={2.5} />
                                Novo
                              </span>
                            </button>
                          </td>
                        );
                      }

                      const appearance = resolveSalaoAgendaSlotAppearance(row);
                      const servico = resolveSalaoAgendaServicoLabel(row, cadastroCategories, cadastroLookups);

                      return (
                        <td key={prof.id} className="p-1 align-top">
                          <div
                            className={`flex h-[3.25rem] min-w-[8.5rem] flex-col justify-between rounded-md border px-2 py-1 ${appearance.cardClassName}`}
                          >
                            <div className="min-w-0">
                              <p className="truncate font-semibold leading-tight">{row.nome ?? "Cliente"}</p>
                              <p className="truncate text-[9px] opacity-80">{servico ?? "Serviço não informado"}</p>
                            </div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate text-[9px] font-medium uppercase tracking-wide opacity-90">
                                {appearance.statusLabel}
                              </span>
                              <div className="flex shrink-0 items-center gap-0.5">
                                <button
                                  type="button"
                                  title="Encaixe — novo agendamento neste horário"
                                  className="rounded p-0.5 opacity-70 hover:opacity-100"
                                  onClick={() => openSlotRegistry(prof.id, slot)}
                                >
                                  <Plus className="size-3" strokeWidth={2.5} />
                                </button>
                                <button
                                  type="button"
                                  title="Editar"
                                  className="rounded p-0.5 opacity-80 hover:opacity-100"
                                  onClick={() => onEditRow(row)}
                                >
                                  <Pencil className="size-3" strokeWidth={1.75} />
                                </button>
                                <button
                                  type="button"
                                  title="Excluir"
                                  disabled={deleting === row.id}
                                  className="rounded p-0.5 opacity-80 hover:opacity-100 disabled:opacity-40"
                                  onClick={() => void handleDelete(row)}
                                >
                                  <Trash2 className="size-3" strokeWidth={1.75} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
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
