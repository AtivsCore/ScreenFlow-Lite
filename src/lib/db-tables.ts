/** Marcador para CRUD que deve resolver automaticamente a tabela de serviços. */
export const SERVICES_CRUD_TABLE = "__services__";

/** Candidatos testados em ordem (env primeiro via servicesTableCandidates). */
export const SERVICES_TABLE_CANDIDATES = [
  "servicos",
  "especialidades",
  "servico",
  "especialidade",
  "procedimentos",
  "procedimento",
] as const;

/**
 * Nome preferido via env (Vercel / .env.local).
 * Se vazio, o app descobre automaticamente entre SERVICES_TABLE_CANDIDATES.
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

export function isServicesTableCandidate(table: string): boolean {
  const t = table.trim();
  return t === SERVICES_CRUD_TABLE || servicesTableCandidates().includes(t);
}

let resolvedServicesTableCache: string | null = null;

export function getResolvedServicesTable(): string | null {
  return resolvedServicesTableCache;
}

export function setResolvedServicesTable(table: string): void {
  resolvedServicesTableCache = table.trim() || null;
}

export function clearResolvedServicesTable(): void {
  resolvedServicesTableCache = null;
}

/** Tabela preferida para CRUD (cache após 1ª consulta bem-sucedida, senão env/default). */
export function preferredServicesTable(): string {
  return getResolvedServicesTable() ?? SERVICES_TABLE;
}

export function isMissingServicesTableError(message: string | undefined | null): boolean {
  if (!message) return false;
  return /could not find the table|schema cache|relation .* does not exist|PGRST205/i.test(message);
}

export const SERVICES_TABLE_SETUP_HINT =
  "Nenhuma tabela de serviços encontrada. Execute docs/supabase-lite-create-servicos.sql no Supabase e defina NEXT_PUBLIC_SUPABASE_SERVICES_TABLE=servicos na Vercel.";
