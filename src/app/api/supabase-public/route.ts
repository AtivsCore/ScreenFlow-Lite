import { NextResponse } from "next/server";
import {
  logSupabaseEnvDiagnostics,
  resolveSupabaseEnvPairs,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Expõe URL + anon para o cliente quando o stream RSC não trouxer credenciais.
 * Mesmo nível de exposição que NEXT_PUBLIC no bundle; use só rede interna de confiança em produção se preferir.
 */
export async function GET() {
  logSupabaseEnvDiagnostics("api-supabase-public");

  const { url, anonKey } = resolveSupabaseEnvPairs();

  if (!url || !anonKey) {
    return NextResponse.json(
      {
        ok: false,
        message: "Variáveis Supabase ausentes no runtime do servidor.",
        hasUrl: !!url,
        anonKeyCharLength: anonKey.length,
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store, max-age=0" },
      }
    );
  }

  return NextResponse.json(
    { ok: true, url, anonKey },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
