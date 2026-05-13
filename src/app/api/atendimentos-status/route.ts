import { NextResponse } from "next/server";
import {
  finalizeSupabasePublicPair,
  logSupabaseEnvDiagnostics,
  resolveSupabaseEnvPairs,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Body = { id?: string; status?: string };

/** PATCH via servidor (mesmo motivo do GET da fila: rede no browser). */
export async function POST(req: Request) {
  logSupabaseEnvDiagnostics("api-atendimentos-status");

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, message: "JSON inválido" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const status = typeof body.status === "string" ? body.status.trim() : "";
  if (!id || !status) {
    return NextResponse.json({ ok: false, message: "Campos id e status obrigatórios." }, { status: 400 });
  }

  const { url, anonKey } = finalizeSupabasePublicPair(resolveSupabaseEnvPairs());
  if (!url || !anonKey) {
    return NextResponse.json({ ok: false, message: "Supabase não configurado no servidor." }, { status: 503 });
  }

  const endpoint = `${url}/rest/v1/atendimentos_lite?id=eq.${encodeURIComponent(id)}`;

  try {
    const res = await fetch(endpoint, {
      method: "PATCH",
      cache: "no-store",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) {
      const text = await res.text();
      let message = text.slice(0, 400);
      try {
        const j = JSON.parse(text) as { message?: string; hint?: string };
        message = [j.message, j.hint].filter(Boolean).join(" — ") || message;
      } catch {
        /* */
      }
      return NextResponse.json(
        { ok: false, message, status: res.status },
        { status: res.status >= 500 ? 502 : res.status }
      );
    }

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ScreenFlow] api/atendimentos-status:", e);
    return NextResponse.json({ ok: false, message: msg }, { status: 502 });
  }
}
