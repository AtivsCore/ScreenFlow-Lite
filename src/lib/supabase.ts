import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Credenciais públicas do Supabase (NEXT_PUBLIC_*).
 * Preferir valores vindos do RootLayout (SSR/runtime na Vercel); usar process.env só como fallback.
 */

export const NEXT_PUBLIC_SUPABASE_URL_KEY = "NEXT_PUBLIC_SUPABASE_URL" as const;
export const NEXT_PUBLIC_SUPABASE_ANON_KEY_KEY = "NEXT_PUBLIC_SUPABASE_ANON_KEY" as const;

/** Remove espaços e aspas acidentais coladas no painel da Vercel. */
export function normalizePublicEnvValue(raw: string | undefined | null): string {
  if (typeof raw !== "string") return "";
  let s = raw.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function logSupabaseInit(message: string, detail?: unknown): void {
  const prefix = "[ScreenFlow Supabase]";
  if (detail !== undefined) console.warn(prefix, message, detail);
  else console.warn(prefix, message);
}

/** Log seguro para Vercel Runtime Logs (sem expor chave completa). */
export function logSupabaseEnvDiagnostics(scope: string): void {
  const rawUrl = process.env[NEXT_PUBLIC_SUPABASE_URL_KEY];
  const rawAnon = process.env[NEXT_PUBLIC_SUPABASE_ANON_KEY_KEY];
  const url = normalizePublicEnvValue(rawUrl);
  const anonLen = normalizePublicEnvValue(rawAnon).length;
  console.info(`[ScreenFlow][env:${scope}]`, {
    vercelEnv: process.env.VERCEL_ENV ?? "(n/a)",
    nodeEnv: process.env.NODE_ENV,
    typeofRawUrl: typeof rawUrl,
    typeofRawAnon: typeof rawAnon,
    urlPresent: !!url,
    urlPrefix: url ? `${url.slice(0, 36)}…` : "(vazio)",
    anonKeyCharLength: anonLen,
  });
}

export function createSupabaseClientSafe(urlRaw: string, anonKeyRaw: string): SupabaseClient | null {
  const url = normalizePublicEnvValue(urlRaw);
  const anonKey = normalizePublicEnvValue(anonKeyRaw);

  if (!url || !anonKey) {
    logSupabaseInit(
      `Credenciais ausentes ou só com espaços (${NEXT_PUBLIC_SUPABASE_URL_KEY} / ${NEXT_PUBLIC_SUPABASE_ANON_KEY_KEY}).`
    );
    return null;
  }

  const isLocalHttp =
    url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1");
  if (!url.startsWith("https://") && !isLocalHttp) {
    logSupabaseInit(
      `${NEXT_PUBLIC_SUPABASE_URL_KEY} deve usar https:// (produção) ou http://localhost / http://127.0.0.1 (dev).`,
      url.slice(0, 48)
    );
    return null;
  }

  try {
    return createClient(url, anonKey, {
      auth: {
        persistSession: true,
      },
    });
  } catch (err) {
    console.error("[ScreenFlow Supabase] createClient falhou (URL/chave malformadas?)", err);
    return null;
  }
}

/** Fallback: apenas substituição estática do bundler em `process.env` (localhost / builds antigos). */
export function createSupabaseBrowserClient(): SupabaseClient | null {
  return createSupabaseClientSafe(
    process.env[NEXT_PUBLIC_SUPABASE_URL_KEY] ?? "",
    process.env[NEXT_PUBLIC_SUPABASE_ANON_KEY_KEY] ?? ""
  );
}
