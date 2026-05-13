import { NextResponse } from "next/server";
import { ATENDIMENTOS_LITE_REST_SELECT } from "@/lib/atendimentos-rest";
import {
  finalizeSupabasePublicPair,
  logSupabaseEnvDiagnostics,
  resolveSupabaseEnvPairs,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Proxy server-side para PostgREST: contorna bloqueios de rede no browser
 * (extensões, DNS, “Failed to fetch”) que não afetam o fetch Vercel → Supabase.
 */
export async function GET() {
  logSupabaseEnvDiagnostics("api-atendimentos-queue");

  const { url, anonKey } = finalizeSupabasePublicPair(resolveSupabaseEnvPairs());
  if (!url || !anonKey) {
    return NextResponse.json(
      { ok: false, message: "Supabase não configurado no servidor." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const endpoint = `${url}/rest/v1/atendimentos_lite?select=${encodeURIComponent(ATENDIMENTOS_LITE_REST_SELECT)}`;

  try {
    const res = await fetch(endpoint, {
      method: "GET",
      cache: "no-store",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
      },
    });

    const text = await res.text();
    if (!res.ok) {
      let message = text.slice(0, 400);
      try {
        const j = JSON.parse(text) as { message?: string; hint?: string };
        message = [j.message, j.hint].filter(Boolean).join(" — ") || message;
      } catch {
        /* texto plano */
      }
      return NextResponse.json(
        { ok: false, message, status: res.status },
        { status: res.status >= 500 ? 502 : res.status, headers: { "Cache-Control": "no-store" } }
      );
    }

    const data = JSON.parse(text) as unknown;
    return NextResponse.json({ ok: true, data }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ScreenFlow] api/atendimentos-queue fetch:", e);
    return NextResponse.json(
      { ok: false, message: `Servidor não alcançou o Supabase: ${msg}` },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
