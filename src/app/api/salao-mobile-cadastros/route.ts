import { NextResponse } from "next/server";
import { fetchServicosRest } from "@/lib/fetch-servicos";
import {
  finalizeSupabasePublicPair,
  logSupabaseEnvDiagnostics,
  resolveSupabaseEnvPairs,
} from "@/lib/supabase";
import { resolvePublicTenantId } from "@/lib/tenant-id";

export const dynamic = "force-dynamic";

/** Cadastros do tenant para a rota mobile do salão (profissionais, locais, serviços). */
export async function GET(request: Request) {
  logSupabaseEnvDiagnostics("api-salao-mobile-cadastros");

  const { searchParams } = new URL(request.url);
  const tenantId = resolvePublicTenantId(searchParams.get("tenant_id"));
  if (!tenantId) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Parâmetro tenant_id obrigatório (UUID). Ex.: /api/salao-mobile-cadastros?tenant_id=<uuid>",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { url, anonKey } = finalizeSupabasePublicPair(resolveSupabaseEnvPairs());
  if (!url || !anonKey) {
    return NextResponse.json({ ok: false, message: "Supabase não configurado." }, { status: 503 });
  }

  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    Accept: "application/json",
  };

  const tenantFilter = `tenant_id=eq.${encodeURIComponent(tenantId)}`;

  try {
    const [profRes, locRes, servicosResult] = await Promise.all([
      fetch(
        `${url}/rest/v1/profissionais?${tenantFilter}&select=id,nome,especialidade&order=nome`,
        { cache: "no-store", headers }
      ),
      fetch(`${url}/rest/v1/locais?${tenantFilter}&select=id,nome&order=nome`, {
        cache: "no-store",
        headers,
      }),
      fetchServicosRest(url, anonKey, tenantId, headers),
    ]);

    const profJson = profRes.ok ? ((await profRes.json()) as unknown) : [];
    const locJson = locRes.ok ? ((await locRes.json()) as unknown) : [];

    return NextResponse.json(
      {
        ok: true,
        tenant_id: tenantId,
        profissionais: Array.isArray(profJson) ? profJson : [],
        locais: Array.isArray(locJson) ? locJson : [],
        servicos: servicosResult.data,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, message: `Falha ao carregar cadastros: ${msg}`, tenant_id: tenantId },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
