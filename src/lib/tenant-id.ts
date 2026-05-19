/** UUID fixo para desenvolvimento local quando `NEXT_PUBLIC_DEFAULT_TENANT_ID` não está no `.env`. */
export const DEV_FALLBACK_TENANT_ID = "11111111-1111-4111-8111-111111111111";

/** Resolve o tenant padrão: variável de ambiente ou fallback interno de teste. */
export function resolveDefaultTenantId(): string {
  const env = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID?.trim();
  return env || DEV_FALLBACK_TENANT_ID;
}
