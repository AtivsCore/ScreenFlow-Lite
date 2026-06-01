import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { assertMasterSession, isValidEmail } from "@/lib/admin-auth";
import { getLiteLoginUrl, getLitePublicBaseUrl } from "@/lib/lite-public-urls";
import { createAdminClient } from "@/lib/supabase-admin";

type Body = {
  nome?: string;
  slug?: string;
  email?: string;
};

export async function POST(request: Request) {
  const auth = await assertMasterSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const nome = typeof body.nome === "string" ? body.nome.trim() : "";
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const emailOpt = typeof body.email === "string" ? body.email.trim() : "";

  if (nome.length === 0 || slug.length === 0) {
    return NextResponse.json({ error: "nome e slug são obrigatórios" }, { status: 400 });
  }
  if (emailOpt.length > 0 && !isValidEmail(emailOpt)) {
    return NextResponse.json({ error: "Email do cliente inválido." }, { status: 400 });
  }

  const licenca_key = randomUUID();
  const tenantId = randomUUID();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("tenants")
    .insert({
      id: tenantId,
      nome,
      slug,
      plano: "lite",
      status: "ativo",
      licenca_key,
      configuracoes: {},
    })
    .select("id, licenca_key")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (data === null) {
    return NextResponse.json({ error: "Falha ao criar" }, { status: 400 });
  }

  if (emailOpt.length === 0) {
    return NextResponse.json({ id: data.id, licenca_key: data.licenca_key }, { status: 200 });
  }

  const senhaTemp = randomUUID();
  const emailLower = emailOpt.toLowerCase();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: emailLower,
    password: senhaTemp,
    email_confirm: true,
  });

  if (createErr !== null) {
    await admin.from("tenants").delete().eq("id", tenantId);
    return NextResponse.json({ error: `Conta: ${createErr.message}` }, { status: 400 });
  }
  if (created.user === null) {
    await admin.from("tenants").delete().eq("id", tenantId);
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
    await admin.from("tenants").delete().eq("id", tenantId);
    return NextResponse.json({ error: `Vínculo tenant: ${linkTuErr.message}` }, { status: 500 });
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
    return NextResponse.json(
      {
        id: data.id,
        licenca_key: data.licenca_key,
        error_link: glErr.message,
        link_acesso: null,
      },
      { status: 200 }
    );
  }

  const props = glData?.properties as { action_link?: string } | null | undefined;
  const actionLink = typeof props?.action_link === "string" ? props.action_link : "";
  if (actionLink.length === 0) {
    return NextResponse.json(
      {
        id: data.id,
        licenca_key: data.licenca_key,
        error_link: "Resposta de link inesperada",
        link_acesso: null,
      },
      { status: 200 }
    );
  }

  return NextResponse.json(
    { id: data.id, licenca_key: data.licenca_key, link_acesso: actionLink },
    { status: 200 }
  );
}
