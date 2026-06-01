"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = { tenantId: string };

export function TenantStatusActions({ tenantId }: Props) {
  const router = useRouter();
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState<null | "ativo" | "bloqueado">(null);

  async function patchStatus(status: "ativo" | "bloqueado") {
    setErro("");
    setLoading(status);
    try {
      const res = await fetch(`/api/admin-lite/tenants/${tenantId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setErro(body?.error ?? "Não foi possível atualizar o status.");
    } catch {
      setErro("Erro de rede.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => void patchStatus("bloqueado")}
          style={{
            padding: "0.65rem 1.1rem",
            borderRadius: 8,
            border: "1px solid #b91c1c",
            background: "rgba(185, 28, 28, 0.25)",
            color: "#fecaca",
            fontWeight: 600,
            cursor: loading !== null ? "not-allowed" : "pointer",
          }}
        >
          {loading === "bloqueado" ? "Bloqueando..." : "Bloquear cliente"}
        </button>
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => void patchStatus("ativo")}
          style={{
            padding: "0.65rem 1.1rem",
            borderRadius: 8,
            border: "1px solid #15803d",
            background: "rgba(22, 101, 52, 0.35)",
            color: "#bbf7d0",
            fontWeight: 600,
            cursor: loading !== null ? "not-allowed" : "pointer",
          }}
        >
          {loading === "ativo" ? "Ativando..." : "Ativar cliente"}
        </button>
      </div>
      {erro ? (
        <p style={{ color: "#ff6b6b", marginTop: "0.75rem", marginBottom: 0 }}>{erro}</p>
      ) : null}
    </div>
  );
}
