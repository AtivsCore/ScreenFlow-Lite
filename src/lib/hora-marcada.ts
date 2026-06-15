/** Converte HH:MM para ISO no dia de hoje (fuso local). */
export function buildHoraMarcadaTodayIso(timeHHMM: string): string | null {
  const trimmed = timeHHMM.trim();
  if (!trimmed) return null;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (!m) return trimmed;
  const d = new Date();
  d.setHours(Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : 0, 0);
  return d.toISOString();
}

/** Extrai HH:MM de um ISO ou string de hora para input type="time". */
export function isoToTimeInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (!Number.isNaN(ms)) {
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const m = /^(\d{1,2}):(\d{2})/.exec(iso.trim());
  return m ? `${m[1]!.padStart(2, "0")}:${m[2]}` : "";
}

/** Extrai valor para input type="datetime-local" a partir de ISO. */
export function isoToDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function isFutureHoraMarcada(horaMarcada: string | null | undefined): boolean {
  if (!horaMarcada) return false;
  const ms = Date.parse(horaMarcada);
  if (Number.isNaN(ms)) return false;
  const endToday = new Date();
  endToday.setHours(23, 59, 59, 999);
  return ms > endToday.getTime();
}

/** Hoje (inclusive) ou datas futuras — usado na agenda do salão. */
export function isTodayOrFutureHoraMarcada(horaMarcada: string | null | undefined): boolean {
  if (!horaMarcada) return false;
  const ms = Date.parse(horaMarcada);
  if (Number.isNaN(ms)) return false;
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  return ms >= startToday.getTime();
}

/** Agendamento cujo horário cai no dia civil atual (fuso local). */
export function isTodayHoraMarcada(horaMarcada: string | null | undefined): boolean {
  if (!horaMarcada) return false;
  const ms = Date.parse(horaMarcada);
  if (Number.isNaN(ms)) return false;
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const endToday = new Date(now);
  endToday.setHours(23, 59, 59, 999);
  return ms >= startToday.getTime() && ms <= endToday.getTime();
}

/** Valor mínimo para `datetime-local` a partir de agora (fuso local). */
export function minDatetimeLocalFromNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function minFutureDatetimeLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function datetimeLocalToIso(value: string): string | null {
  if (!value.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Garante ISO completo para `timestamptz` — aceita datetime-local ou HH:MM. */
export function resolveHoraMarcadaIsoForSave(
  value: string,
  originalIso?: string | null
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes("T")) {
    const fromDatetime = datetimeLocalToIso(trimmed);
    if (fromDatetime) return fromDatetime;
  }
  const fromTime = mergeHoraMarcadaPreserveDate(originalIso ?? null, trimmed);
  if (fromTime) return fromTime;
  return buildHoraMarcadaTodayIso(trimmed);
}

/** Aplica HH:MM preservando o dia (e mês/ano) já gravados em `originalIso`. */
export function mergeHoraMarcadaPreserveDate(
  originalIso: string | null | undefined,
  timeHHMM: string
): string | null {
  const trimmed = timeHHMM.trim();
  if (!trimmed) return null;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (!m) return trimmed;

  const base = new Date();
  if (originalIso) {
    const parsed = Date.parse(originalIso);
    if (!Number.isNaN(parsed)) {
      const d = new Date(parsed);
      base.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    }
  }
  base.setHours(Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : 0, 0);
  return base.toISOString();
}
