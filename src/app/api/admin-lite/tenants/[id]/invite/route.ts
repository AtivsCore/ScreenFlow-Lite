import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";
import { assertMasterSession, isValidEmail } from "@/lib/admin-auth";
import { getLiteLoginUrl, getLitePublicBaseUrl } from "@/lib/lite-public-urls";
import { createAdminClient } from "@/lib/supabase-admin";

type Body = { email?: string };

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await assertMasterSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: tenantId } = await context.params;
  if (!tenantId) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const emailRaw = typeof body.email === "string" ? body.email.trim() : "";
  if (emailRaw.length === 0 || !isValidEmail(emailRaw)) {
    return NextResponse.json({ error: "Email inválido." }, { status: 400 });
  }
  const emailLower = emailRaw.toLowerCase();

  const admin = createAdminClient();

  const { data: tenantRow, error: tErr } = (await admin
    .from("tenants")
    .select("id")
    .eq("id", tenantId)
    .maybeSingle()) as {
    data: { id: string } | null;
    error: PostgrestError | null;
  };

  if (tErr !== null) {
    return NextResponse.json({ error: tErr.message }, { status: 400 });
  }
  if (tenantRow === null) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  const { data: existingTu, error: tuErr } = (await admin
    .from("tenant_users")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle()) as {
    data: { user_id: string } | null;
    error: PostgrestError | null;
  };

  if (tuErr !== null) {
    return NextResponse.json({ error: tuErr.message }, { status: 400 });
  }
  if (existingTu !== null) {
    return NextResponse.json(
      { error: "Este cliente já tem usuário vinculado." },
      { status: 409 }
    );
  }

  const senhaTemp = randomUUID();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: emailLower,
    password: senhaTemp,
    email_confirm: true,
  });

  if (createErr !== null) {
    return NextResponse.json({ error: `Conta: ${createErr.message}` }, { status: 400 });
  }
  if (created.user === null) {
    return NextResponse.json({ error: "Falha ao criar usuário." }, { status: 500 });
  }

  const newUserId = created.user.id;
  const { error: linkTuErr } = await admin.from("tenant_users").insert({
    tenant_id: tenantId,
    user_id: newUserId,
    role: "owner",
  });

  if (linkTuErr != null) {
    await admin.auth.admin.deleteUser(newUserId);
    return NextResponse.json(
      { error: `Vínculo tenant: ${linkTuErr.message}` },
      { status: 500 }
    );
  }

  const appBase = getLitePublicBaseUrl();
  const { data: glData, error: glErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: emailLower,
    options: {
      redirectTo: appBase.length > 0 ? getLiteLoginUrl() : undefined,
    },
  });

  if (glErr != null) {
    return NextResponse.json({ error: glErr.message }, { status: 500 });
  }

  const props = glData?.properties as { action_link?: string } | null | undefined;
  const link = typeof props?.action_link === "string" ? props.action_link : "";
  if (link.length === 0) {
    return NextResponse.json({ error: "Não foi possível gerar o link." }, { status: 500 });
  }

  return NextResponse.json({ link, email: emailLower });
}
