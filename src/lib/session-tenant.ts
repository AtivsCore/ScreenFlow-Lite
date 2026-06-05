import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { resolveDefaultTenantId } from "@/lib/tenant-id";

type TenantUserRow = { tenant_id: string };

export type SessionTenantOption = { id: string; nome: string | null };

/** Tenant vinculado ao usuário autenticado em tenant_users (base das políticas RLS Lite). */
export async function fetchSessionTenantId(supabase: SupabaseClient): Promise<string | null> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return null;

  const { data, error } = (await supabase
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle()) as { data: TenantUserRow | null; error: PostgrestError | null };

  if (error || !data?.tenant_id) return null;
  return String(data.tenant_id);
}

/** Resolve tenant da sessão (tenant_users) com fallback opcional do body/env. */
export async function resolveTenantForUser(
  supabase: SupabaseClient,
  userId: string,
  bodyTenantId?: string | null
): Promise<string> {
  const { data } = (await supabase
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", userId)
    .maybeSingle()) as { data: TenantUserRow | null; error: PostgrestError | null };

  const sessionTenant = data?.tenant_id ? String(data.tenant_id) : null;
  if (sessionTenant) return sessionTenant;
  return bodyTenantId?.trim() || resolveDefaultTenantId();
}

/** Bases/aeroportos vinculados ao usuário autenticado (para seletor global na aviação). */
export async function fetchSessionTenants(supabase: SupabaseClient): Promise<SessionTenantOption[]> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return [];

  const { data: links, error: linkErr } = (await supabase
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", user.id)) as { data: TenantUserRow[] | null; error: PostgrestError | null };

  if (linkErr || !links?.length) return [];

  const ids = [...new Set(links.map((r) => String(r.tenant_id)).filter(Boolean))];
  if (ids.length === 0) return [];

  const { data: tenants, error: tenantErr } = await supabase
    .from("tenants")
    .select("id, nome")
    .in("id", ids);

  if (tenantErr || !tenants) return [];

  return (tenants as SessionTenantOption[])
    .slice()
    .sort((a, b) => (a.nome ?? a.id).localeCompare(b.nome ?? b.id, "pt-BR"));
}
