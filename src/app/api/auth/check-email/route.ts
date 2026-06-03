import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return NextResponse.json({ ok: false, message: "JSON inválido" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, message: "E-mail inválido." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    let page = 1;
    const perPage = 200;

    while (page <= 50) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) {
        return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
      }
      if (data.users.some((u) => (u.email ?? "").toLowerCase() === email)) {
        return NextResponse.json({ ok: true, exists: true });
      }
      if (data.users.length < perPage) break;
      page += 1;
    }

    return NextResponse.json({ ok: true, exists: false });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Serviço indisponível.";
    return NextResponse.json({ ok: false, message }, { status: 503 });
  }
}
