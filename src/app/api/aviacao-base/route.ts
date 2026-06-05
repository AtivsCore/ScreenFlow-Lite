import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  finalizeSupabasePublicPair,
  resolveSupabaseEnvPairs,
} from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import {
  AVIACAO_BASE_LIMIT_UPSELL_DESCRIPTION,
  AVIACAO_FREE_BASE_LIMIT,
} from "@/lib/aviacao-logistics";
import { isProPlan, resolvePlanTier, type PlanTier } from "@/lib/plan-tier";

export const dynamic = "force-dynamic";

type Body = {
  nome?: string;
  sourceTenantId?: string | null;
};

function slugifyBaseName(nome: string): string {
  const base = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `base-${Date.now()}`;
}

function pickAccessToken(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim() || null;
  }
  return null;
}

/** Cadastro rápido de base/aeroporto (tenant) vinculado ao usuário autenticado. */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, message: "JSON inválido." }, { status: 400 });
  }

  const nome = typeof body.nome === "string" ? body.nome.trim() : "";
  if (!nome) {
    return NextResponse.json({ ok: false, message: "Nome da base é obrigatório." }, { status: 400 });
  }

  const { url, anonKey } = finalizeSupabasePublicPair(resolveSupabaseEnvPairs());
  if (!url || !anonKey) {
    return NextResponse.json({ ok: false, message: "Supabase não configurado." }, { status: 503 });
  }

  const accessToken = pickAccessToken(req);
  if (!accessToken) {
    return NextResponse.json({ ok: false, message: "Sessão ausente." }, { status: 401 });
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ ok: false, message: "Sessão inválida." }, { status: 401 });
  }

  const userId = userData.user.id;
  const sourceTenantId =
    typeof body.sourceTenantId === "string" ? body.sourceTenantId.trim() : "";

  const { data: userLinks } = await userClient
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", userId);
  const linkedBaseCount = userLinks?.length ?? 0;

  let configuracoes: Record<string, unknown> = {};
  let segmentoDefinido: string | null = null;
  if (sourceTenantId) {
    const { data: source } = await userClient
      .from("tenants")
      .select("configuracoes, segmento_definido")
      .eq("id", sourceTenantId)
      .maybeSingle();
    if (source) {
      configuracoes =
        source.configuracoes && typeof source.configuracoes === "object"
          ? (source.configuracoes as Record<string, unknown>)
          : {};
      segmentoDefinido =
        typeof source.segmento_definido === "string" ? source.segmento_definido : null;
    }
  }

  const planTier = resolvePlanTier(
    typeof configuracoes.planTier === "string" ? (configuracoes.planTier as PlanTier) : null
  );
  if (!isProPlan(planTier) && linkedBaseCount >= AVIACAO_FREE_BASE_LIMIT) {
    return NextResponse.json(
      {
        ok: false,
        code: "BASE_LIMIT",
        message: AVIACAO_BASE_LIMIT_UPSELL_DESCRIPTION,
      },
      { status: 403 }
    );
  }

  const tenantId = randomUUID();
  const slug = `${slugifyBaseName(nome)}-${tenantId.slice(0, 8)}`;

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Admin indisponível.";
    return NextResponse.json({ ok: false, message: msg }, { status: 503 });
  }

  const { error: insertErr } = await admin.from("tenants").insert({
    id: tenantId,
    nome,
    slug,
    plano: "lite",
    status: "ativo",
    licenca_key: randomUUID(),
    configuracoes,
    segmento_definido: segmentoDefinido,
  });

  if (insertErr) {
    return NextResponse.json({ ok: false, message: insertErr.message }, { status: 400 });
  }

  const { error: linkErr } = await admin.from("tenant_users").insert({
    tenant_id: tenantId,
    user_id: userId,
    role: "owner",
  });

  if (linkErr) {
    await admin.from("tenants").delete().eq("id", tenantId);
    return NextResponse.json({ ok: false, message: linkErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: tenantId, nome }, { status: 200 });
}
