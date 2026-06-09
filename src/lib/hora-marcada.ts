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
  if (Number.isNaN(d.getTime())) return value.trim();
  return d.toISOString();
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
