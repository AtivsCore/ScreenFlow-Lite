/** UUID fixo para desenvolvimento local quando `NEXT_PUBLIC_DEFAULT_TENANT_ID` não está no `.env`. */
export const DEV_FALLBACK_TENANT_ID = "11111111-1111-4111-8111-111111111111";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Valida UUID v4 (tenant_id). */
export function isValidTenantUuid(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  return UUID_RE.test(value.trim());
}

/** Normaliza tenant_id de query string; null se ausente ou inválido. */
export function parseTenantIdParam(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw || !isValidTenantUuid(raw)) return null;
  return raw.toLowerCase();
}

/** Resolve o tenant padrão: variável de ambiente ou fallback interno de teste. */
export function resolveDefaultTenantId(): string {
  const env = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID?.trim();
  return env || DEV_FALLBACK_TENANT_ID;
}

/** tenant_id para rotas públicas (display / queue proxy): query → env → fallback. */
export function resolvePublicTenantId(queryValue: string | null | undefined): string | null {
  return parseTenantIdParam(queryValue) ?? parseTenantIdParam(resolveDefaultTenantId());
}
