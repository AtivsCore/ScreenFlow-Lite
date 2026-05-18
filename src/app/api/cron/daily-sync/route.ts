import { NextResponse } from "next/server";
import { ATENDIMENTOS_LITE_REST_SELECT } from "@/lib/atendimentos-rest";
import { dateKeyInTimeZone, yesterdayDateKeyInTimeZone } from "@/lib/cron-date";
import { finalizeSupabasePublicPair, normalizePublicEnvValue, resolveSupabaseEnvPairs } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type QueueNested = {
  id: string;
  tenant_id?: string | null;
  created_at?: string | null;
  excluir_do_fechamento?: boolean | null;
  pacientes?: { nome: string | null } | { nome: string | null }[] | null;
  profissionais?: { nome: string | null } | { nome: string | null }[] | null;
  hora_marcada?: string | null;
  status?: string | null;
  prioridade?: boolean | null;
  observacao?: string | null;
};

function nomePaciente(row: QueueNested): string | null {
  const rel = row.pacientes;
  if (!rel) return null;
  if (Array.isArray(rel)) return rel[0]?.nome ?? null;
  return rel.nome ?? null;
}

function nomeProf(row: QueueNested): string | null {
  const rel = row.profissionais;
  if (!rel) return null;
  if (Array.isArray(rel)) return rel[0]?.nome ?? null;
  return rel.nome ?? null;
}

/**
 * Fechamento diário: exporta registros do dia anterior (fuso SCREENFLOW_TIMEZONE) para webhook do Google Sheets,
 * exclui linhas marcadas `excluir_do_fechamento` do payload e, após sucesso, remove todos os registros desse dia na base.
 *
 * Variáveis:
 * - CRON_SECRET: Bearer obrigatório
 * - GOOGLE_SHEETS_WEBHOOK_URL: URL do Apps Script / webhook
 * - SUPABASE_SERVICE_ROLE_KEY: necessário para DELETE em massa
 * - SCREENFLOW_TIMEZONE (default America/Sao_Paulo)
 */
export async function GET(req: Request) {
  return handleCron(req);
}

export async function POST(req: Request) {
  return handleCron(req);
}

async function handleCron(req: Request) {
  const secret = normalizePublicEnvValue(process.env.CRON_SECRET);
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, message: "Não autorizado." }, { status: 401 });
  }

  const webhook = normalizePublicEnvValue(process.env.GOOGLE_SHEETS_WEBHOOK_URL);
  if (!webhook) {
    return NextResponse.json({ ok: false, message: "GOOGLE_SHEETS_WEBHOOK_URL não configurada." }, { status: 503 });
  }

  const serviceRole = normalizePublicEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!serviceRole) {
    return NextResponse.json(
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY ausente (obrigatória para limpar a fila)." },
      { status: 503 }
    );
  }

  const tz = normalizePublicEnvValue(process.env.SCREENFLOW_TIMEZONE) || "America/Sao_Paulo";
  const exportYmd = yesterdayDateKeyInTimeZone(new Date(), tz);

  const { url } = finalizeSupabasePublicPair(resolveSupabaseEnvPairs());
  if (!url) {
    return NextResponse.json({ ok: false, message: "SUPABASE_URL não configurada." }, { status: 503 });
  }

  const select = encodeURIComponent(ATENDIMENTOS_LITE_REST_SELECT);
  const fetchUrl = `${url}/rest/v1/atendimentos_lite?select=${select}`;

  let rows: QueueNested[] = [];
  try {
    const res = await fetch(fetchUrl, {
      cache: "no-store",
      headers: {
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
        Accept: "application/json",
      },
    });
    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, message: `PostgREST: ${text.slice(0, 400)}` },
        { status: res.status >= 500 ? 502 : res.status }
      );
    }
    rows = JSON.parse(text) as QueueNested[];
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, message: msg }, { status: 502 });
  }

  const dayRows = rows.filter((r) => dateKeyInTimeZone(r.created_at ?? null, tz) === exportYmd);
  const included = dayRows.filter((r) => !r.excluir_do_fechamento);
  const excludedCount = dayRows.length - included.length;

  const payload = {
    kind: "screenflow-lite-daily-sync",
    timezone: tz,
    date: exportYmd,
    syncedAt: new Date().toISOString(),
    rows: included.map((r) => ({
      id: r.id,
      tenant_id: r.tenant_id ?? null,
      cliente: nomePaciente(r),
      profissional: nomeProf(r),
      hora_marcada: r.hora_marcada ?? null,
      status: r.status ?? null,
      prioridade: r.prioridade ?? false,
      observacao: r.observacao ?? null,
      created_at: r.created_at ?? null,
    })),
    meta: {
      totalNoDia: dayRows.length,
      enviadasPlanilha: included.length,
      excluidasUsuario: excludedCount,
    },
  };

  try {
    const wh = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!wh.ok) {
      const t = await wh.text();
      return NextResponse.json(
        { ok: false, message: `Webhook HTTP ${wh.status}: ${t.slice(0, 400)}` },
        { status: 502 }
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, message: `Webhook: ${msg}` }, { status: 502 });
  }

  const ids = dayRows.map((r) => r.id).filter(Boolean);
  const chunk = 80;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const inList = slice.map(encodeURIComponent).join(",");
    const delUrl = `${url}/rest/v1/atendimentos_lite?id=in.(${inList})`;
    const delRes = await fetch(delUrl, {
      method: "DELETE",
      headers: {
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
      },
    });
    if (!delRes.ok) {
      const t = await delRes.text();
      return NextResponse.json(
        {
          ok: false,
          message: `Webhook OK mas falha ao limpar registros: HTTP ${delRes.status}: ${t.slice(0, 400)}`,
          exported: included.length,
        },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    date: exportYmd,
    deleted: ids.length,
    exportedRows: included.length,
    excludedFromSheet: excludedCount,
  });
}
