import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Chaves públicas (embutidas no cliente em build quando presentes). */
export const NEXT_PUBLIC_SUPABASE_URL_KEY = "NEXT_PUBLIC_SUPABASE_URL" as const;
export const NEXT_PUBLIC_SUPABASE_ANON_KEY_KEY = "NEXT_PUBLIC_SUPABASE_ANON_KEY" as const;

/** Aliases só no servidor/Vercel (não aparecem no bundle do browser). Evita falha se só estiverem no env “normal”. */
export const SUPABASE_URL_KEY = "SUPABASE_URL" as const;
export const SUPABASE_ANON_KEY_KEY = "SUPABASE_ANON_KEY" as const;

export type SupabasePublicPair = { url: string; anonKey: string };

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

/**
 * Resolve URL + anon a partir do `process.env` atual (SSR, Route Handler, CI).
 * Ordem: NEXT_PUBLIC_* → SUPABASE_* (somente servidor / rota API).
 */
export function resolveSupabaseEnvPairs(): SupabasePublicPair {
  const url =
    normalizePublicEnvValue(process.env[NEXT_PUBLIC_SUPABASE_URL_KEY]) ||
    normalizePublicEnvValue(process.env[SUPABASE_URL_KEY]);

  const anonKey =
    normalizePublicEnvValue(process.env[NEXT_PUBLIC_SUPABASE_ANON_KEY_KEY]) ||
    normalizePublicEnvValue(process.env[SUPABASE_ANON_KEY_KEY]);

  return { url, anonKey };
}

function logSupabaseInit(message: string, detail?: unknown): void {
  const prefix = "[ScreenFlow Supabase]";
  if (detail !== undefined) console.warn(prefix, message, detail);
  else console.warn(prefix, message);
}

/** Log seguro para Vercel Runtime Logs (não imprime chave inteira). */
export function logSupabaseEnvDiagnostics(scope: string): void {
  const { url, anonKey } = resolveSupabaseEnvPairs();

  console.info(`[ScreenFlow][env:${scope}]`, {
    vercelEnv: process.env.VERCEL_ENV ?? "(n/a)",
    nodeEnv: process.env.NODE_ENV,
    hasNpUrl: !!normalizePublicEnvValue(process.env[NEXT_PUBLIC_SUPABASE_URL_KEY]),
    hasNpAnon: !!normalizePublicEnvValue(process.env[NEXT_PUBLIC_SUPABASE_ANON_KEY_KEY]),
    hasSrvUrl: !!normalizePublicEnvValue(process.env[SUPABASE_URL_KEY]),
    hasSrvAnon: !!normalizePublicEnvValue(process.env[SUPABASE_ANON_KEY_KEY]),
    mergedUrlChars: url.length,
    urlPrefix: url ? `${url.slice(0, 36)}…` : "(vazio)",
    anonKeyCharLength: anonKey.length,
  });
}

export function createSupabaseClientSafe(urlRaw: string, anonKeyRaw: string): SupabaseClient | null {
  const url = normalizePublicEnvValue(urlRaw);
  const anonKey = normalizePublicEnvValue(anonKeyRaw);

  if (!url || !anonKey) {
    logSupabaseInit(
      `Credenciais ausentes (${NEXT_PUBLIC_SUPABASE_URL_KEY} / ${NEXT_PUBLIC_SUPABASE_ANON_KEY_KEY} ou aliases ${SUPABASE_URL_KEY} / ${SUPABASE_ANON_KEY_KEY} no servidor).`
    );
    return null;
  }

  const isLocalHttp =
    url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1");
  if (!url.startsWith("https://") && !isLocalHttp) {
    logSupabaseInit(`${NEXT_PUBLIC_SUPABASE_URL_KEY} deve usar https:// (produção) ou http localhost (dev).`, url.slice(0, 48));
    return null;
  }

  try {
    return createClient(url, anonKey, {
      auth: {
        persistSession: true,
      },
    });
  } catch (err) {
    console.error("[ScreenFlow Supabase] createClient falhou", err);
    return null;
  }
}

/** Fallback no browser: apenas chaves NEXT_PUBLIC_* (inlining do bundler). */
export function createSupabaseBrowserClient(): SupabaseClient | null {
  const url = normalizePublicEnvValue(process.env[NEXT_PUBLIC_SUPABASE_URL_KEY]);
  const anonKey = normalizePublicEnvValue(process.env[NEXT_PUBLIC_SUPABASE_ANON_KEY_KEY]);
  return createSupabaseClientSafe(url, anonKey);
}
