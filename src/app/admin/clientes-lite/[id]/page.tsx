import Link from "next/link";
import type { PostgrestError } from "@supabase/supabase-js";
import { DefinirEmailCliente } from "@/components/admin-lite/definir-email-cliente";
import { GerarLinkAcessoButton } from "@/components/admin-lite/gerar-link-acesso";
import { TenantStatusActions } from "@/components/admin-lite/tenant-status-actions";
import { createAdminClient } from "@/lib/supabase-admin";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function statusColor(status: string): string {
  const s = status.trim().toLowerCase();
  if (s === "ativo") return "#22c55e";
  if (s === "bloqueado") return "#ef4444";
  if (s === "trial") return "#eab308";
  return "#94a3b8";
}

const card = {
  background: "#0f1f35",
  border: "1px solid #1e3a5f",
  borderRadius: 12,
  padding: "1.5rem",
} as const;

export default async function ClienteLiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data: row, error } = await supabase
    .from("tenants")
    .select("id, nome, slug, plano, status, licenca_key, created_at")
    .eq("id", id)
    .single();

  if (error !== null || row === null) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#07111f",
          color: "#f8fafc",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <p style={{ fontFamily: "sans-serif" }}>Cliente não encontrado</p>
      </div>
    );
  }

  const { data: tuRow, error: tuError } = (await supabase
    .from("tenant_users")
    .select("user_id")
    .eq("tenant_id", id)
    .limit(1)
    .maybeSingle()) as {
    data: { user_id: string } | null;
    error: PostgrestError | null;
  };

  let userEmail: string | null = null;
  if (tuError === null && tuRow !== null) {
    const { data: authUser, error: userErr } = await supabase.auth.admin.getUserById(
      tuRow.user_id
    );
    if (userErr == null) {
      userEmail = authUser.user?.email ?? null;
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#07111f",
        color: "#e2e8f0",
        fontFamily: "sans-serif",
        padding: "1.5rem",
        maxWidth: 1100,
        margin: "0 auto",
        boxSizing: "border-box",
      }}
    >
      <Link
        href="/admin/clientes-lite"
        style={{ display: "inline-block", color: "#4fc3f7", marginBottom: "1.25rem" }}
      >
        ← Voltar para lista
      </Link>

      <h1
        style={{
          color: "#fff",
          fontSize: "1.5rem",
          fontWeight: 700,
          margin: "0 0 1rem 0",
        }}
      >
        Cliente: {row.nome}
      </h1>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={card}>
          <h2
            style={{
              margin: "0 0 1rem 0",
              fontSize: "1rem",
              color: "#94a3b8",
              fontWeight: 600,
            }}
          >
            Informação
          </h2>
          <dl style={{ margin: 0, display: "grid", gap: "0.65rem", fontSize: "0.95rem" }}>
            <div>
              <dt style={{ color: "#64748b", margin: 0 }}>Nome</dt>
              <dd style={{ margin: 0 }}>{row.nome}</dd>
            </div>
            <div>
              <dt style={{ color: "#64748b", margin: 0 }}>Slug</dt>
              <dd style={{ margin: 0 }}>{row.slug}</dd>
            </div>
            <div>
              <dt style={{ color: "#64748b", margin: 0 }}>Plano</dt>
              <dd style={{ margin: 0, textTransform: "capitalize" }}>{row.plano}</dd>
            </div>
            <div>
              <dt style={{ color: "#64748b", margin: 0 }}>Status</dt>
              <dd style={{ margin: 0, color: statusColor(row.status) }}>{row.status}</dd>
            </div>
            <div>
              <dt style={{ color: "#64748b", margin: 0 }}>Data de criação</dt>
              <dd style={{ margin: 0, color: "#cbd5e1" }}>{formatDate(row.created_at)}</dd>
            </div>
            <div>
              <dt style={{ color: "#64748b", margin: 0 }}>Email do usuário</dt>
              <dd style={{ margin: 0, color: "#e2e8f0" }}>
                {userEmail !== null && userEmail.length > 0 ? userEmail : "—"}
              </dd>
            </div>
          </dl>
        </div>

        <div style={card}>
          <h2
            style={{
              margin: "0 0 1rem 0",
              fontSize: "1rem",
              color: "#94a3b8",
              fontWeight: 600,
            }}
          >
            Licença e acesso
          </h2>
          <p style={{ margin: "0 0 0.5rem 0", color: "#64748b", fontSize: "0.85rem" }}>
            Chave (licença)
          </p>
          <div
            style={{
              fontFamily: "ui-monospace, monospace",
              background: "#030712",
              border: "1px solid #334155",
              borderRadius: 8,
              padding: "0.75rem 1rem",
              fontSize: "0.8rem",
              color: "#e2e8f0",
              wordBreak: "break-all",
            }}
          >
            {row.licenca_key}
          </div>
          {userEmail !== null && userEmail.length > 0 ? (
            <>
              <p
                style={{
                  margin: "1.25rem 0 0.5rem 0",
                  color: "#64748b",
                  fontSize: "0.85rem",
                }}
              >
                Gere uma senha temporária e o link de login. Envie estas credenciais para o
                cliente por e-mail ou WhatsApp; ele entra em /login e acessa o painel da fila.
              </p>
              <GerarLinkAcessoButton tenantId={row.id} kitLabel={row.slug} />
            </>
          ) : (
            <>
              <p
                style={{
                  margin: "1.25rem 0 0.5rem 0",
                  color: "#64748b",
                  fontSize: "0.85rem",
                }}
              >
                Este cliente ainda não tem conta. Indique o email para criar o usuário, vincular
                ao cliente e obter o link de acesso.
              </p>
              <DefinirEmailCliente tenantId={row.id} />
            </>
          )}
        </div>
      </div>

      <div style={{ ...card, maxWidth: 640 }}>
        <h2
          style={{
            margin: "0 0 0.75rem 0",
            fontSize: "1rem",
            color: "#94a3b8",
            fontWeight: 600,
          }}
        >
          Ações
        </h2>
        <TenantStatusActions tenantId={row.id} />
      </div>
    </div>
  );
}
