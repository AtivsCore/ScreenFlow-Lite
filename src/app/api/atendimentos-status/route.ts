import { NextResponse } from "next/server";
import {
  finalizeSupabasePublicPair,
  logSupabaseEnvDiagnostics,
  resolveSupabaseEnvPairs,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Body = {
  id?: string;
  status?: string;
  profissional_id?: string | null;
  local_id?: string | null;
  especialidade_id?: string | null;
  tv_id?: string | null;
  observacao?: string | null;
        prioridade?: boolean;
        classificacao_prioridade?: string;
  excluir_do_fechamento?: boolean;
};

/** PATCH parcial via servidor (rede no browser / proxy). */
export async function POST(req: Request) {
  logSupabaseEnvDiagnostics("api-atendimentos-status");

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, message: "JSON inválido" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ ok: false, message: "Campo id obrigatório." }, { status: 400 });
  }

  const payload: Record<string, unknown> = {};
  if (typeof body.status === "string" && body.status.trim()) payload.status = body.status.trim();
  if (body.profissional_id !== undefined) payload.profissional_id = body.profissional_id;
  if (body.local_id !== undefined) payload.local_id = body.local_id;
  if (body.especialidade_id !== undefined) payload.especialidade_id = body.especialidade_id;
  if (body.tv_id !== undefined) payload.tv_id = body.tv_id;
  if (body.observacao !== undefined) payload.observacao = body.observacao;
  if (typeof body.prioridade === "boolean") payload.prioridade = body.prioridade;
  if (typeof body.classificacao_prioridade === "string" && body.classificacao_prioridade.trim()) {
    payload.classificacao_prioridade = body.classificacao_prioridade.trim();
  }
  if (typeof body.excluir_do_fechamento === "boolean") payload.excluir_do_fechamento = body.excluir_do_fechamento;

  if (Object.keys(payload).length === 0) {
    return NextResponse.json(
      { ok: false, message: "Informe ao menos um campo para atualizar." },
      { status: 400 }
    );
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
      body: JSON.stringify(payload),
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
