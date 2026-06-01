"use client";

import JSZip from "jszip";
import { useState, type CSSProperties } from "react";

type Credenciais = {
  email: string;
  senha: string;
  link: string;
};

function safeZipLabel(value: string): string {
  const s = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
  return s.length > 0 ? s : "cliente";
}

function credenciaisTxt(c: Credenciais): string {
  return [
    "CREDENCIAIS DE ACESSO — ScreenFlow Lite",
    "",
    `E-mail: ${c.email}`,
    `Senha temporária: ${c.senha}`,
    "",
    "Link para login:",
    c.link,
    "",
    "Guarde em local seguro. Altere a senha após o primeiro acesso, se desejar.",
    "",
  ].join("\r\n");
}

export function GerarLinkAcessoButton({
  tenantId,
  kitLabel,
}: {
  tenantId: string;
  kitLabel: string;
}) {
  const [loading, setLoading] = useState(false);
  const [credenciais, setCredenciais] = useState<Credenciais | null>(null);
  const [erro, setErro] = useState("");
  const [kitLoading, setKitLoading] = useState(false);
  const [kitErro, setKitErro] = useState("");

  async function gerar() {
    setErro("");
    setCredenciais(null);
    setKitErro("");
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin-lite/tenants/${encodeURIComponent(tenantId)}/link`,
        { method: "GET" }
      );
      const body = (await res.json().catch(() => null)) as
        | { email?: string; senha?: string; link?: string; error?: string }
        | null;
      if (!res.ok) {
        setErro(body?.error ?? "Não foi possível gerar as credenciais.");
        return;
      }
      const email = body?.email;
      const senha = body?.senha;
      const link = body?.link;
      if (
        typeof email === "string" &&
        email.length > 0 &&
        typeof senha === "string" &&
        senha.length > 0 &&
        typeof link === "string" &&
        link.length > 0
      ) {
        setCredenciais({ email, senha, link });
        return;
      }
      setErro("Resposta inválida.");
    } catch {
      setErro("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  async function baixarKit() {
    if (credenciais === null) return;
    setKitErro("");
    setKitLoading(true);
    try {
      const resKit = await fetch(
        `/api/admin-lite/tenants/${encodeURIComponent(tenantId)}/kit`
      );
      if (!resKit.ok) {
        setKitErro("Não foi possível gerar o kit HTML. Tente de novo.");
        return;
      }
      const kitHtml = await resKit.text();
      const zip = new JSZip();
      zip.file("ScreenFlow_Lite_Kit.html", kitHtml);
      zip.file("CREDENCIAIS_DE_ACESSO.txt", credenciaisTxt(credenciais));
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ScreenFlow_Lite_Kit_${safeZipLabel(kitLabel)}.zip`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setKitErro("Não foi possível montar o ZIP. Tente de novo.");
    } finally {
      setKitLoading(false);
    }
  }

  const box: CSSProperties = {
    marginTop: "0.75rem",
    padding: "0.75rem 1rem",
    borderRadius: 8,
    background: "#030712",
    border: "1px solid #334155",
    fontSize: "0.85rem",
    color: "#e2e8f0",
  };

  const label: CSSProperties = {
    color: "#64748b",
    fontSize: "0.75rem",
    margin: "0 0 0.25rem 0",
  };

  const btnPrimary: CSSProperties = {
    padding: "0.6rem 1.1rem",
    borderRadius: 8,
    background: "#185FA5",
    color: "#fff",
    fontWeight: 600,
    fontSize: "0.95rem",
    border: "none",
    cursor: "pointer",
  };

  const btnSecondary: CSSProperties = {
    ...btnPrimary,
    background: "#1e3a5f",
    marginTop: "0.65rem",
  };

  return (
    <div style={{ marginTop: "0.75rem" }}>
      <button
        type="button"
        onClick={() => void gerar()}
        disabled={loading}
        style={{
          ...btnPrimary,
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.85 : 1,
        }}
      >
        {loading ? "Gerando…" : "Gerar credenciais de acesso"}
      </button>
      {erro.length > 0 ? (
        <p style={{ color: "#ff6b6b", fontSize: "0.9rem", marginTop: "0.75rem" }}>{erro}</p>
      ) : null}
      {credenciais !== null ? (
        <div style={{ marginTop: "0.75rem" }}>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem", margin: "0 0 0.75rem 0" }}>
            Envie estas credenciais para o cliente
          </p>
          <div style={{ ...box, marginTop: 0 }}>
            <p style={label}>Email</p>
            <p style={{ margin: "0 0 0.65rem 0", wordBreak: "break-all" }}>{credenciais.email}</p>
            <p style={label}>Senha temporária</p>
            <p
              style={{
                margin: "0 0 0.65rem 0",
                fontFamily: "ui-monospace, monospace",
                color: "#fde68a",
              }}
            >
              {credenciais.senha}
            </p>
            <p style={label}>Link para login</p>
            <p
              style={{
                margin: 0,
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.72rem",
                color: "#90caf9",
                wordBreak: "break-all",
              }}
            >
              {credenciais.link}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void baixarKit()}
            disabled={kitLoading}
            style={{
              ...btnSecondary,
              cursor: kitLoading ? "not-allowed" : "pointer",
              opacity: kitLoading ? 0.85 : 1,
            }}
          >
            {kitLoading ? "Montando o kit…" : "Baixar Kit de Entrega"}
          </button>
          {kitErro.length > 0 ? (
            <p
              style={{
                color: "#ff6b6b",
                fontSize: "0.85rem",
                marginTop: "0.55rem",
                maxWidth: 420,
              }}
            >
              {kitErro}
            </p>
          ) : null}
          <p
            style={{
              color: "#64748b",
              fontSize: "0.75rem",
              margin: "0.5rem 0 0 0",
              maxWidth: 440,
            }}
          >
            O ZIP inclui o guia HTML (TV + abas da fila) e um arquivo de texto com estas
            credenciais — pronto para anexar na mensagem ao cliente.
          </p>
        </div>
      ) : null}
    </div>
  );
}
