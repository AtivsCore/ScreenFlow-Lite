"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MapPin,
  Monitor,
  Stethoscope,
  HeartPulse,
  Tv,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  type AtendimentoLite,
  type AtendimentoLiteNested,
  STATUS_UPDATE,
  formatHoraMarcada,
  mapAtendimentoNestedToFlat,
  sortAtendimentosLite,
} from "@/lib/atendimentos-lite";
import {
  createSupabaseClientSafe,
} from "@/lib/supabase";
import { useSupabasePublicEnv } from "@/components/supabase-env-provider";

const settingsLinks = [
  { href: "/medicos", label: "Médicos", icon: Stethoscope },
  { href: "/locais", label: "Locais", icon: MapPin },
  { href: "/especialidades", label: "Especialidades", icon: HeartPulse },
] as const;

const tvMonitors = [
  { id: "tv-1", label: "Recepção", status: "online" as const },
  { id: "tv-2", label: "Sala A", status: "online" as const },
  { id: "tv-3", label: "Sala B", status: "offline" as const },
];

export default function Home() {
  const serverPublicEnv = useSupabasePublicEnv();
  const hasServerCred = !!(serverPublicEnv?.url && serverPublicEnv?.anonKey);

  const [apiEnv, setApiEnv] = useState<{ url: string; anonKey: string } | null>(null);
  const [apiProbeDone, setApiProbeDone] = useState(hasServerCred);

  useEffect(() => {
    if (hasServerCred) return;

    let cancelled = false;

    async function probe() {
      try {
        const res = await fetch("/api/supabase-public", { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as { ok?: boolean; url?: string; anonKey?: string };
        if (cancelled || !j?.ok || typeof j.url !== "string" || typeof j.anonKey !== "string") return;
        setApiEnv({ url: j.url, anonKey: j.anonKey });
      } catch {
        /* silêncio: banner após probe */
      } finally {
        if (!cancelled) setApiProbeDone(true);
      }
    }

    void probe();

    return () => {
      cancelled = true;
    };
  }, [hasServerCred]);

  const mergedEnv = useMemo(() => {
    if (serverPublicEnv?.url && serverPublicEnv.anonKey) return serverPublicEnv;
    if (apiEnv?.url && apiEnv.anonKey) return apiEnv;
    return { url: "", anonKey: "" };
  }, [serverPublicEnv?.url, serverPublicEnv?.anonKey, apiEnv]);

  const supabase = useMemo(() => {
    const m = mergedEnv;
    if (!m.url || !m.anonKey) return null;
    return createSupabaseClientSafe(m.url, m.anonKey);
  }, [mergedEnv.url, mergedEnv.anonKey]);

  const [rows, setRows] = useState<AtendimentoLite[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  const sortedRows = useMemo(() => sortAtendimentosLite(rows), [rows]);

  const selected = useMemo(
    () => sortedRows.find((r) => r.id === selectedId) ?? null,
    [sortedRows, selectedId]
  );

  const refreshRows = useCallback(async () => {
    if (!supabase) {
      setRows([]);
      if (apiProbeDone) {
        setLoadError("Supabase não configurado (credenciais ausentes ou inválidas em runtime).");
        setLoading(false);
      }
      return;
    }
    setLoadError(null);
    try {
      const { data, error } = await supabase.from("atendimentos_lite").select(`
      id,
      status,
      prioridade,
      hora_marcada,
      pacientes ( nome ),
      profissionais ( nome ),
      locais ( nome )
    `);

      if (error) {
        setLoadError(error.message);
        setRows([]);
      } else {
        const flat = ((data as AtendimentoLiteNested[]) ?? []).map(mapAtendimentoNestedToFlat);
        setRows(flat);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLoadError(`Falha ao carregar a fila: ${msg}`);
      setRows([]);
      console.error("[ScreenFlow] refreshRows:", e);
    } finally {
      setLoading(false);
    }
  }, [supabase, apiProbeDone]);

  useEffect(() => {
    void refreshRows();
  }, [refreshRows]);

  useEffect(() => {
    if (!supabase) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel("screenflow-atendimentos-lite")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "atendimentos_lite" },
          () => {
            void refreshRows();
          }
        )
        .subscribe();
    } catch (e) {
      console.warn("[ScreenFlow] Realtime indisponível (a lista ainda pode ser carregada manualmente).", e);
    }

    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase, refreshRows]);

  useEffect(() => {
    if (!sortedRows.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) =>
      prev && sortedRows.some((r) => r.id === prev) ? prev : sortedRows[0].id
    );
  }, [sortedRows]);

  const updateStatus = useCallback(
    async (status: string) => {
      if (!supabase || !selectedId) return;
      setPending(true);
      setLoadError(null);
      try {
        const { error } = await supabase
          .from("atendimentos_lite")
          .update({ status })
          .eq("id", selectedId);
        if (error) setLoadError(error.message);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setLoadError(`Falha ao atualizar status: ${msg}`);
        console.error("[ScreenFlow] updateStatus:", e);
      } finally {
        setPending(false);
      }
    },
    [supabase, selectedId]
  );

  const envChecking = !apiProbeDone && !supabase;
  const envMissing = apiProbeDone && !supabase;

  return (
    <div className="flex min-h-full flex-1 bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="flex min-w-0 flex-1 flex-col">
        {envChecking && (
          <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400">
            Verificando variáveis do Supabase no servidor…
          </div>
        )}
        {envMissing && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            Credenciais do Supabase não encontradas em runtime (
            <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/60">NEXT_PUBLIC_SUPABASE_URL</code> +{" "}
            <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/60">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
            , ou aliases <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/60">SUPABASE_URL</code> +{" "}
            <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/60">SUPABASE_ANON_KEY</code> no painel da
            Vercel). Confira o projeto e o ambiente Production; depois redeploy. Nos logs da Vercel procure{" "}
            <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/60">[ScreenFlow][env:</code>.
          </div>
        )}
        {loadError && !envMissing && (
          <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
            {loadError}
          </div>
        )}

        <header className="grid shrink-0 gap-4 border-b border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 lg:grid-cols-2">
          <section className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Paciente selecionado
                </p>
                {selected ? (
                  <>
                    <p className="mt-1 text-lg font-semibold leading-tight text-zinc-900 dark:text-zinc-50">
                      {selected.nome ?? "—"}
                    </p>
                    <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
                      {selected.documento ?? "—"}
                    </p>
                    <p className="mt-2 inline-flex rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950/80 dark:text-amber-200">
                      {selected.prioridade === true ? "Prioritário" : "Regular"}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                    {loading ? "Carregando fila…" : "Selecione um paciente na tabela abaixo."}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!selectedId || pending || !supabase}
                onClick={() => void updateStatus(STATUS_UPDATE.chamar)}
                className="min-h-12 min-w-[8.5rem] flex-1 rounded-lg bg-zinc-900 px-5 text-base font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Chamar
              </button>
              <button
                type="button"
                disabled={!selectedId || pending || !supabase}
                onClick={() => void updateStatus(STATUS_UPDATE.rechamar)}
                className="min-h-12 min-w-[8.5rem] flex-1 rounded-lg border-2 border-zinc-300 bg-white px-5 text-base font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
              >
                Rechamar
              </button>
              <button
                type="button"
                disabled={!selectedId || pending || !supabase}
                onClick={() => void updateStatus(STATUS_UPDATE.finalizar)}
                className="min-h-12 min-w-[8.5rem] flex-1 rounded-lg border-2 border-emerald-600 bg-emerald-600 px-5 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Finalizar
              </button>
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
            <div className="flex items-center gap-2">
              <Monitor className="size-4 shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden />
              <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                TVs conectadas
              </h2>
            </div>
            <ul className="grid gap-2 sm:grid-cols-3">
              {tvMonitors.map((tv) => (
                <li
                  key={tv.id}
                  className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
                >
                  <Tv className="size-4 shrink-0 text-zinc-400" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-zinc-800 dark:text-zinc-100">
                      {tv.label}
                    </p>
                    <p className="flex items-center gap-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                      {tv.status === "online" ? (
                        <>
                          <Wifi className="size-3 text-emerald-600 dark:text-emerald-400" />
                          <span>Online</span>
                        </>
                      ) : (
                        <>
                          <WifiOff className="size-3 text-red-500" />
                          <span>Offline</span>
                        </>
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </header>

        <main className="min-h-0 flex-1 overflow-auto p-4">
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                Fila em tempo real
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Prioridade ativa primeiro; depois horário marcado • Supabase realtime
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-xs text-zinc-800 dark:text-zinc-100">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-400">
                    <th className="px-3 py-2">Horário marcado</th>
                    <th className="px-3 py-2">Prioridade</th>
                    <th className="px-3 py-2">Paciente</th>
                    <th className="px-3 py-2">Médico</th>
                    <th className="px-3 py-2">Local</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                        Carregando atendimentos…
                      </td>
                    </tr>
                  )}
                  {!loading && sortedRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                        Nenhum registro em atendimentos_lite.
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    sortedRows.map((row) => {
                      const isSel = row.id === selectedId;
                      return (
                        <tr
                          key={row.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedId(row.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedId(row.id);
                            }
                          }}
                          className={`cursor-pointer border-b border-zinc-100 transition hover:bg-zinc-50/80 dark:border-zinc-800 dark:hover:bg-zinc-800/40 ${isSel ? "bg-zinc-100 dark:bg-zinc-800/60" : ""}`}
                        >
                          <td className="whitespace-nowrap px-3 py-1.5 font-mono text-zinc-600 dark:text-zinc-300">
                            {formatHoraMarcada(row.hora_marcada)}
                          </td>
                          <td className="px-3 py-1.5">
                            <span
                              className={
                                row.prioridade === true
                                  ? "rounded bg-amber-200 px-1.5 py-0.5 font-medium text-amber-950 dark:bg-amber-900/70 dark:text-amber-100"
                                  : "rounded bg-zinc-200 px-1.5 py-0.5 font-medium text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100"
                              }
                            >
                              {row.prioridade === true ? "Sim" : "Não"}
                            </span>
                          </td>
                          <td className="max-w-[12rem] truncate px-3 py-1.5 font-medium">
                            {row.nome ?? "—"}
                          </td>
                          <td className="max-w-[10rem] truncate px-3 py-1.5 text-zinc-700 dark:text-zinc-300">
                            {row.medico ?? "—"}
                          </td>
                          <td className="max-w-[8rem] truncate px-3 py-1.5 text-zinc-600 dark:text-zinc-400">
                            {row.local ?? "—"}
                          </td>
                          <td className="max-w-[8rem] truncate whitespace-nowrap px-3 py-1.5 text-zinc-600 dark:text-zinc-400">
                            {row.status ?? "—"}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      <aside
        className="flex w-14 shrink-0 flex-col items-center gap-1 border-l border-zinc-200 bg-white py-4 dark:border-zinc-800 dark:bg-zinc-900"
        aria-label="Configurações"
      >
        {settingsLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            title={label}
            className="flex size-11 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            <Icon className="size-5" strokeWidth={1.75} aria-hidden />
            <span className="sr-only">{label}</span>
          </Link>
        ))}
      </aside>
    </div>
  );
}
