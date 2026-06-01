import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createSupabaseClientSafe,
  finalizeSupabasePublicPair,
  normalizePublicEnvValue,
  resolveSupabaseEnvPairs,
} from "@/lib/supabase";

/** Cliente Supabase com service role — somente servidor (API admin / RSC). */
export function createAdminClient(): SupabaseClient {
  const { url } = finalizeSupabasePublicPair(resolveSupabaseEnvPairs());
  const serviceKey = normalizePublicEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY e NEXT_PUBLIC_SUPABASE_URL são obrigatórios para o painel admin Lite."
    );
  }
  const client = createSupabaseClientSafe(url, serviceKey);
  if (!client) {
    throw new Error("Falha ao criar cliente admin Supabase.");
  }
  return client;
}
