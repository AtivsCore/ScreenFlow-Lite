/** Candidatos em ordem de preferência (env → servicos → especialidades). */
export const SERVICES_TABLE_CANDIDATES = ["servicos", "especialidades"] as const;

/**
 * Nome da tabela PostgREST para “serviços”.
 * `NEXT_PUBLIC_SUPABASE_SERVICES_TABLE=servicos` ou `especialidades`
 */
export const SERVICES_TABLE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SUPABASE_SERVICES_TABLE?.trim()) ||
  "servicos";

/** Lista única de tabelas a tentar (env primeiro, depois fallbacks). */
export function servicesTableCandidates(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (name: string) => {
    const n = name.trim();
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  };
  add(SERVICES_TABLE);
  for (const c of SERVICES_TABLE_CANDIDATES) add(c);
  return out;
}

let resolvedServicesTableCache: string | null = null;

export function getResolvedServicesTable(): string | null {
  return resolvedServicesTableCache;
}

export function setResolvedServicesTable(table: string): void {
  resolvedServicesTableCache = table.trim() || null;
}

/** Tabela preferida para CRUD (cache após 1ª consulta bem-sucedida, senão env/default). */
export function preferredServicesTable(): string {
  return getResolvedServicesTable() ?? SERVICES_TABLE;
}

export function isMissingServicesTableError(message: string | undefined | null): boolean {
  if (!message) return false;
  return /could not find the table|schema cache|relation .* does not exist/i.test(message);
}
