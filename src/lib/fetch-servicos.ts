import {
  getResolvedServicesTable,
  isMissingServicesTableError,
  SERVICES_TABLE_SETUP_HINT,
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

export type ResolveServicesTableResult = {
  table: string | null;
  error: string | null;
};

function candidateOrder(): string[] {
  const cached = getResolvedServicesTable();
  if (cached) {
    return [cached, ...servicesTableCandidates().filter((t) => t !== cached)];
  }
  return servicesTableCandidates();
}

async function queryServicosTable(
  supabase: SupabaseClient,
  table: string,
  tenantId?: string | null
): Promise<{ data: ServicoRow[] | null; error: string | null }> {
  let query = supabase.from(table).select("id,nome").order("nome");
  if (tenantId?.trim()) {
    query = query.eq("tenant_id", tenantId.trim());
  }
  const { data, error } = await query;
  if (error) return { data: null, error: error.message };
  return { data: (data as ServicoRow[] | null) ?? [], error: null };
}

/** Descobre o nome real da tabela de serviços no PostgREST (cacheia o resultado). */
export async function resolveServicesTableName(
  supabase: SupabaseClient,
  tenantId?: string | null
): Promise<ResolveServicesTableResult> {
  const candidates = candidateOrder();
  let lastMissing: string | null = null;

  for (const table of candidates) {
    const { error } = await queryServicosTable(supabase, table, tenantId);
    if (!error) {
      setResolvedServicesTable(table);
      return { table, error: null };
    }
    if (isMissingServicesTableError(error)) {
      lastMissing = error;
      continue;
    }
    return { table: null, error };
  }

  return {
    table: null,
    error: lastMissing
      ? `${lastMissing} — ${SERVICES_TABLE_SETUP_HINT}`
      : SERVICES_TABLE_SETUP_HINT,
  };
}

/** Consulta serviços na tabela já resolvida (ou tenta descobrir). */
export async function fetchServicos(
  supabase: SupabaseClient,
  tenantId?: string | null
): Promise<FetchServicosResult> {
  const resolved = await resolveServicesTableName(supabase, tenantId);
  if (!resolved.table) {
    return {
      data: [],
      table: servicesTableCandidates()[0] ?? "servicos",
      error: resolved.error,
    };
  }

  const { data, error } = await queryServicosTable(supabase, resolved.table, tenantId);
  if (error) {
    return { data: [], table: resolved.table, error };
  }

  return { data: data ?? [], table: resolved.table, error: null };
}

/** Fetch server-side (PostgREST) com fallback entre tabelas. */
export async function fetchServicosRest(
  url: string,
  anonKey: string,
  headers?: Record<string, string>
): Promise<{ data: ServicoRow[]; table: string; error?: string }> {
  const baseHeaders = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    Accept: "application/json",
    ...headers,
  };

  let lastMissing: string | null = null;

  for (const table of candidateOrder()) {
    const probe = `${url}/rest/v1/${table}?select=id&limit=1`;
    const res = await fetch(probe, { method: "GET", cache: "no-store", headers: baseHeaders });
    if (res.ok) {
      setResolvedServicesTable(table);
      const full = await fetch(`${url}/rest/v1/${table}?select=id,nome&order=nome`, {
        method: "GET",
        cache: "no-store",
        headers: baseHeaders,
      });
      const parsed = full.ok ? ((await full.json()) as unknown) : [];
      return {
        data: Array.isArray(parsed) ? (parsed as ServicoRow[]) : [],
        table,
      };
    }
    const text = await res.text();
    if (isMissingServicesTableError(text)) {
      lastMissing = text.slice(0, 200);
      continue;
    }
    return { data: [], table, error: text.slice(0, 200) };
  }

  return {
    data: [],
    table: servicesTableCandidates()[0] ?? "servicos",
    error: lastMissing ?? SERVICES_TABLE_SETUP_HINT,
  };
}
