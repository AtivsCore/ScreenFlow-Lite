import { NextResponse } from "next/server";
import { SERVICES_TABLE } from "@/lib/db-tables";
import { resolveDefaultTenantId } from "@/lib/tenant-id";
import {
  createSupabaseClientSafe,
  finalizeSupabasePublicPair,
  normalizePublicEnvValue,
  resolveSupabaseEnvPairs,
} from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const ALLOWED_TABLES = new Set(["profissionais", "locais", "servicos", "especialidades", SERVICES_TABLE]);

type Body = {
  table?: string;
  nome?: string;
  tenantId?: string | null;
};

function pickAccessToken(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim() || null;
  }
  return null;
}

/** INSERT em cadastros base via service role (após validar sessão). Contorna RLS mal configurado. */
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

  const accessToken = pickAccessToken(req);
  if (!accessToken) {
    return NextResponse.json({ ok: false, message: "Sessão ausente (Bearer token)." }, { status: 401 });
  }

  const { url, anonKey } = finalizeSupabasePublicPair(resolveSupabaseEnvPairs());
  if (!url || !anonKey) {
    return NextResponse.json({ ok: false, message: "Supabase não configurado no servidor." }, { status: 503 });
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ ok: false, message: "Sessão inválida ou expirada." }, { status: 401 });
  }

  const serviceRole = normalizePublicEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!serviceRole) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Cadastro bloqueado por RLS. Configure políticas no Supabase (docs/supabase-lite-rls-cadastros.sql) ou defina SUPABASE_SERVICE_ROLE_KEY no servidor.",
      },
      { status: 503 }
    );
  }

  const admin = createSupabaseClientSafe(url, serviceRole);
  if (!admin) {
    return NextResponse.json({ ok: false, message: "Cliente admin indisponível." }, { status: 503 });
  }

  const tenantId = body.tenantId?.trim() || resolveDefaultTenantId();

  const { error: insertErr } = await admin.from(table).insert({
    nome,
    tenant_id: tenantId,
  });

  if (insertErr) {
    return NextResponse.json({ ok: false, message: insertErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, tenantId }, { headers: { "Cache-Control": "no-store" } });
}
