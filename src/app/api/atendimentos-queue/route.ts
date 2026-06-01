import { NextResponse } from "next/server";
import { ATENDIMENTOS_LITE_REST_SELECT, type ServicoRow } from "@/lib/atendimentos-rest";
import { fetchServicosRest } from "@/lib/fetch-servicos";
import {
  finalizeSupabasePublicPair,
  logSupabaseEnvDiagnostics,
  resolveSupabaseEnvPairs,
} from "@/lib/supabase";
import { resolvePublicTenantId } from "@/lib/tenant-id";

export const dynamic = "force-dynamic";

/**
 * Proxy server-side para PostgREST (anon): contorna bloqueios de rede no browser.
 * Obrigatório ?tenant_id=<uuid> — isolamento multi-tenant na camada API.
 */
export async function GET(request: Request) {
  logSupabaseEnvDiagnostics("api-atendimentos-queue");

  const { searchParams } = new URL(request.url);
  const tenantId = resolvePublicTenantId(searchParams.get("tenant_id"));
  if (!tenantId) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Parâmetro tenant_id obrigatório (UUID). Ex.: /api/atendimentos-queue?tenant_id=<uuid>",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { url, anonKey } = finalizeSupabasePublicPair(resolveSupabaseEnvPairs());
  if (!url || !anonKey) {
    return NextResponse.json(
      { ok: false, message: "Supabase não configurado no servidor." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    Accept: "application/json",
  };

  const tenantFilter = `tenant_id=eq.${encodeURIComponent(tenantId)}`;
  const endpoint = `${url}/rest/v1/atendimentos_lite?${tenantFilter}&select=${encodeURIComponent(ATENDIMENTOS_LITE_REST_SELECT)}`;

  try {
    const [atendRes, servicosResult] = await Promise.all([
      fetch(endpoint, { method: "GET", cache: "no-store", headers }),
      fetchServicosRest(url, anonKey, tenantId),
    ]);

    const text = await atendRes.text();
    if (!atendRes.ok) {
      let message = text.slice(0, 400);
      try {
        const j = JSON.parse(text) as { message?: string; hint?: string };
        message = [j.message, j.hint].filter(Boolean).join(" — ") || message;
      } catch {
        /* texto plano */
      }
      return NextResponse.json(
        { ok: false, message, status: atendRes.status, tenant_id: tenantId },
        { status: atendRes.status >= 500 ? 502 : atendRes.status, headers: { "Cache-Control": "no-store" } }
      );
    }

    const data = JSON.parse(text) as unknown;

    const servicos: ServicoRow[] = servicosResult.data;

    return NextResponse.json(
      { ok: true, tenant_id: tenantId, data, servicos, servicosTable: servicosResult.table },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ScreenFlow] api/atendimentos-queue fetch:", e);
    return NextResponse.json(
      { ok: false, message: `Servidor não alcançou o Supabase: ${msg}`, tenant_id: tenantId },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
