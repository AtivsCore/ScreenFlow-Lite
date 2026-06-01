"use client";

import Link from "next/link";
import { useState, type CSSProperties, type FormEvent } from "react";

export default function NovoClienteLitePage() {
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [emailCliente, setEmailCliente] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [linkAcesso, setLinkAcesso] = useState<string | null>(null);
  const [resumo, setResumo] = useState<{ id: string; licenca_key: string } | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro("");
    setLoading(true);
    setLinkAcesso(null);
    setResumo(null);
    try {
      const bodyJson: { nome: string; slug: string; email?: string } = { nome, slug };
      const em = emailCliente.trim();
      if (em.length > 0) bodyJson.email = em;

      const res = await fetch("/api/admin-lite/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyJson),
      });
      const body = (await res.json().catch(() => null)) as
        | {
            id?: string;
            licenca_key?: string;
            link_acesso?: string | null;
            error_link?: string;
            error?: string;
          }
        | null;

      if (res.status === 200) {
        if (typeof body?.id === "string" && typeof body?.licenca_key === "string") {
          setResumo({ id: body.id, licenca_key: body.licenca_key });
        }
        if (typeof body?.error_link === "string" && body.error_link.length > 0) {
          setErro(`Link de acesso: ${body.error_link}`);
        } else if (typeof body?.link_acesso === "string" && body.link_acesso.length > 0) {
          setLinkAcesso(body.link_acesso);
        } else {
          window.location.href = "/admin/clientes-lite";
        }
        return;
      }
      setErro(body?.error ?? "Não foi possível criar o cliente.");
    } catch {
      setErro("Erro de rede. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  const input: CSSProperties = {
    padding: "0.75rem 1rem",
    borderRadius: 8,
    border: "1px solid #1e3a5f",
    background: "#07111f",
    color: "#fff",
    fontSize: "1rem",
    outline: "none",
    width: "100%",
  };

  return (
    <main
      style={{
        width: "100vw",
        minHeight: "100vh",
        background: "#07111f",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        boxSizing: "border-box",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <Link
          href="/admin/clientes-lite"
          style={{
            display: "inline-block",
            marginBottom: "1rem",
            color: "#4fc3f7",
            fontSize: "0.95rem",
            textDecoration: "none",
          }}
        >
          ← Voltar
        </Link>
        <div
          style={{
            background: "#0f1f35",
            borderRadius: 12,
            padding: "2.5rem",
            width: "100%",
            border: "1px solid #1e3a5f",
            boxSizing: "border-box",
          }}
        >
          <h1
            style={{
              color: "#fff",
              fontSize: "1.5rem",
              fontWeight: 700,
              textAlign: "center",
              margin: "0 0 1.5rem 0",
              fontFamily: "sans-serif",
            }}
          >
            Novo Cliente Lite
          </h1>
          <form
            onSubmit={submit}
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <input
              type="text"
              placeholder="Nome da empresa"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              style={input}
            />
            <input
              type="text"
              placeholder="ex: clinica-sao-lucas"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              style={input}
            />
            <div
              style={{
                ...input,
                color: "#94a3b8",
                background: "#030712",
                cursor: "default",
              }}
            >
              Plano — Lite
            </div>
            <input
              type="email"
              placeholder="Email do cliente (opcional)"
              value={emailCliente}
              onChange={(e) => setEmailCliente(e.target.value)}
              style={input}
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "0.75rem",
                borderRadius: 8,
                background: "#185FA5",
                color: "#fff",
                fontSize: "1rem",
                fontWeight: 600,
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.85 : 1,
              }}
            >
              {loading ? "Salvando..." : "Criar cliente"}
            </button>
            {erro ? (
              <p style={{ color: "#ff6b6b", textAlign: "center", margin: 0 }}>{erro}</p>
            ) : null}
            {resumo !== null && linkAcesso !== null ? (
              <div
                style={{
                  marginTop: "0.5rem",
                  padding: "1rem",
                  borderRadius: 8,
                  background: "#030712",
                  border: "1px solid #334155",
                }}
              >
                <p style={{ color: "#94a3b8", fontSize: "0.85rem", margin: "0 0 0.5rem 0" }}>
                  Cliente criado. Envie este link de acesso (magic link) ao cliente:
                </p>
                <p
                  style={{
                    color: "#7dd3fc",
                    fontSize: "0.75rem",
                    wordBreak: "break-all",
                    margin: 0,
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  {linkAcesso}
                </p>
                <Link
                  href="/admin/clientes-lite"
                  style={{
                    display: "inline-block",
                    marginTop: "1rem",
                    color: "#4fc3f7",
                    fontSize: "0.95rem",
                  }}
                >
                  Ir para a lista de clientes
                </Link>
              </div>
            ) : null}
          </form>
        </div>
      </div>
    </main>
  );
}
