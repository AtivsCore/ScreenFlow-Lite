import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Usa apenas estes nomes — embutidos no bundle em build (NEXT_PUBLIC_*).
 *
 * Esta função é segura para SSR e navegador: não lança; retorna null se inválido.
 *
 * Replicação Realtime para `atendimentos_lite` no Supabase (Replication).
 */

const URL_KEY = "NEXT_PUBLIC_SUPABASE_URL" as const;
const ANON_KEY_KEY = "NEXT_PUBLIC_SUPABASE_ANON_KEY" as const;

let browserClient: SupabaseClient | null = null;

function logSupabaseInit(message: string, detail?: unknown): void {
  const prefix = "[ScreenFlow Supabase]";
  if (detail !== undefined) console.warn(prefix, message, detail);
  else console.warn(prefix, message);
}

export function createSupabaseBrowserClient(): SupabaseClient | null {
  const rawUrl = process.env[URL_KEY];
  const rawAnon = process.env[ANON_KEY_KEY];
  const url = typeof rawUrl === "string" ? rawUrl.trim() : "";
  const anonKey = typeof rawAnon === "string" ? rawAnon.trim() : "";

  if (!url || !anonKey) {
    logSupabaseInit(
      `Credenciais ausentes ou só com espaços. Defina ${URL_KEY} e ${ANON_KEY_KEY} (.env.local local / Environment Variables na Vercel). Redeploy após alterar variáveis.`
    );
    browserClient = null;
    return null;
  }

  const isLocalHttp =
    url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1");
  if (!url.startsWith("https://") && !isLocalHttp) {
    logSupabaseInit(
      `${URL_KEY} deve usar https:// (produção) ou http://localhost / http://127.0.0.1 (dev).`,
      url.slice(0, 48)
    );
    browserClient = null;
    return null;
  }

  try {
    if (!browserClient) {
      browserClient = createClient(url, anonKey, {
        auth: {
          persistSession: true,
        },
      });
    }
    return browserClient;
  } catch (err) {
    console.error("[ScreenFlow Supabase] createClient falhou (URL/chave malformadas?)", err);
    browserClient = null;
    return null;
  }
}
