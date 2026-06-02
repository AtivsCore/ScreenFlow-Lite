"use client";

import { SEGMENT_PRESETS } from "@/lib/segment-presets";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  tenantId: string;
  initialSegmentoDefinido: string | null;
};

export function DefinirSegmentoCliente({ tenantId, initialSegmentoDefinido }: Props) {
  const router = useRouter();
  const [segmento, setSegmento] = useState(initialSegmentoDefinido ?? "clinicas_consultorios");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setErro("");
    setSaved(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin-lite/tenants/${tenantId}/segmento`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segmento_definido: segmento }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setErro(body?.error ?? "Não foi possível salvar o segmento.");
    } catch {
      setErro("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: "0.75rem" }}>
      <label style={{ display: "block", color: "#64748b", fontSize: "0.85rem", marginBottom: "0.35rem" }}>
        Segmento licenciado
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        <select
          value={segmento}
          onChange={(e) => {
            setSegmento(e.target.value);
            setSaved(false);
          }}
          style={{
            flex: "1 1 220px",
            minWidth: 200,
            padding: "0.55rem 0.75rem",
            borderRadius: 8,
            border: "1px solid #334155",
            background: "#030712",
            color: "#e2e8f0",
            fontSize: "0.9rem",
          }}
        >
          {SEGMENT_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.emoji} {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={loading}
          onClick={() => void handleSave()}
          style={{
            padding: "0.55rem 1rem",
            borderRadius: 8,
            border: "1px solid #0369a1",
            background: "rgba(3, 105, 161, 0.35)",
            color: "#bae6fd",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: "0.9rem",
          }}
        >
          {loading ? "Salvando…" : "Salvar segmento"}
        </button>
      </div>
      {saved ? (
        <p style={{ color: "#4ade80", marginTop: "0.5rem", marginBottom: 0, fontSize: "0.85rem" }}>
          Segmento atualizado. O cliente receberá o preset ao entrar no painel.
        </p>
      ) : null}
      {erro ? (
        <p style={{ color: "#ff6b6b", marginTop: "0.5rem", marginBottom: 0, fontSize: "0.85rem" }}>{erro}</p>
      ) : null}
    </div>
  );
}
