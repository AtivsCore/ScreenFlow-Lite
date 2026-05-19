"use client";

import { ClientPanel } from "@/components/screenflow/client-panel";
import { AppSidebar } from "@/components/screenflow/app-sidebar";
import { QueueSection } from "@/components/screenflow/queue-section";
import { RegistryPatientModal } from "@/components/screenflow/registry-patient-modal";
import { SettingsHubModal } from "@/components/screenflow/settings-hub-modal";
import { TvStrip } from "@/components/screenflow/tv-strip";
import { EditAtendimentoModal } from "@/components/screenflow/edit-atendimento-modal";
import {
  type AtendimentoLite,
  type AtendimentoLiteNested,
  STATUS_UPDATE,
  filterAndSortQueue,
  isFinalizado,
  mapAtendimentosNestedToFlat,
} from "@/lib/atendimentos-lite";
import { buildServicoLookup } from "@/lib/atendimentos-rest";
import { fetchServicos } from "@/lib/fetch-servicos";
import { isNetworkLikeFetchFailure } from "@/lib/supabase";
import { mergeTenantConfig, type ResolvedTenantConfig } from "@/lib/tenant-config";
import { resolveDefaultTenantId } from "@/lib/tenant-id";
import { useMergedSupabaseClient } from "@/hooks/use-merged-supabase-client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const ENV_TENANT_ID = resolveDefaultTenantId();

export default function Home() {
  const router = useRouter();
  const { supabase, mergedEnv, envMissing, envChecking, apiProbeDone } = useMergedSupabaseClient();
  const [sessionReady, setSessionReady] = useState(false);

  const [rows, setRows] = useState<AtendimentoLite[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [queueTabId, setQueueTabId] = useState<string>("tab-ordem");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [registryOpen, setRegistryOpen] = useState(false);
  const [editRow, setEditRow] = useState<AtendimentoLite | null>(null);

  const [tenantConfig, setTenantConfig] = useState<ResolvedTenantConfig>(() => mergeTenantConfig({}));
  const [tvRows, setTvRows] = useState<{ id: string; nome: string | null }[]>([]);
  const [tvIdx, setTvIdx] = useState(0);
  const [tvAuto, setTvAuto] = useState(false);

  useEffect(() => {
    if (!supabase || envMissing) return;
    let cancelled = false;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (!session) {
        router.replace("/login");
        return;
      }
      setSessionReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (cancelled) return;
      if (!session) {
        setSessionReady(false);
        router.replace("/login");
        return;
      }
      setSessionReady(true);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase, envMissing, router]);

  const tenantIdFromRows = useMemo(() => rows.find((r) => r.tenant_id)?.tenant_id ?? null, [rows]);

  const [fallbackTenantId, setFallbackTenantId] = useState<string | null>(null);

  const effectiveTenantId = tenantIdFromRows ?? ENV_TENANT_ID ?? fallbackTenantId;

  useEffect(() => {
    if (!supabase || !sessionReady) return;
    let cancelled = false;
    void supabase
      .from("tvs")
      .select("id,nome")
      .order("nome")
      .then(({ data }) => {
        if (cancelled) return;
        setTvRows((data as { id: string; nome: string | null }[] | null) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, sessionReady]);

  useEffect(() => {
    if (!supabase || !sessionReady || tenantIdFromRows || ENV_TENANT_ID) return;
    let cancelled = false;
    void supabase
      .from("atendimentos_lite")
      .select("tenant_id")
      .not("tenant_id", "is", null)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setFallbackTenantId((data as { tenant_id: string }).tenant_id);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, sessionReady, tenantIdFromRows]);

  useEffect(() => {
    if (!supabase || !effectiveTenantId) return;
    let cancelled = false;
    void supabase
      .from("tenants")
      .select("configuracoes")
      .eq("id", effectiveTenantId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.warn("[ScreenFlow] tenants.configuracoes:", error.message);
        if (data?.configuracoes != null) setTenantConfig(mergeTenantConfig(data.configuracoes));
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, effectiveTenantId]);

  useEffect(() => {
    const ids = tenantConfig.queueTabs.map((t) => t.id);
    if (ids.length && !ids.includes(queueTabId)) setQueueTabId(ids[0]!);
  }, [tenantConfig.queueTabs, queueTabId]);

  const queuePreset = useMemo(() => {
    const tab = tenantConfig.queueTabs.find((t) => t.id === queueTabId);
    return tab?.preset ?? "ordem";
  }, [tenantConfig.queueTabs, queueTabId]);

  const displayRows = useMemo(
    () => filterAndSortQueue(rows, queuePreset, { priorityLawEnabled: tenantConfig.priorityLawEnabled }),
    [rows, queuePreset, tenantConfig.priorityLawEnabled]
  );

  const selected = useMemo(
    () => (selectedId ? rows.find((r) => r.id === selectedId) ?? null : null),
    [rows, selectedId]
  );

  const tenantIdForInsert = effectiveTenantId;

  const refreshRows = useCallback(async () => {
    const applyNested = (
      nested: AtendimentoLiteNested[],
      servicos?: { id: string; nome: string | null }[]
    ) => {
      const lookup = servicos ? buildServicoLookup(servicos) : undefined;
      setRows(mapAtendimentosNestedToFlat(nested, lookup));
    };

    const fetchServicosClient = async (): Promise<{ id: string; nome: string | null }[]> => {
      if (!supabase) return [];
      const { data } = await fetchServicos(supabase, effectiveTenantId);
      return data;
    };

    const tryServerQueue = async (): Promise<boolean> => {
      try {
        const r = await fetch("/api/atendimentos-queue", { cache: "no-store" });
        const j = (await r.json()) as {
          ok?: boolean;
          data?: unknown;
          servicos?: { id: string; nome: string | null }[];
          message?: string;
        };
        if (!r.ok || !j.ok || !Array.isArray(j.data)) {
          setLoadError(
            j.message ||
              `Não foi possível carregar a fila pelo servidor (HTTP ${r.status}). Verifique RLS/policies se o erro citar permissão.`
          );
          setRows([]);
          return false;
        }
        applyNested(j.data as AtendimentoLiteNested[], j.servicos);
        setLoadError(null);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setLoadError(`Rede: ${msg}. A fila tentou carregar via /api/atendimentos-queue.`);
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
      const atendimentosSelect = [
        "id",
        "tenant_id",
        "paciente_id",
        "profissional_id",
        "local_id",
        "especialidade_id",
        "tv_id",
        "hora_marcada",
        "status",
        "prioridade",
        "observacao",
        "excluir_do_fechamento",
        "created_at",
        "pacientes ( nome )",
        "profissionais ( id, nome )",
        "locais ( id, nome )",
      ].join(",\n      ");

      const [atendRes, servicos] = await Promise.all([
        supabase.from("atendimentos_lite").select(atendimentosSelect),
        fetchServicosClient(),
      ]);

      const { data, error } = atendRes;

      if (error) {
        if (isNetworkLikeFetchFailure(error.message)) {
          await tryServerQueue();
        } else {
          setLoadError(error.message);
          setRows([]);
        }
      } else {
        applyNested(((data ?? []) as unknown) as AtendimentoLiteNested[], servicos);
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
  }, [supabase, apiProbeDone, effectiveTenantId]);

  useEffect(() => {
    if (!sessionReady) return;
    queueMicrotask(() => {
      void refreshRows();
    });
  }, [refreshRows, sessionReady]);

  useEffect(() => {
    if (!supabase || !sessionReady) return;

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
  }, [supabase, sessionReady, refreshRows]);

  useEffect(() => {
    if (!selectedId) return;
    const r = rows.find((x) => x.id === selectedId);
    if (r && isFinalizado(r)) {
      queueMicrotask(() => setSelectedId(null));
    }
  }, [rows, selectedId]);

  const tryProxyPatch = useCallback(
    async (
      id: string,
      patch: {
        status?: string;
        profissional_id?: string | null;
        observacao?: string | null;
        local_id?: string | null;
        especialidade_id?: string | null;
        tv_id?: string | null;
        prioridade?: boolean;
        excluir_do_fechamento?: boolean;
      }
    ) => {
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
    async (patch: {
      profissional_id?: string | null;
      observacao?: string | null;
      local_id?: string | null;
      especialidade_id?: string | null;
      tv_id?: string | null;
    }) => {
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

  const canMutate =
    !pending && !!selectedId && (!!supabase || (!!mergedEnv.url && !!mergedEnv.anonKey));

  if (supabase && !sessionReady && !envMissing) {
    return (
      <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-zinc-100 text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Verificando sessão…</p>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] min-h-0 w-full flex-1 overflow-hidden bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <AppSidebar
        onOpenSettings={() => setSettingsOpen(true)}
        onSignOut={() => void supabase?.auth.signOut()}
      />

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
            <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/60">SUPABASE_ANON_KEY</code>
            ).
          </div>
        )}
        {loadError && !envMissing && (
          <div className="shrink-0 border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
            {loadError}
          </div>
        )}

        <header className="grid shrink-0 gap-3 border-b border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 lg:grid-cols-2">
          <ClientPanel
            selected={selected}
            loading={loading}
            supabase={supabase}
            canMutate={canMutate}
            pending={pending}
            priorityLawEnabled={tenantConfig.priorityLawEnabled}
            tenantId={effectiveTenantId}
            onChamar={() => void updateStatus(STATUS_UPDATE.chamar)}
            onRechamar={() => void updateStatus(STATUS_UPDATE.rechamar)}
            onFinalizar={() => void updateStatus(STATUS_UPDATE.finalizar, { clearSelection: true })}
            onLimpar={() => setSelectedId(null)}
            onPatch={async (patch) => {
              await patchAtendimento(patch);
            }}
          />
          <TvStrip
            tvs={tvRows}
            selectedIndex={tvIdx}
            onSelectIndex={setTvIdx}
            autoRotate={tvAuto}
            onAutoRotate={setTvAuto}
            rotateMs={12_000}
          />
        </header>

        <main className="min-h-0 flex-1 overflow-hidden p-3">
          <QueueSection
            displayRows={displayRows}
            queueTabs={tenantConfig.queueTabs}
            queueTabId={queueTabId}
            onQueueTabId={setQueueTabId}
            priorityLawEnabled={tenantConfig.priorityLawEnabled}
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
        tenantId={effectiveTenantId}
        config={tenantConfig}
        onConfigUpdated={(c) => setTenantConfig(c)}
        onDataChanged={() => void refreshRows()}
      />

      <RegistryPatientModal
        open={registryOpen}
        onClose={() => setRegistryOpen(false)}
        supabase={supabase}
        tenantId={tenantIdForInsert}
        tenantConfig={tenantConfig}
        onRegistered={() => void refreshRows()}
      />

      <EditAtendimentoModal
        open={!!editRow}
        row={editRow}
        onClose={() => setEditRow(null)}
        supabase={supabase}
        priorityLawEnabled={tenantConfig.priorityLawEnabled}
        onSaved={() => void refreshRows()}
      />
    </div>
  );
}
