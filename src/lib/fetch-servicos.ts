import {
  getResolvedServicesTable,
  isMissingServicesTableError,
  servicesTableCandidates,
  setResolvedServicesTable,
} from "@/lib/db-tables";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ServicoRow = { id: string; nome: string | null };

export type FetchServicosResult = {
  data: ServicoRow[];
  table: string;
  error: string | null;
};

/** Consulta serviços tentando env → servicos → especialidades até achar tabela válida. */
export async function fetchServicos(
  supabase: SupabaseClient,
  tenantId?: string | null
): Promise<FetchServicosResult> {
  const cached = getResolvedServicesTable();
  const candidates = cached
    ? [cached, ...servicesTableCandidates().filter((t) => t !== cached)]
    : servicesTableCandidates();

  let lastError: string | null = null;

  for (const table of candidates) {
    let query = supabase.from(table).select("id,nome").order("nome");
    if (tenantId?.trim()) {
      query = query.eq("tenant_id", tenantId.trim());
    }
    const { data, error } = await query;
    if (!error) {
      setResolvedServicesTable(table);
      return { data: (data as ServicoRow[] | null) ?? [], table, error: null };
    }
    lastError = error.message;
    if (!isMissingServicesTableError(error.message)) {
      return { data: [], table, error: error.message };
    }
  }

  const fallback = candidates[0] ?? "servicos";
  return {
    data: [],
    table: fallback,
    error: lastError ?? "Nenhuma tabela de serviços encontrada (servicos / especialidades).",
  };
}

/** Fetch server-side (PostgREST) com fallback entre tabelas. */
export async function fetchServicosRest(
  url: string,
  anonKey: string,
  headers?: Record<string, string>
): Promise<{ data: ServicoRow[]; table: string }> {
  const baseHeaders = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    Accept: "application/json",
    ...headers,
  };

  for (const table of servicesTableCandidates()) {
    const endpoint = `${url}/rest/v1/${table}?select=id,nome&order=nome`;
    const res = await fetch(endpoint, { method: "GET", cache: "no-store", headers: baseHeaders });
    if (res.ok) {
      const parsed = (await res.json()) as unknown;
      setResolvedServicesTable(table);
      return { data: Array.isArray(parsed) ? (parsed as ServicoRow[]) : [], table };
    }
    const text = await res.text();
    if (!isMissingServicesTableError(text)) break;
  }

  return { data: [], table: servicesTableCandidates()[0] ?? "servicos" };
}
