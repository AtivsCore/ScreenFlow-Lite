/** Retorna YYYY-MM-DD do dia civil anterior ao “hoje” no fuso informado. */
export function yesterdayDateKeyInTimeZone(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const y = Number(parts.find((x) => x.type === "year")?.value ?? 1970);
  const m = Number(parts.find((x) => x.type === "month")?.value ?? 1);
  const day = Number(parts.find((x) => x.type === "day")?.value ?? 1);

  const dt = new Date(Date.UTC(y, m - 1, day));
  dt.setUTCDate(dt.getUTCDate() - 1);
  const yy = dt.getUTCFullYear();
  const mm = dt.getUTCMonth() + 1;
  const dd = dt.getUTCDate();
  return `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/** YYYY-MM-DD da data civil de `iso` no fuso informado. */
export function dateKeyInTimeZone(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
