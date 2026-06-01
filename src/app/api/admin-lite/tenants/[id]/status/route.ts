import { NextResponse } from "next/server";
import { assertMasterSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";

type Body = { status?: string };

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await assertMasterSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const status = typeof body.status === "string" ? body.status.trim() : "";
  if (status !== "ativo" && status !== "bloqueado") {
    return NextResponse.json(
      { error: "status deve ser 'ativo' ou 'bloqueado'" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("tenants").update({ status }).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
