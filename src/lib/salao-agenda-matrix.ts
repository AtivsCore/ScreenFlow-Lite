import type { AtendimentoLite } from "@/lib/atendimentos-lite";
import type { CadastroLookups } from "@/lib/cadastro-valores";
import {
  SALAO_PROFISSIONAL_CATEGORY_ID,
  isSalaoAgendaEligibleRow,
  normalizeSalaoStatus,
  normalizeSalaoStatusLabel,
  resolveSalaoCategoryDisplay,
  SALAO_STATUS,
} from "@/lib/salao-estetica-logistics";
import { isFutureHoraMarcada, isTodayHoraMarcada } from "@/lib/hora-marcada";
import type { CadastroCategoryEntry, QueueTabEntry } from "@/lib/tenant-config";

export const SALAO_AGENDA_SLOT_START_HOUR = 8;
export const SALAO_AGENDA_SLOT_END_HOUR = 20;
export const SALAO_AGENDA_SLOT_MINUTES = 30;

export type SalaoAgendaProfissionalColumn = {
  id: string;
  label: string;
};

export type SalaoAgendaSlotAppearance = {
  cardClassName: string;
  statusLabel: string;
};

export type RegistryInitialDraft = {
  formValues?: Record<string, string>;
  horaMarcada?: string;
  triagemTabId?: string;
};

export function startOfLocalDay(day: Date = new Date()): Date {
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addLocalDays(day: Date, delta: number): Date {
  const d = new Date(day);
  d.setDate(d.getDate() + delta);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isSameLocalCalendarDay(iso: string | null | undefined, day: Date): boolean {
  if (!iso) return false;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return false;
  const d = new Date(ms);
  return (
    d.getFullYear() === day.getFullYear() &&
    d.getMonth() === day.getMonth() &&
    d.getDate() === day.getDate()
  );
}

export function formatLocalDayLabel(day: Date): string {
  return day.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function isLocalDayToday(day: Date): boolean {
  return isSameLocalCalendarDay(new Date().toISOString(), day);
}

/** Gera slots de 08:00 até 19:30 (blocos de 30 min até 20:00). */
export function buildSalaoAgendaTimeSlots(): string[] {
  const pad = (n: number) => String(n).padStart(2, "0");
  const slots: string[] = [];
  for (let hour = SALAO_AGENDA_SLOT_START_HOUR; hour < SALAO_AGENDA_SLOT_END_HOUR; hour++) {
    for (const minute of [0, 30]) {
      slots.push(`${pad(hour)}:${pad(minute)}`);
    }
  }
  return slots;
}

export function buildDatetimeLocalForDayAndSlot(day: Date, slotHHMM: string): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const m = /^(\d{1,2}):(\d{2})$/.exec(slotHHMM.trim());
  const hours = m ? Number(m[1]) : 0;
  const minutes = m ? Number(m[2]) : 0;
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T${pad(hours)}:${pad(minutes)}`;
}

export function isoToAgendaSlotTimeHHMM(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  const snapped = d.getMinutes() < 30 ? 0 : 30;
  return `${pad(d.getHours())}:${pad(snapped)}`;
}

export function resolveSalaoProfissionalId(
  row: Pick<AtendimentoLite, "profissional_id" | "cadastro_valores">
): string | null {
  const direct = row.profissional_id?.trim();
  if (direct) return direct;
  const fromCadastro = row.cadastro_valores?.[SALAO_PROFISSIONAL_CATEGORY_ID]?.trim();
  return fromCadastro || null;
}

export function buildSalaoAgendaProfissionalColumns(
  lookups: CadastroLookups
): SalaoAgendaProfissionalColumn[] {
  return [...lookups.profissionais.entries()]
    .map(([id, label]) => ({ id, label: label.trim() || id }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

export function filterSalaoAgendaRowsForDay(
  rows: AtendimentoLite[],
  day: Date,
  queueTabs: Pick<QueueTabEntry, "id" | "preset">[]
): AtendimentoLite[] {
  return rows.filter(
    (row) =>
      isSalaoAgendaEligibleRow(row, queueTabs) &&
      row.hora_marcada &&
      isSameLocalCalendarDay(row.hora_marcada, day)
  );
}

/** Mapa `profissionalId|HH:MM` → atendimento (primeiro encontrado). */
export function buildSalaoAgendaSlotOccupancy(
  dayRows: AtendimentoLite[],
  profissionalIds: string[]
): Map<string, AtendimentoLite> {
  const allowed = new Set(profissionalIds);
  const map = new Map<string, AtendimentoLite>();

  for (const row of dayRows) {
    const profId = resolveSalaoProfissionalId(row);
    if (!profId || !allowed.has(profId)) continue;
    const slot = isoToAgendaSlotTimeHHMM(row.hora_marcada);
    if (!slot) continue;
    const key = `${profId}|${slot}`;
    if (!map.has(key)) map.set(key, row);
  }

  return map;
}

export function resolveSalaoAgendaSlotAppearance(
  row: Pick<AtendimentoLite, "status" | "hora_marcada">
): SalaoAgendaSlotAppearance {
  const status = normalizeSalaoStatus(row.status);
  const statusLabel = normalizeSalaoStatusLabel(row.status);

  if (
    status === SALAO_STATUS.processing ||
    status === SALAO_STATUS.called ||
    status === SALAO_STATUS.next
  ) {
    return {
      statusLabel,
      cardClassName:
        "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-100",
    };
  }

  if (row.hora_marcada && (isFutureHoraMarcada(row.hora_marcada) || Date.parse(row.hora_marcada) > Date.now())) {
    return {
      statusLabel: "Agendado",
      cardClassName:
        "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
    };
  }

  return {
    statusLabel,
    cardClassName:
      "border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-100",
  };
}

export function resolveSalaoAgendaServicoLabel(
  row: AtendimentoLite,
  categories: CadastroCategoryEntry[],
  lookups: CadastroLookups
): string | null {
  return resolveSalaoCategoryDisplay(
    "sal-c3",
    row.observacao,
    row.cadastro_valores ?? {},
    lookups,
    categories,
    {
      profissional_id: row.profissional_id,
      local_id: row.local_id,
      especialidade_id: row.especialidade_id,
      profissionalNome: row.profissionalNome,
      localNome: row.localNome,
      servicoNome: row.servicoNome,
    }
  );
}

export function buildSalaoAgendaRegistryDraft(
  day: Date,
  profissionalId: string,
  slotHHMM: string
): RegistryInitialDraft {
  return {
    formValues: { [SALAO_PROFISSIONAL_CATEGORY_ID]: profissionalId },
    horaMarcada: buildDatetimeLocalForDayAndSlot(day, slotHHMM),
  };
}

export function canShowSalaoAgendaQuickActions(
  row: Pick<AtendimentoLite, "hora_marcada">,
  selectedDay: Date
): boolean {
  return isLocalDayToday(selectedDay) && isTodayHoraMarcada(row.hora_marcada);
}
