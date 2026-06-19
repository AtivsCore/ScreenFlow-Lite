import { NextResponse } from "next/server";
import {
  createSupabaseClientSafe,
  finalizeSupabasePublicPair,
  logSupabaseEnvDiagnostics,
  normalizePublicEnvValue,
  resolveSupabaseEnvPairs,
} from "@/lib/supabase";
import { isSalaoEsteticaSegment } from "@/lib/salao-estetica-logistics";
import { mergeTenantConfig } from "@/lib/tenant-config";
import { resolvePublicTenantId } from "@/lib/tenant-id";

export const dynamic = "force-dynamic";

type Body = {
  id?: string;
  tenant_id?: string;
  /** Mutação operacional da fila mobile (QR) — bypass de sessão com service role. */
  salao_mobile?: boolean;
  status?: string;
  profissional_id?: string | null;
  local_id?: string | null;
  especialidade_id?: string | null;
  tv_id?: string | null;
  observacao?: string | null;
  cadastro_valores?: Record<string, string | null>;
  prioridade?: boolean;
  classificacao_prioridade?: string;
  excluir_do_fechamento?: boolean;
};

type PatchResult =
  | { ok: true; rows: unknown[]; via: string }
  | { ok: false; status: number; message: string };

async function fetchTenantSegmentoAplicado(
  url: string,
  authKey: string,
  tenantId: string
): Promise<string | null> {
  const endpoint = `${url}/rest/v1/tenants?id=eq.${encodeURIComponent(tenantId)}&select=configuracoes`;
  const res = await fetch(endpoint, {
    cache: "no-store",
    headers: {
      apikey: authKey,
      Authorization: `Bearer ${authKey}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) return null;
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    const data = JSON.parse(text) as unknown;
    const row = Array.isArray(data) ? data[0] : null;
    const rawCfg =
      row && typeof row === "object" && row !== null && "configuracoes" in row
        ? (row as { configuracoes?: unknown }).configuracoes
        : undefined;
    return mergeTenantConfig(rawCfg ?? {}).segmentoAplicado ?? null;
  } catch {
    return null;
  }
}

async function patchAtendimentoRest(
  url: string,
  authKey: string,
  id: string,
  tenantId: string | null,
  payload: Record<string, unknown>
): Promise<PatchResult> {
  let endpoint = `${url}/rest/v1/atendimentos_lite?id=eq.${encodeURIComponent(id)}`;
  if (tenantId) {
    endpoint += `&tenant_id=eq.${encodeURIComponent(tenantId)}`;
  }

  const res = await fetch(endpoint, {
    method: "PATCH",
    cache: "no-store",
    headers: {
      apikey: authKey,
      Authorization: `Bearer ${authKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) {
    let message = text.slice(0, 400);
    try {
      const j = JSON.parse(text) as { message?: string; hint?: string };
      message = [j.message, j.hint].filter(Boolean).join(" — ") || message;
    } catch {
      /* texto plano */
    }
    return {
      ok: false,
      status: res.status >= 500 ? 502 : res.status,
      message,
    };
  }

  let rows: unknown[] = [];
  if (text.trim()) {
    try {
      const parsed = JSON.parse(text) as unknown;
      rows = Array.isArray(parsed) ? parsed : [];
    } catch {
      rows = [];
    }
  }

  if (rows.length === 0) {
    return {
      ok: false,
      status: 404,
      message: "Nenhum registro atualizado (id/tenant inválido ou bloqueio RLS).",
    };
  }

  return { ok: true, rows, via: tenantId ? "tenant_scoped" : "anon" };
}

/** PATCH parcial via servidor (rede no browser / proxy / mobile salão). */
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
  if (body.cadastro_valores !== undefined) payload.cadastro_valores = body.cadastro_valores;
  if (typeof body.prioridade === "boolean") payload.prioridade = body.prioridade;
  if (typeof body.classificacao_prioridade === "string" && body.classificacao_prioridade.trim()) {
    payload.classificacao_prioridade = body.classificacao_prioridade.trim();
  }
  if (typeof body.excluir_do_fechamento === "boolean") {
    payload.excluir_do_fechamento = body.excluir_do_fechamento;
  }

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

  const tenantId = resolvePublicTenantId(body.tenant_id);
  const salaoMobile = body.salao_mobile === true;

  try {
    if (salaoMobile) {
      if (!tenantId) {
        return NextResponse.json(
          { ok: false, message: "tenant_id obrigatório para mutação mobile do salão." },
          { status: 400 }
        );
      }

      const segmento = await fetchTenantSegmentoAplicado(url, anonKey, tenantId);
      if (segmento && !isSalaoEsteticaSegment(segmento)) {
        return NextResponse.json(
          { ok: false, message: "Tenant não está no preset salao_estetica." },
          { status: 403 }
        );
      }

      const serviceRole = normalizePublicEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
      if (!serviceRole) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "SUPABASE_SERVICE_ROLE_KEY ausente no servidor — necessária para mutações mobile anônimas.",
          },
          { status: 503 }
        );
      }

      const admin = createSupabaseClientSafe(url, serviceRole);
      if (!admin) {
        return NextResponse.json(
          { ok: false, message: "Falha ao inicializar cliente admin Supabase." },
          { status: 503 }
        );
      }

      const { data, error } = await admin
        .from("atendimentos_lite")
        .update(payload)
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select("id");

      if (error) {
        return NextResponse.json(
          { ok: false, message: error.message, status: 502 },
          { status: 502 }
        );
      }

      if (!data?.length) {
        return NextResponse.json(
          {
            ok: false,
            message: "Nenhum registro atualizado (id ou tenant_id não conferem).",
            status: 404,
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { ok: true, via: "salao_mobile_service_role", updated: data.length },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const result = await patchAtendimentoRest(url, anonKey, id, null, payload);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, message: result.message, status: result.status },
        { status: result.status }
      );
    }

    return NextResponse.json(
      { ok: true, via: result.via, updated: result.rows.length },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ScreenFlow] api/atendimentos-status:", e);
    return NextResponse.json({ ok: false, message: msg }, { status: 502 });
  }
}
