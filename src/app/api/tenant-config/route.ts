import { NextResponse } from "next/server";
import {
  finalizeSupabasePublicPair,
  logSupabaseEnvDiagnostics,
  resolveSupabaseEnvPairs,
} from "@/lib/supabase";
import { mergeTenantConfig } from "@/lib/tenant-config";

export const dynamic = "force-dynamic";

/** Configuração pública do tenant (somente leitura) para `/display`. Requer RLS que permita `select` em `tenants` ou falha silenciosa com defaults. */
export async function GET(req: Request) {
  logSupabaseEnvDiagnostics("api-tenant-config");

  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenant_id")?.trim();
  if (!tenantId) {
    return NextResponse.json({ ok: true, config: mergeTenantConfig({}), source: "defaults-no-tenant" });
  }

  const { url, anonKey } = finalizeSupabasePublicPair(resolveSupabaseEnvPairs());
  if (!url || !anonKey) {
    return NextResponse.json({ ok: false, message: "Supabase não configurado." }, { status: 503 });
  }

  const endpoint = `${url}/rest/v1/tenants?id=eq.${encodeURIComponent(tenantId)}&select=configuracoes`;

  try {
    const res = await fetch(endpoint, {
      cache: "no-store",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
      },
    });

    const text = await res.text();
    if (!res.ok) {
      const merged = mergeTenantConfig({});
      return NextResponse.json({ ok: true, config: merged, source: "defaults-rpc-failed" });
    }

    const data = JSON.parse(text) as unknown;
    const row = Array.isArray(data) ? data[0] : null;
    const rawCfg =
      row && typeof row === "object" && row !== null && "configuracoes" in row
        ? (row as { configuracoes?: unknown }).configuracoes
        : undefined;

    const merged = mergeTenantConfig(rawCfg ?? {});
    return NextResponse.json({ ok: true, config: merged }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: true, config: mergeTenantConfig({}), source: "defaults-error" });
  }
}
