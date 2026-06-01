"use client";

import type { AtendimentoLite, AtendimentoLiteNested } from "@/lib/atendimentos-lite";
import {
  formatCreatedAt,
  formatHoraMarcada,
  mapAtendimentosNestedToFlat,
} from "@/lib/atendimentos-lite";
import { buildServicoLookup } from "@/lib/atendimentos-rest";
import type { ResolvedTenantConfig } from "@/lib/tenant-config";
import { mergeTenantConfig } from "@/lib/tenant-config";
import { resolvePublicTenantId } from "@/lib/tenant-id";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function isCallingStatus(status: string | null): boolean {
  const s = (status ?? "").toLowerCase();
  return s.includes("cham") || s.includes("recham");
}

const PALETTE_STYLES: Record<
  ResolvedTenantConfig["tvDisplay"]["colorPalette"],
  { shell: string; card: string; accent: string; muted: string }
> = {
  "red-black": {
    shell: "bg-zinc-950 text-red-50",
    card: "border-red-700/50 bg-red-950/40",
    accent: "text-red-400",
    muted: "text-red-200/70",
  },
  "yellow-black": {
    shell: "bg-black text-yellow-300",
    card: "border-yellow-500/40 bg-neutral-950/80",
    accent: "text-yellow-400",
    muted: "text-yellow-200/70",
  },
  "blue-white": {
    shell: "bg-slate-950 text-slate-50",
    card: "border-sky-500/30 bg-slate-900/60",
    accent: "text-sky-400",
    muted: "text-slate-300/80",
  },
  "green-black": {
    shell: "bg-zinc-950 text-emerald-50",
    card: "border-emerald-700/40 bg-emerald-950/35",
    accent: "text-emerald-400",
    muted: "text-emerald-200/70",
  },
};

export default function DisplayPage() {
  const searchParams = useSearchParams();
  const tenantId = useMemo(
    () => resolvePublicTenantId(searchParams.get("tenant_id")),
    [searchParams]
  );

  const [config, setConfig] = useState<ResolvedTenantConfig>(() => mergeTenantConfig({}));
  type TvPartial = Partial<ResolvedTenantConfig["tvDisplay"]>;
  const [tvLocal, setTvLocal] = useState<TvPartial>({});

  const [rows, setRows] = useState<AtendimentoLite[]>([]);
  const [footerIdx, setFooterIdx] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    if (typeof window === "undefined") return;
    const key = `sf-lite-display-${tenantId}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) setTvLocal(JSON.parse(raw) as TvPartial);
    } catch {
      /* ignore */
    }
  }, [tenantId]);

  function persistTvLocal(patch: TvPartial) {
    setTvLocal((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(`sf-lite-display-${tenantId || "default"}`, JSON.stringify(next));
      } catch {
        /* quota */
      }
      return next;
    });
  }

  const tvMerged = useMemo(() => ({ ...config.tvDisplay, ...tvLocal }), [config.tvDisplay, tvLocal]);

  const palette = PALETTE_STYLES[tvMerged.colorPalette] ?? PALETTE_STYLES["blue-white"];

  useEffect(() => {
    if (!tenantId) {
      setLoadErr(
        "tenant_id ausente ou inválido na URL. Use /display?tenant_id=<uuid-do-cliente>."
      );
      setRows([]);
      return;
    }

    const scopedTenantId = tenantId;
    let cancelled = false;

    async function tick() {
      try {
        const qRes = await fetch(
          `/api/atendimentos-queue?tenant_id=${encodeURIComponent(scopedTenantId)}`,
          { cache: "no-store" }
        );
        const qJson = (await qRes.json()) as {
          ok?: boolean;
          data?: unknown;
          servicos?: { id: string; nome: string | null }[];
          message?: string;
        };
        if (!qRes.ok || !qJson.ok || !Array.isArray(qJson.data)) {
          if (!cancelled) {
            setLoadErr(qJson.message || `Fila HTTP ${qRes.status}`);
            setRows([]);
          }
          return;
        }
        const nested = qJson.data as AtendimentoLiteNested[];
        const lookup = qJson.servicos ? buildServicoLookup(qJson.servicos) : undefined;
        const flat = mapAtendimentosNestedToFlat(nested, lookup).filter(
          (r) => (r.tenant_id ?? "").toLowerCase() === scopedTenantId
        );
        if (cancelled) return;
        setLoadErr(null);
        setRows(flat);

        const cfgRes = await fetch(
          `/api/tenant-config?tenant_id=${encodeURIComponent(scopedTenantId)}`,
          { cache: "no-store" }
        );
        const cJson = (await cfgRes.json()) as { ok?: boolean; config?: unknown; message?: string };
        if (!cancelled && cfgRes.ok && cJson.ok && cJson.config) {
          setConfig(mergeTenantConfig(cJson.config));
        } else if (!cancelled && !cfgRes.ok) {
          setLoadErr(cJson.message || `Config HTTP ${cfgRes.status}`);
        }
      } catch (e) {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : String(e));
      }
    }

    void tick();
    const id = window.setInterval(() => void tick(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [tenantId]);

  useEffect(() => {
    const lines = tvMerged.footerLines;
    if (lines.length <= 1) return;
    const t = window.setInterval(() => {
      setFooterIdx((i) => (i + 1) % lines.length);
    }, 8000);
    return () => window.clearInterval(t);
  }, [tvMerged.footerLines]);

  const { highlight, history } = useMemo(() => {
    const active = rows.filter((r) => (r.status ?? "").toLowerCase() !== "finalizado");
    const calling = active.filter((r) => isCallingStatus(r.status));
    const sortedCall = [...calling].sort(
      (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    );
    const hi = sortedCall[0] ?? null;
    const hist = active
      .filter((r) => r.id !== hi?.id)
      .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
      .slice(0, 12);
    return { highlight: hi, history: hist };
  }, [rows]);

  const qrTarget = useMemo(() => {
    const custom = config.tvDisplay.qrTargetUrl?.trim();
    if (custom) return custom;
    if (typeof window === "undefined" || !tenantId) return "";
    const params = new URLSearchParams();
    params.set("tenant_id", tenantId);
    return `${window.location.origin}/display?${params.toString()}`;
  }, [config.tvDisplay.qrTargetUrl, tenantId]);

  useEffect(() => {
    if (!qrTarget) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    void import("qrcode").then((QR) => {
      QR.default.toDataURL(qrTarget, { margin: 1, width: 200 }, (_err, url) => {
        if (!cancelled && url) setQrDataUrl(url);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [qrTarget]);

  const footerLine =
    tvMerged.footerLines[footerIdx % Math.max(tvMerged.footerLines.length, 1)] ?? "Aguarde ser chamado";

  const bgUrl = tvMerged.backgroundImageDataUrl;

  return (
    <div className={`relative flex min-h-[100dvh] flex-col overflow-hidden ${palette.shell}`}>
      {bgUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bgUrl}
          alt=""
          className="pointer-events-none absolute inset-0 size-full object-cover opacity-10"
        />
      ) : null}

      <div className="relative z-[1] flex min-h-[100dvh] flex-1 flex-col p-6 lg:flex-row lg:gap-8">
        <aside className="flex w-full shrink-0 flex-col border-b border-white/10 pb-6 lg:w-80 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6">
          <p className={`text-xs font-semibold uppercase tracking-widest ${palette.muted}`}>Últimas chamadas</p>
          <ul className="mt-4 flex max-h-[62vh] flex-col gap-2 overflow-auto">
            {history.length === 0 && (
              <li className={`rounded-lg border border-white/10 px-3 py-4 text-sm ${palette.muted}`}>
                Nenhum histórico recente.
              </li>
            )}
            {history.map((r) => (
              <li
                key={r.id}
                className={`rounded-xl border px-3 py-2 text-left shadow-sm backdrop-blur-sm ${palette.card}`}
              >
                <p className="text-lg font-bold leading-tight">{r.nome ?? "—"}</p>
                <p className={`mt-0.5 text-xs ${palette.muted}`}>{r.profissionalNome ?? "—"}</p>
                <p className={`mt-1 font-mono text-[11px] ${palette.accent}`}>{r.status ?? "—"}</p>
              </li>
            ))}
          </ul>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col items-center justify-center gap-8">
          {loadErr ? (
            <p className="max-w-lg rounded-xl border border-amber-500/40 bg-amber-950/40 px-4 py-3 text-center text-sm text-amber-100">
              {loadErr}
            </p>
          ) : null}

          <div
            className={`w-full max-w-4xl rounded-3xl border-2 px-8 py-12 text-center shadow-2xl backdrop-blur-md ${palette.card}`}
          >
            <p className={`text-sm font-semibold uppercase tracking-[0.3em] ${palette.muted}`}>Última chamada</p>
            <p className="mt-4 text-5xl font-black leading-none tracking-tight lg:text-7xl">
              {highlight?.nome ?? "Aguardando chamada"}
            </p>
            <p className={`mt-6 text-xl font-semibold ${palette.accent}`}>
              {highlight?.profissionalNome ?? "—"}
            </p>
            <div className={`mt-4 flex flex-wrap justify-center gap-6 font-mono text-sm ${palette.muted}`}>
              <span>Horário: {formatHoraMarcada(highlight?.hora_marcada ?? null)}</span>
              <span>Chegada: {formatCreatedAt(highlight?.created_at ?? null)}</span>
            </div>
            <p className={`mt-8 text-2xl font-bold ${palette.accent}`}>{highlight?.status ?? ""}</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-10">
            <div className="rounded-2xl bg-white p-3 shadow-lg">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="QR Code" width={200} height={200} className="size-[200px]" />
              ) : (
                <div className="flex size-[200px] items-center justify-center bg-zinc-100 text-xs text-zinc-500">
                  QR…
                </div>
              )}
              <p className="mt-2 text-center text-[10px] font-medium text-zinc-600">Aponte a câmera</p>
            </div>
          </div>
        </main>
      </div>

      <footer className="relative z-[1] border-t border-white/10 bg-black/40 px-6 py-4 text-center text-sm backdrop-blur-md">
        <p className={`font-medium ${palette.accent}`}>{footerLine}</p>
      </footer>

      <details className="fixed bottom-20 right-4 z-20 max-w-[14rem] rounded-lg border border-white/15 bg-black/75 p-3 text-left text-[11px] text-white shadow-xl backdrop-blur-md">
        <summary className="cursor-pointer select-none font-semibold text-white/90">Personalizar TV</summary>
        <div className="mt-3 space-y-2">
          <label className="block text-white/70">
            Paleta
            <select
              value={tvMerged.colorPalette}
              onChange={(e) =>
                persistTvLocal({
                  colorPalette: e.target.value as ResolvedTenantConfig["tvDisplay"]["colorPalette"],
                })
              }
              className="mt-1 w-full rounded border border-white/20 bg-black/50 px-2 py-1 text-white"
            >
              <option value="red-black">Vermelho / Preto</option>
              <option value="yellow-black">Amarelo / Preto</option>
              <option value="blue-white">Azul / Branco</option>
              <option value="green-black">Verde / Preto</option>
            </select>
          </label>
          <label className="block text-white/70">
            Fundo (opacidade suave)
            <input
              type="file"
              accept="image/*"
              className="mt-1 block w-full text-[10px] file:mr-1 file:rounded file:border-0 file:bg-white/20 file:px-1 file:text-white"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) {
                  persistTvLocal({ backgroundImageDataUrl: null });
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                  const url = typeof reader.result === "string" ? reader.result : null;
                  persistTvLocal({ backgroundImageDataUrl: url });
                };
                reader.readAsDataURL(f);
              }}
            />
          </label>
          <button
            type="button"
            className="w-full rounded border border-white/25 py-1 text-[10px] font-medium text-white/80 hover:bg-white/10"
            onClick={() => {
              if (!tenantId) return;
              try {
                localStorage.removeItem(`sf-lite-display-${tenantId}`);
              } catch {
                /* */
              }
              setTvLocal({});
            }}
          >
            Restaurar padrão do servidor
          </button>
        </div>
      </details>
    </div>
  );
}
