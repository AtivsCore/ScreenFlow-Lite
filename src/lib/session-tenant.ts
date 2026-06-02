import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { resolveDefaultTenantId } from "@/lib/tenant-id";

type TenantUserRow = { tenant_id: string };

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
