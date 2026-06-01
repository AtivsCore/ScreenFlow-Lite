"use client";

import { useRouter } from "next/navigation";
import { useState, type CSSProperties, type FormEvent } from "react";

const input: CSSProperties = {
  padding: "0.65rem 1rem",
  borderRadius: 8,
  border: "1px solid #334155",
  background: "#030712",
  color: "#e2e8f0",
  fontSize: "0.95rem",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

export function DefinirEmailCliente({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [link, setLink] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro("");
    setLink(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin-lite/tenants/${encodeURIComponent(tenantId)}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = (await res.json().catch(() => null)) as
        | { link?: string; error?: string }
        | null;
      if (!res.ok) {
        setErro(body?.error ?? "Não foi possível criar o acesso.");
        return;
      }
      if (typeof body?.link === "string" && body.link.length > 0) {
        setLink(body.link);
        router.refresh();
        return;
      }
      setErro("Resposta inválida.");
    } catch {
      setErro("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.75rem" }}
    >
      <input
        type="email"
        required
        placeholder="Email do cliente"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={input}
        autoComplete="off"
      />
      <button
        type="submit"
        disabled={loading}
        style={{
          padding: "0.6rem 1.1rem",
          borderRadius: 8,
          background: "#185FA5",
          color: "#fff",
          fontWeight: 600,
          fontSize: "0.95rem",
          border: "none",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.85 : 1,
        }}
      >
        {loading ? "Criando acesso…" : "Criar conta e gerar link de acesso"}
      </button>
      {erro.length > 0 ? (
        <p style={{ color: "#ff6b6b", fontSize: "0.9rem", margin: 0 }}>{erro}</p>
      ) : null}
      {link !== null ? (
        <div
          style={{
            marginTop: "0.25rem",
            padding: "0.75rem 1rem",
            borderRadius: 8,
            background: "#030712",
            border: "1px solid #334155",
            fontFamily: "ui-monospace, monospace",
            fontSize: "0.72rem",
            color: "#90caf9",
            wordBreak: "break-all",
          }}
        >
          {link}
        </div>
      ) : null}
    </form>
  );
}
