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

export const SALAO_AGENDA_DEFAULT_START_HOUR = 7;
export const SALAO_AGENDA_DEFAULT_END_HOUR = 22;
/** @deprecated Use {@link SALAO_AGENDA_DEFAULT_START_HOUR} */
export const SALAO_AGENDA_SLOT_START_HOUR = SALAO_AGENDA_DEFAULT_START_HOUR;
/** @deprecated Use {@link SALAO_AGENDA_DEFAULT_END_HOUR} */
export const SALAO_AGENDA_SLOT_END_HOUR = SALAO_AGENDA_DEFAULT_END_HOUR;
export const SALAO_AGENDA_SLOT_MINUTES = 30;
export const SALAO_AGENDA_SLOT_INTERVAL_OPTIONS = [30, 60] as const;
export type SalaoAgendaSlotIntervalMinutes = (typeof SALAO_AGENDA_SLOT_INTERVAL_OPTIONS)[number];

export const SALAO_AGENDA_HOURS_STORAGE_PREFIX = "sf-salao-agenda-hours";

export type SalaoAgendaGridHours = {
  /** Hora de abertura (0–23), ex.: 7 → 07:00 */
  startHour: number;
  /** Hora de fechamento (1–24), ex.: 22 → último slot 21:30 */
  endHour: number;
  /** Intervalo da grade: 30 ou 60 minutos. */
  slotIntervalMinutes: SalaoAgendaSlotIntervalMinutes;
};

export const DEFAULT_SALAO_AGENDA_GRID_HOURS: SalaoAgendaGridHours = {
  startHour: SALAO_AGENDA_DEFAULT_START_HOUR,
  endHour: SALAO_AGENDA_DEFAULT_END_HOUR,
  slotIntervalMinutes: SALAO_AGENDA_SLOT_MINUTES,
};

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

export function formatDayForDateInput(day: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

export function parseDateInputValue(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const date = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(date)) return null;
  const d = new Date(year, month - 1, date);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== date
  ) {
    return null;
  }
  return startOfLocalDay(d);
}

export function salaoAgendaHoursStorageKey(tenantId: string | null | undefined): string {
  const tid = tenantId?.trim();
  return `${SALAO_AGENDA_HOURS_STORAGE_PREFIX}:${tid || "default"}`;
}

function clampGridHour(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function normalizeSalaoAgendaSlotInterval(
  value: number | null | undefined
): SalaoAgendaSlotIntervalMinutes {
  if (value === 60) return 60;
  return SALAO_AGENDA_SLOT_MINUTES;
}

export function normalizeSalaoAgendaGridHours(
  raw: Partial<SalaoAgendaGridHours> | null | undefined
): SalaoAgendaGridHours {
  const startHour = clampGridHour(
    raw?.startHour ?? DEFAULT_SALAO_AGENDA_GRID_HOURS.startHour,
    0,
    23
  );
  let endHour = clampGridHour(
    raw?.endHour ?? DEFAULT_SALAO_AGENDA_GRID_HOURS.endHour,
    1,
    24
  );
  if (endHour <= startHour) {
    endHour = Math.min(24, startHour + 1);
  }
  return {
    startHour,
    endHour,
    slotIntervalMinutes: normalizeSalaoAgendaSlotInterval(raw?.slotIntervalMinutes),
  };
}

export function readSalaoAgendaGridHours(tenantId: string | null | undefined): SalaoAgendaGridHours {
  if (typeof window === "undefined") return DEFAULT_SALAO_AGENDA_GRID_HOURS;
  try {
    const raw = window.localStorage.getItem(salaoAgendaHoursStorageKey(tenantId));
    if (!raw) return DEFAULT_SALAO_AGENDA_GRID_HOURS;
    const parsed = JSON.parse(raw) as Partial<SalaoAgendaGridHours>;
    return normalizeSalaoAgendaGridHours(parsed);
  } catch {
    return DEFAULT_SALAO_AGENDA_GRID_HOURS;
  }
}

export function writeSalaoAgendaGridHours(
  tenantId: string | null | undefined,
  hours: SalaoAgendaGridHours
): SalaoAgendaGridHours {
  const normalized = normalizeSalaoAgendaGridHours(hours);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        salaoAgendaHoursStorageKey(tenantId),
        JSON.stringify(normalized)
      );
    } catch {
      /* quota / private mode — grade usa defaults em memória */
    }
  }
  return normalized;
}

export function parseHHMMToMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function minutesToHHMM(totalMinutes: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.trunc(totalMinutes)));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${pad(hours)}:${pad(minutes)}`;
}

export function gridHoursToTimeInputValue(hour: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = clampGridHour(hour, 0, 23);
  return `${pad(h)}:00`;
}

export function timeInputValueToHour(value: string): number | null {
  const minutes = parseHHMMToMinutes(value);
  if (minutes === null) return null;
  return Math.floor(minutes / 60);
}

export function isoToMinutesSinceMidnight(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

export type SalaoAgendaGridMinuteBounds = {
  startMinutes: number;
  endMinutes: number;
};

/** Calcula limites da grade: padrão comercial + auto-stretch pelos agendamentos do dia. */
export function resolveSalaoAgendaGridMinuteBounds(
  gridHours: SalaoAgendaGridHours,
  dayRows: Pick<AtendimentoLite, "hora_marcada">[],
  slotIntervalMinutes: SalaoAgendaSlotIntervalMinutes = SALAO_AGENDA_SLOT_MINUTES
): SalaoAgendaGridMinuteBounds {
  const normalized = normalizeSalaoAgendaGridHours(gridHours);
  const interval = normalizeSalaoAgendaSlotInterval(slotIntervalMinutes);
  let startMinutes = normalized.startHour * 60;
  let endMinutes = normalized.endHour * 60;

  for (const row of dayRows) {
    const appointmentMinutes = isoToMinutesSinceMidnight(row.hora_marcada);
    if (appointmentMinutes === null) continue;
    startMinutes = Math.min(startMinutes, appointmentMinutes);
    endMinutes = Math.max(endMinutes, appointmentMinutes);
  }

  startMinutes = Math.floor(startMinutes / interval) * interval;
  endMinutes = Math.ceil((endMinutes + 1) / interval) * interval;

  if (endMinutes <= startMinutes) {
    endMinutes = startMinutes + interval;
  }

  return { startMinutes, endMinutes };
}

/** Gera slots regulares entre os limites calculados (inclusive auto-stretch). */
export function buildSalaoAgendaTimeSlotsFromBounds(
  bounds: SalaoAgendaGridMinuteBounds,
  slotIntervalMinutes: SalaoAgendaSlotIntervalMinutes = SALAO_AGENDA_SLOT_MINUTES
): string[] {
  const interval = normalizeSalaoAgendaSlotInterval(slotIntervalMinutes);
  const slots: string[] = [];
  for (let m = bounds.startMinutes; m + interval <= bounds.endMinutes; m += interval) {
    slots.push(minutesToHHMM(m));
  }
  return slots;
}

/** Horários exatos (`HH:MM`) dos agendamentos do dia — inclui encaixes fracionados (ex.: 15:15). */
export function extractSalaoAgendaAppointmentSlotTimes(
  dayRows: Pick<AtendimentoLite, "hora_marcada">[]
): string[] {
  const times: string[] = [];
  for (const row of dayRows) {
    const minutes = isoToMinutesSinceMidnight(row.hora_marcada);
    if (minutes === null) continue;
    times.push(minutesToHHMM(minutes));
  }
  return times;
}

/** Une slots de 30 min com horários quebrados dos agendamentos; deduplica e ordena. */
export function mergeSalaoAgendaTimeSlots(
  baseSlots: string[],
  appointmentTimes: string[]
): string[] {
  const merged = new Set(baseSlots);
  for (const time of appointmentTimes) {
    merged.add(time);
  }
  return [...merged].sort((a, b) => {
    const ma = parseHHMMToMinutes(a);
    const mb = parseHHMMToMinutes(b);
    if (ma === null || mb === null) return a.localeCompare(b, "pt-BR");
    return ma - mb;
  });
}

export function computeSalaoAgendaTimeSlots(
  gridHours: SalaoAgendaGridHours,
  dayRows: Pick<AtendimentoLite, "hora_marcada">[]
): string[] {
  const normalized = normalizeSalaoAgendaGridHours(gridHours);
  const interval = normalized.slotIntervalMinutes;
  const bounds = resolveSalaoAgendaGridMinuteBounds(normalized, dayRows, interval);
  const baseSlots = buildSalaoAgendaTimeSlotsFromBounds(bounds, interval);
  const appointmentTimes = extractSalaoAgendaAppointmentSlotTimes(dayRows);
  return mergeSalaoAgendaTimeSlots(baseSlots, appointmentTimes);
}

/** @deprecated Use {@link computeSalaoAgendaTimeSlots} */
export function buildSalaoAgendaTimeSlots(): string[] {
  return computeSalaoAgendaTimeSlots(DEFAULT_SALAO_AGENDA_GRID_HOURS, []);
}

export function buildDatetimeLocalForDayAndSlot(day: Date, slotHHMM: string): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const m = /^(\d{1,2}):(\d{2})$/.exec(slotHHMM.trim());
  const hours = m ? Number(m[1]) : 0;
  const minutes = m ? Number(m[2]) : 0;
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T${pad(hours)}:${pad(minutes)}`;
}

export function isoToAgendaSlotTimeHHMM(iso: string | null | undefined): string | null {
  const minutes = isoToMinutesSinceMidnight(iso);
  if (minutes === null) return null;
  return minutesToHHMM(minutes);
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
