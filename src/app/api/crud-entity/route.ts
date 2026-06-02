import { NextResponse } from "next/server";
import { servicesTableCandidates, SERVICES_CRUD_TABLE } from "@/lib/db-tables";
import { fetchServicosRest } from "@/lib/fetch-servicos";
import { resolveTenantForUser } from "@/lib/session-tenant";
import {
  createSupabaseClientSafe,
  finalizeSupabasePublicPair,
  normalizePublicEnvValue,
  resolveSupabaseEnvPairs,
} from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const ALLOWED_TABLES = new Set([
  "profissionais",
  "locais",
  SERVICES_CRUD_TABLE,
  ...servicesTableCandidates(),
]);

type Body = {
  table?: string;
  nome?: string;
  especialidade?: string | null;
  ordem?: number | null;
  tenantId?: string | null;
};

function pickAccessToken(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim() || null;
  }
  return null;
}

/** INSERT em cadastros base: sessão do usuário (RLS) → fallback service role opcional. */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, message: "JSON inválido." }, { status: 400 });
  }

  const table = typeof body.table === "string" ? body.table.trim() : "";
  const nome = typeof body.nome === "string" ? body.nome.trim() : "";
  if (!table || !nome) {
    return NextResponse.json({ ok: false, message: "Campos table e nome são obrigatórios." }, { status: 400 });
  }
  if (!ALLOWED_TABLES.has(table)) {
    return NextResponse.json({ ok: false, message: `Tabela não permitida: ${table}` }, { status: 400 });
  }

  const { url, anonKey } = finalizeSupabasePublicPair(resolveSupabaseEnvPairs());
  if (!url || !anonKey) {
    return NextResponse.json({ ok: false, message: "Supabase não configurado no servidor." }, { status: 503 });
  }

  const accessToken = pickAccessToken(req);
  if (!accessToken) {
    return NextResponse.json({ ok: false, message: "Sessão ausente (Bearer token)." }, { status: 401 });
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ ok: false, message: "Sessão inválida ou expirada." }, { status: 401 });
  }

  const tenantId = await resolveTenantForUser(userClient, userData.user.id, body.tenantId);

  let targetTable = table;
  if (table === SERVICES_CRUD_TABLE || servicesTableCandidates().includes(table)) {
    const discovered = await fetchServicosRest(url, anonKey, tenantId);
    if (!discovered.table || discovered.error) {
      return NextResponse.json(
        {
          ok: false,
          message:
            discovered.error ??
            "Tabela de serviços não encontrada. Execute docs/supabase-lite-create-servicos.sql no Supabase Lite.",
        },
        { status: 400 }
      );
    }
    targetTable = discovered.table;
  }

  const payload: Record<string, unknown> = { nome, tenant_id: tenantId };

  if (targetTable === "profissionais") {
    const esp = typeof body.especialidade === "string" ? body.especialidade.trim() : "";
    if (esp) payload.especialidade = esp;
  }

  if (servicesTableCandidates().includes(targetTable) || targetTable === "servicos") {
    if (typeof body.ordem === "number" && Number.isFinite(body.ordem)) {
      payload.ordem = body.ordem;
    }
  }

  const { error: userInsertErr } = await userClient.from(targetTable).insert(payload);
  if (!userInsertErr) {
    return NextResponse.json(
      { ok: true, tenantId, table: targetTable, via: "session" },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const serviceRole = normalizePublicEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (serviceRole) {
    const admin = createSupabaseClientSafe(url, serviceRole);
    if (admin) {
      const { error: adminErr } = await admin.from(targetTable).insert(payload);
      if (!adminErr) {
        return NextResponse.json(
          { ok: true, tenantId, table: targetTable, via: "service_role" },
          { headers: { "Cache-Control": "no-store" } }
        );
      }
      return NextResponse.json({ ok: false, message: adminErr.message }, { status: 400 });
    }
  }

  const isRls = /row-level security/i.test(userInsertErr.message);
  return NextResponse.json(
    {
      ok: false,
      message: userInsertErr.message,
    },
    { status: isRls ? 403 : 400 }
  );
}
