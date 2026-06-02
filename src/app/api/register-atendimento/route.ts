import { NextResponse } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";
import { resolveTenantForUser } from "@/lib/session-tenant";
import {
  createSupabaseClientSafe,
  finalizeSupabasePublicPair,
  normalizePublicEnvValue,
  resolveSupabaseEnvPairs,
} from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type Body = {
  tenantId?: string | null;
  pacienteNome?: string | null;
  atendimento?: Record<string, unknown> | null;
};

function pickAccessToken(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim() || null;
  }
  return null;
}

/** Novo registro na fila: paciente (opcional) + atendimentos_lite com tenant da sessão. */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, message: "JSON inválido." }, { status: 400 });
  }

  const atendimento = body.atendimento;
  if (!atendimento || typeof atendimento !== "object") {
    return NextResponse.json({ ok: false, message: "Campo atendimento é obrigatório." }, { status: 400 });
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
  const serviceRole = normalizePublicEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const admin = serviceRole ? createSupabaseClientSafe(url, serviceRole) : null;

  let pacienteId: string | null =
    typeof atendimento.paciente_id === "string" && atendimento.paciente_id.trim()
      ? atendimento.paciente_id.trim()
      : null;
  const pacienteNome = typeof body.pacienteNome === "string" ? body.pacienteNome.trim() : "";
  if (pacienteNome && !pacienteId) {
    const pacientePayload = { nome: pacienteNome, tenant_id: tenantId };
    const { data: pRow, error: pErr } = (await userClient
      .from("pacientes")
      .insert(pacientePayload)
      .select("id")
      .single()) as { data: { id: string } | null; error: PostgrestError | null };

    if (pErr || !pRow) {
      if (admin) {
        const { data: adminRow, error: adminErr } = (await admin
          .from("pacientes")
          .insert(pacientePayload)
          .select("id")
          .single()) as { data: { id: string } | null; error: PostgrestError | null };
        if (adminErr || !adminRow) {
          return NextResponse.json(
            { ok: false, message: adminErr?.message ?? pErr?.message ?? "Falha ao criar cliente." },
            { status: 403 }
          );
        }
        pacienteId = String(adminRow.id);
      } else {
        return NextResponse.json(
          { ok: false, message: pErr?.message ?? "Falha ao criar cliente." },
          { status: 403 }
        );
      }
    } else {
      pacienteId = String(pRow.id);
    }
  }

  const atendimentoPayload: Record<string, unknown> = {
    ...atendimento,
    tenant_id: tenantId,
    paciente_id: pacienteId,
  };

  const { error: aErr } = (await userClient
    .from("atendimentos_lite")
    .insert(atendimentoPayload)) as { error: PostgrestError | null };

  if (aErr) {
    if (admin) {
      const { error: adminErr } = (await admin
        .from("atendimentos_lite")
        .insert(atendimentoPayload)) as { error: PostgrestError | null };
      if (adminErr) {
        return NextResponse.json({ ok: false, message: adminErr.message }, { status: 403 });
      }
    } else {
      return NextResponse.json({ ok: false, message: aErr.message }, { status: 403 });
    }
  }

  return NextResponse.json(
    { ok: true, tenantId, pacienteId },
    { headers: { "Cache-Control": "no-store" } }
  );
}
