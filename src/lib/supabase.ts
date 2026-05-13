import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente browser (usa NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY).
 *
 * A listagem usa joins via PostgREST (`pacientes`, `profissionais`, `locais`), com FKs
 * definidas no Supabase entre `atendimentos_lite` e essas tabelas.
 *
 * Ative Realtime para `atendimentos_lite` (Replication) se quiser atualização ao vivo na Vercel.
 */

let browserClient: SupabaseClient | null = null;

export function createSupabaseBrowserClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  if (!browserClient) {
    browserClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
      },
    });
  }
  return browserClient;
}
