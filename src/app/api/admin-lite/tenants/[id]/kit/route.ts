import { NextResponse } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";
import { assertMasterSession } from "@/lib/admin-auth";
import {
  getLiteDisplayUrl,
  getLiteLoginUrl,
  getLitePublicBaseUrl,
  SCREENFLOW_LITE_DEFAULT_BASE_URL,
} from "@/lib/lite-public-urls";
import { createAdminClient } from "@/lib/supabase-admin";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeFilenameSlug(slug: string): string {
  const t = slug.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return t.length > 0 ? t.slice(0, 80) : "cliente";
}

function buildLiteKitHtml(opts: {
  empresa: string;
  slug: string;
  tenantId: string;
  licencaKey: string;
  loginUrl: string;
  displayUrl: string;
  appLabel: string;
}): string {
  const { empresa, slug, licencaKey, loginUrl, displayUrl, appLabel } = opts;
  const suporteEmail =
    process.env.NEXT_PUBLIC_MASTER_EMAIL ?? "suporte@screenflow.app";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ScreenFlow Lite — Kit de ativação — ${escapeHtml(empresa)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: #07111f;
      color: #f8fafc;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      line-height: 1.5;
    }
    .wrap { max-width: 720px; margin: 0 auto; padding: 2rem 1.25rem 3rem; }
    .logo { font-size: 1.75rem; font-weight: 800; letter-spacing: -0.03em; color: #fff; margin: 0 0 0.35rem 0; }
    .logo span { color: #38bdf8; }
    .sub { color: #94a3b8; font-size: 0.95rem; margin: 0 0 2rem 0; }
    .empresa { font-size: 1.35rem; font-weight: 700; color: #e2e8f0; margin: 0 0 1.75rem 0; }
    h2 { font-size: 1.1rem; color: #cbd5e1; margin: 0 0 1rem 0; }
    .cards { display: grid; gap: 1rem; }
    .card {
      background: #0f1f35;
      border: 1px solid rgba(30, 58, 95, 0.65);
      border-radius: 12px;
      padding: 1.25rem 1.35rem;
      animation: fadeInUp 0.55s ease forwards;
      opacity: 0;
    }
    .card:nth-of-type(1) { animation-delay: 0.05s; }
    .card:nth-of-type(2) { animation-delay: 0.2s; }
    .card:nth-of-type(3) { animation-delay: 0.35s; }
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(18px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .step { color: #64748b; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; margin: 0 0 0.5rem 0; }
    .card p { margin: 0; color: #94a3b8; font-size: 0.95rem; }
    .btn {
      display: inline-block;
      margin-top: 0.9rem;
      padding: 0.85rem 1.35rem;
      background: #185FA5;
      color: #fff !important;
      font-weight: 700;
      text-decoration: none;
      border-radius: 10px;
      text-align: center;
      width: 100%;
      max-width: 100%;
    }
    .btn:hover { filter: brightness(1.08); }
    .lic-box {
      margin-top: 2rem;
      padding: 1.1rem 1.25rem;
      background: #030712;
      border: 1px solid #334155;
      border-radius: 10px;
    }
    .lic-box h2 { margin: 0 0 0.5rem 0; font-size: 0.85rem; color: #64748b; }
    .lic-key { font-family: ui-monospace, Consolas, monospace; font-size: 0.9rem; color: #7dd3fc; word-break: break-all; }
    .foot { margin-top: 2.5rem; padding-top: 1.5rem; border-top: 1px solid rgba(51, 65, 85, 0.5); color: #64748b; font-size: 0.85rem; }
    .foot a { color: #38bdf8; }
    .plano { color: #94a3b8; font-size: 0.8rem; margin: 0.25rem 0 0 0; }
    .mono { font-family: ui-monospace, Consolas, monospace; font-size: 0.8rem; color: #7dd3fc; word-break: break-all; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1 class="logo">Screen<span>Flow</span> Lite</h1>
    <p class="sub">Kit de ativação — fila de atendimento + TV</p>
    <p class="empresa">${escapeHtml(empresa)}</p>
    <p class="plano">Identificador: <strong style="color:#cbd5e1;">${escapeHtml(slug)}</strong> · Plano: <strong style="color:#cbd5e1;">Lite</strong></p>
    <h2>Como ativar seu sistema</h2>
    <div class="cards">
      <div class="card">
        <p class="step">Passo 1</p>
        <p>Faça login no painel da fila com o e-mail e a senha temporária enviados pelo suporte.</p>
        <a class="btn" href="${escapeHtml(loginUrl)}" rel="noopener">Acessar painel da fila</a>
      </div>
      <div class="card">
        <p class="step">Passo 2</p>
        <p>No painel, abra <strong style="color:#e2e8f0;">Configurações</strong> e monte as <strong style="color:#e2e8f0;">abas da fila</strong> (Ordem de Chegada, Prioridade, etc.). Cadastre profissionais, locais e serviços conforme necessário.</p>
      </div>
      <div class="card">
        <p class="step">Passo 3</p>
        <p>Abra o link abaixo no navegador da smart TV (tela cheia). A TV exibirá a fila em tempo real conforme os atendimentos registrados no painel.</p>
        <p class="mono" style="margin-top:0.75rem;">${escapeHtml(displayUrl)}</p>
      </div>
    </div>
    <div class="lic-box">
      <h2>Chave de licença</h2>
      <div class="lic-key">${escapeHtml(licencaKey)}</div>
    </div>
    <p style="color:#94a3b8;font-size:0.8rem;margin:1.25rem 0 0 0;">URL base do sistema: <span style="color:#7dd3fc;word-break:break-all;">${escapeHtml(appLabel)}</span></p>
    <footer class="foot">
      Powered by <strong style="color:#94a3b8;">ScreenFlow Lite</strong><br />
      Contato de suporte: <a href="mailto:${escapeHtml(suporteEmail)}">${escapeHtml(suporteEmail)}</a>
    </footer>
  </div>
</body>
</html>`;
}

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
  const { data: row, error } = (await admin
    .from("tenants")
    .select("id, nome, slug, licenca_key")
    .eq("id", tenantId)
    .maybeSingle()) as {
    data: { id: string; nome: string; slug: string; licenca_key: string } | null;
    error: PostgrestError | null;
  };

  if (error !== null) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (row === null) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const publicBase = getLitePublicBaseUrl();
  const safeFile = safeFilenameSlug(row.slug);
  const html = buildLiteKitHtml({
    empresa: row.nome,
    slug: row.slug,
    tenantId: row.id,
    licencaKey: row.licenca_key,
    loginUrl: getLiteLoginUrl(),
    displayUrl: getLiteDisplayUrl(row.id),
    appLabel: publicBase || SCREENFLOW_LITE_DEFAULT_BASE_URL,
  });

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="ScreenFlow-Lite-Kit-${safeFile}.html"`,
    },
  });
}
