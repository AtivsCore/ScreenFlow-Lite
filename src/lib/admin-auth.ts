import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export function normalizeEmail(value: string | undefined | null): string {
  return (value ?? "").trim().toLowerCase();
}

export function getMasterEmail(): string {
  return normalizeEmail(process.env.NEXT_PUBLIC_MASTER_EMAIL);
}

export function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/** Verifica sessão do painel master (NEXT_PUBLIC_MASTER_EMAIL). */
export async function assertMasterSession(
  supabase?: SupabaseClient
): Promise<{ ok: true; email: string } | { ok: false; status: number; error: string }> {
  const master = getMasterEmail();
  if (!master) {
    return { ok: false, status: 503, error: "NEXT_PUBLIC_MASTER_EMAIL não configurado." };
  }

  const client = supabase ?? (await createServerSupabaseClient());
  const {
    data: { user },
  } = await client.auth.getUser();

  const me = normalizeEmail(user?.email);
  if (!user || me !== master) {
    return { ok: false, status: 403, error: "Não autorizado." };
  }

  return { ok: true, email: me };
}
