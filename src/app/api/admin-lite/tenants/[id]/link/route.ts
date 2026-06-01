import { NextResponse } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";
import { assertMasterSession } from "@/lib/admin-auth";
import { getLiteLoginUrl } from "@/lib/lite-public-urls";
import { createAdminClient } from "@/lib/supabase-admin";

export async function GET(
  _request: Request,
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

  const admin = createAdminClient();

  const { data: tenantRow, error: tenantErr } = (await admin
    .from("tenants")
    .select("id")
    .eq("id", tenantId)
    .maybeSingle()) as {
    data: { id: string } | null;
    error: PostgrestError | null;
  };

  if (tenantErr !== null) {
    return NextResponse.json({ error: tenantErr.message }, { status: 400 });
  }
  if (tenantRow === null) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  const { data: rowTu, error: tuErr } = (await admin
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
  if (rowTu === null) {
    return NextResponse.json(
      { error: "Este cliente ainda não tem usuário vinculado." },
      { status: 404 }
    );
  }

  const userId = rowTu.user_id;
  const { data: uData, error: gErr } = await admin.auth.admin.getUserById(userId);
  if (gErr != null) {
    return NextResponse.json({ error: gErr.message }, { status: 400 });
  }

  const email = uData.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Usuário sem email." }, { status: 500 });
  }

  const novaSenha = Math.random().toString(36).slice(-8).toUpperCase();
  const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
    password: novaSenha,
  });

  if (updErr != null) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({
    email,
    senha: novaSenha,
    link: getLiteLoginUrl(),
  });
}
