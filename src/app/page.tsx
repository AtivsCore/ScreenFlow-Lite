"use client";

import { EditAtendimentoModal } from "@/components/screenflow/edit-atendimento-modal";
import { AppSidebar } from "@/components/screenflow/app-sidebar";
import { PatientPanel } from "@/components/screenflow/patient-panel";
import { QueueSection } from "@/components/screenflow/queue-section";
import { RegistryPatientModal } from "@/components/screenflow/registry-patient-modal";
import { SettingsHubModal } from "@/components/screenflow/settings-hub-modal";
import { TvStrip } from "@/components/screenflow/tv-strip";
import {
  type AtendimentoLite,
  type AtendimentoLiteNested,
  type QueueTabId,
  STATUS_UPDATE,
  filterAndSortQueue,
  isFinalizado,
  mapAtendimentoNestedToFlat,
} from "@/lib/atendimentos-lite";
import {
  createSupabaseClientSafe,
  finalizeSupabasePublicPair,
  isNetworkLikeFetchFailure,
} from "@/lib/supabase";
import { useSupabasePublicEnv } from "@/components/supabase-env-provider";
import { useCallback, useEffect, useMemo, useState } from "react";

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
        setApiEnv(finalizeSupabasePublicPair({ url: j.url, anonKey: j.anonKey }));
      } catch {
        /* banner após probe */
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
    if (serverPublicEnv?.url && serverPublicEnv.anonKey) {
      return finalizeSupabasePublicPair(serverPublicEnv);
    }
    if (apiEnv?.url && apiEnv.anonKey) {
      return finalizeSupabasePublicPair(apiEnv);
    }
    return { url: "", anonKey: "" };
  }, [serverPublicEnv, apiEnv]);

  const supabase = useMemo(() => {
    const m = mergedEnv;
    if (!m.url || !m.anonKey) return null;
    return createSupabaseClientSafe(m.url, m.anonKey);
  }, [mergedEnv]);

  const [rows, setRows] = useState<AtendimentoLite[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [queueTab, setQueueTab] = useState<QueueTabId>("ordem");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [registryOpen, setRegistryOpen] = useState(false);
  const [editRow, setEditRow] = useState<AtendimentoLite | null>(null);

  const displayRows = useMemo(() => filterAndSortQueue(rows, queueTab), [rows, queueTab]);

  const selected = useMemo(
    () => (selectedId ? rows.find((r) => r.id === selectedId) ?? null : null),
    [rows, selectedId]
  );

  const tenantIdForInsert = useMemo(() => rows.find((r) => r.tenant_id)?.tenant_id ?? null, [rows]);

  const refreshRows = useCallback(async () => {
    const applyNested = (nested: AtendimentoLiteNested[]) => {
      setRows(nested.map(mapAtendimentoNestedToFlat));
    };

    const tryServerQueue = async (): Promise<boolean> => {
      try {
        const r = await fetch("/api/atendimentos-queue", { cache: "no-store" });
        const j = (await r.json()) as { ok?: boolean; data?: unknown; message?: string };
        if (!r.ok || !j.ok || !Array.isArray(j.data)) {
          setLoadError(
            j.message ||
              `Não foi possível carregar a fila pelo servidor (HTTP ${r.status}). Verifique RLS/policies se o erro citar permissão.`
          );
          setRows([]);
          return false;
        }
        applyNested(j.data as AtendimentoLiteNested[]);
        setLoadError(null);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setLoadError(
          `Rede: ${msg}. A fila tentou carregar via /api/atendimentos-queue.`
        );
        setRows([]);
        console.error("[ScreenFlow] tryServerQueue:", err);
        return false;
      }
    };

    if (!supabase) {
      setRows([]);
      if (apiProbeDone) {
        await tryServerQueue();
      }
      setLoading(false);
      return;
    }

    setLoadError(null);
    try {
      const { data, error } = await supabase.from("atendimentos_lite").select(`
      id,
      tenant_id,
      paciente_id,
      profissional_id,
      hora_marcada,
      status,
      prioridade,
      observacao,
      created_at,
      pacientes ( nome ),
      profissionais ( id, nome )
    `);

      if (error) {
        if (isNetworkLikeFetchFailure(error.message)) {
          await tryServerQueue();
        } else {
          setLoadError(error.message);
          setRows([]);
        }
      } else {
        applyNested((data as AtendimentoLiteNested[]) ?? []);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isNetworkLikeFetchFailure(msg)) {
        await tryServerQueue();
      } else {
        setLoadError(`Falha ao carregar a fila: ${msg}`);
        setRows([]);
        console.error("[ScreenFlow] refreshRows:", e);
      }
    } finally {
      setLoading(false);
    }
  }, [supabase, apiProbeDone]);

  useEffect(() => {
    queueMicrotask(() => {
      void refreshRows();
    });
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
      console.warn("[ScreenFlow] Realtime indisponível.", e);
    }

    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase, refreshRows]);

  useEffect(() => {
    if (!selectedId) return;
    const r = rows.find((x) => x.id === selectedId);
    if (r && isFinalizado(r)) {
      queueMicrotask(() => setSelectedId(null));
    }
  }, [rows, selectedId]);

  const tryProxyPatch = useCallback(
    async (id: string, patch: { status?: string; profissional_id?: string | null; observacao?: string | null }) => {
      const r = await fetch("/api/atendimentos-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const j = (await r.json()) as { ok?: boolean; message?: string };
      if (!r.ok || !j.ok) {
        setLoadError(j.message || `Atualização via servidor: HTTP ${r.status}`);
        return false;
      }
      await refreshRows();
      return true;
    },
    [refreshRows]
  );

  const patchAtendimento = useCallback(
    async (patch: { profissional_id?: string | null; observacao?: string | null }) => {
      if (!selectedId) return;
      setPending(true);
      setLoadError(null);
      try {
        if (supabase) {
          const { error } = await supabase.from("atendimentos_lite").update(patch).eq("id", selectedId);
          if (!error) {
            await refreshRows();
            return;
          }
          if (isNetworkLikeFetchFailure(error.message)) {
            await tryProxyPatch(selectedId, patch);
            return;
          }
          setLoadError(error.message);
          return;
        }
        await tryProxyPatch(selectedId, patch);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (isNetworkLikeFetchFailure(msg)) {
          await tryProxyPatch(selectedId, patch);
        } else {
          setLoadError(msg);
        }
      } finally {
        setPending(false);
      }
    },
    [supabase, selectedId, refreshRows, tryProxyPatch]
  );

  const updateStatus = useCallback(
    async (status: string, options?: { clearSelection?: boolean }) => {
      if (!selectedId) return;
      setPending(true);
      setLoadError(null);

      try {
        if (supabase) {
          const { error } = await supabase.from("atendimentos_lite").update({ status }).eq("id", selectedId);
          if (!error) {
            await refreshRows();
            if (options?.clearSelection) setSelectedId(null);
            return;
          }
          if (isNetworkLikeFetchFailure(error.message)) {
            const ok = await tryProxyPatch(selectedId, { status });
            if (ok && options?.clearSelection) setSelectedId(null);
            return;
          }
          setLoadError(error.message);
          return;
        }
        const ok = await tryProxyPatch(selectedId, { status });
        if (ok && options?.clearSelection) setSelectedId(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (isNetworkLikeFetchFailure(msg)) {
          const ok = await tryProxyPatch(selectedId, { status });
          if (ok && options?.clearSelection) setSelectedId(null);
        } else {
          setLoadError(`Falha ao atualizar status: ${msg}`);
          console.error("[ScreenFlow] updateStatus:", e);
        }
      } finally {
        setPending(false);
      }
    },
    [supabase, selectedId, refreshRows, tryProxyPatch]
  );

  const envChecking = !apiProbeDone && !supabase;
  const envMissing = apiProbeDone && !supabase;
  const canMutate =
    !pending && !!selectedId && (!!supabase || (!!mergedEnv.url && !!mergedEnv.anonKey));

  return (
    <div className="flex h-[100dvh] min-h-0 w-full flex-1 overflow-hidden bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <AppSidebar onOpenSettings={() => setSettingsOpen(true)} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {envChecking && (
          <div className="shrink-0 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400">
            Verificando variáveis do Supabase no servidor…
          </div>
        )}
        {envMissing && (
          <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            Credenciais do Supabase não encontradas em runtime (
            <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/60">NEXT_PUBLIC_SUPABASE_URL</code> +{" "}
            <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/60">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
            , ou <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/60">SUPABASE_URL</code> +{" "}
            <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/60">SUPABASE_ANON_KEY</code>).
          </div>
        )}
        {loadError && !envMissing && (
          <div className="shrink-0 border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
            {loadError}
          </div>
        )}

        <header className="grid shrink-0 gap-3 border-b border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 lg:grid-cols-2">
          <PatientPanel
            selected={selected}
            loading={loading}
            supabase={supabase}
            canMutate={canMutate}
            pending={pending}
            onChamar={() => void updateStatus(STATUS_UPDATE.chamar)}
            onRechamar={() => void updateStatus(STATUS_UPDATE.rechamar)}
            onFinalizar={() => void updateStatus(STATUS_UPDATE.finalizar, { clearSelection: true })}
            onLimpar={() => setSelectedId(null)}
            onPatch={async (patch) => {
              await patchAtendimento(patch);
            }}
          />
          <TvStrip />
        </header>

        <main className="min-h-0 flex-1 overflow-hidden p-3">
          <QueueSection
            displayRows={displayRows}
            queueTab={queueTab}
            onQueueTab={setQueueTab}
            selectedId={selectedId}
            onSelectId={setSelectedId}
            loading={loading}
            supabase={supabase}
            onRefresh={() => void refreshRows()}
            onRegisterClick={() => setRegistryOpen(true)}
            onEditRow={(row) => setEditRow(row)}
          />
        </main>
      </div>

      <SettingsHubModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        supabase={supabase}
        onDataChanged={() => void refreshRows()}
      />

      <RegistryPatientModal
        open={registryOpen}
        onClose={() => setRegistryOpen(false)}
        supabase={supabase}
        tenantId={tenantIdForInsert}
        onRegistered={() => void refreshRows()}
      />

      <EditAtendimentoModal
        open={!!editRow}
        row={editRow}
        onClose={() => setEditRow(null)}
        supabase={supabase}
        onSaved={() => void refreshRows()}
      />
    </div>
  );
}
