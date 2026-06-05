"use client";

import { ClientPanel } from "@/components/screenflow/client-panel";
import { AgendaProView } from "@/components/screenflow/agenda-pro-view";
import { AppSidebar, type AppView } from "@/components/screenflow/app-sidebar";
import { CrudEntityModal } from "@/components/screenflow/crud-entity-modal";
import { KeyboardShortcutsModal } from "@/components/screenflow/keyboard-shortcuts-modal";
import { FinalizeConfirmModal } from "@/components/screenflow/finalize-confirm-modal";
import { ProUpgradeModal } from "@/components/screenflow/pro-upgrade-modal";
import { ReportsModal } from "@/components/screenflow/reports-modal";
import { QueueSection, type QueueViewMode } from "@/components/screenflow/queue-section";
import { RegistryPatientModal } from "@/components/screenflow/registry-patient-modal";
import { SettingsHubModal } from "@/components/screenflow/settings-hub-modal";
import { TvStrip } from "@/components/screenflow/tv-strip";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { purgeAtendimentoRecord } from "@/lib/purge-atendimento";
import { isProPlan, resolvePlanTier } from "@/lib/plan-tier";
import { SERVICES_CRUD_TABLE } from "@/lib/db-tables";
import { buildCadastroLookups, type CadastroLookups } from "@/lib/cadastro-valores";
import { SegmentConfigModal } from "@/components/screenflow/segment-config-modal";
import { EditAtendimentoModal } from "@/components/screenflow/edit-atendimento-modal";
import {
  type AtendimentoLite,
  type AtendimentoLiteNested,
  STATUS_UPDATE,
  countActiveByQueueTab,
  isFinalizado,
  mapAtendimentosNestedToFlat,
} from "@/lib/atendimentos-lite";
import { buildServicoLookup } from "@/lib/atendimentos-rest";
import { fetchServicos } from "@/lib/fetch-servicos";
import { isNetworkLikeFetchFailure } from "@/lib/supabase";
import {
  mergeTenantConfig,
  configuracoesForSupabase,
  resolveVisibleQueueTabs,
  type ObservacoesVisibility,
  type ResolvedTenantConfig,
} from "@/lib/tenant-config";
import {
  AVIACAO_QUEUE_TAB,
  appendAviacaoTimelineEntry,
  aviacaoStepTvStatus,
  canShiftAviacaoTab,
  filterAviacaoQueueRows,
  findAviacaoQueueTabById,
  getAviacaoActiveColumns,
  getAviacaoHangarLabel,
  isAviacaoSegment,
  mergeAviacaoObservacao,
  normalizeAviacaoTabId,
  parseAviacaoCadastroFields,
  parseAviacaoFilaTabId,
  requiresAviacaoPecaJustification,
  resolveAviacaoQueueTabs,
  resolveAviacaoTabActionLabel,
  resolveAviacaoTabIdFromObservacao,
  shiftAviacaoTab,
} from "@/lib/aviacao-logistics";
import {
  DOCAS_QUEUE_TAB,
  docasStepTvStatus,
  getDocasStepLabel,
  isDocasSegment,
  resolveDocasStepFromObservacao,
  filterDocasQueueRowsForPlan,
  findDocasQueueTabByStep,
  mergeDocasObservacao,
  shiftDocasStep,
  type DocasQueueTabId,
} from "@/lib/docas-logistics";
import { applySegmentPreset, shouldAutoApplySegmentPreset } from "@/lib/segment-presets";
import { parseTenantIdParam, resolveDefaultTenantId } from "@/lib/tenant-id";
import {
  fetchSessionTenantId,
  fetchSessionTenants,
  type SessionTenantOption,
} from "@/lib/session-tenant";
import { useMergedSupabaseClient } from "@/hooks/use-merged-supabase-client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

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
  const [settingsInitialTab, setSettingsInitialTab] = useState<"fluxo" | "geral" | "cadastros">("fluxo");
  const [registryOpen, setRegistryOpen] = useState(false);
  const [segmentOpen, setSegmentOpen] = useState(false);
  const [segmentoDefinido, setSegmentoDefinido] = useState<string | null>(null);
  const [tenantMetaLoaded, setTenantMetaLoaded] = useState(false);
  const [segmentBootstrapAttempted, setSegmentBootstrapAttempted] = useState(false);
  const [editRow, setEditRow] = useState<AtendimentoLite | null>(null);
  const [editFromAgenda, setEditFromAgenda] = useState(false);
  const [queueViewMode, setQueueViewMode] = useState<QueueViewMode>("list");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [proUpgradeOpen, setProUpgradeOpen] = useState(false);
  const [proUpgradeTitle, setProUpgradeTitle] = useState<string | undefined>();
  const [proUpgradeDescription, setProUpgradeDescription] = useState<string | undefined>();
  const [appView, setAppView] = useState<AppView>("fila");
  const [quickCrud, setQuickCrud] = useState<{ title: string; table: string } | null>(null);
  const [, startTransition] = useTransition();

  const [tenantConfig, setTenantConfig] = useState<ResolvedTenantConfig>(() => mergeTenantConfig({}));

  const planTier = useMemo(
    () => resolvePlanTier(tenantConfig.planTier),
    [tenantConfig.planTier]
  );
  const proActive = isProPlan(planTier);

  const setObservacoesVisibility = useCallback((visibility: ObservacoesVisibility) => {
    setTenantConfig((prev) => ({ ...prev, observacoesVisibility: visibility }));
  }, []);
  const [tvRows, setTvRows] = useState<{ id: string; nome: string | null }[]>([]);
  const [tvIdx, setTvIdx] = useState(0);
  const [tvAuto, setTvAuto] = useState(false);
  const [cadastroLookups, setCadastroLookups] = useState<CadastroLookups>({
    profissionais: new Map(),
    locais: new Map(),
    servicos: new Map(),
  });

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
  const [sessionTenantId, setSessionTenantId] = useState<string | null>(null);
  const [aviacaoBaseTenantId, setAviacaoBaseTenantId] = useState<string | null>(null);
  const [aviacaoTenantOptions, setAviacaoTenantOptions] = useState<SessionTenantOption[]>([]);
  const [aviacaoFilterPriorityOnly, setAviacaoFilterPriorityOnly] = useState(false);
  const [aviacaoHideAguardandoPecas, setAviacaoHideAguardandoPecas] = useState(false);
  const [aviacaoSelectedHangarIds, setAviacaoSelectedHangarIds] = useState<string[]>([]);

  const docasLogisticsActive = isDocasSegment(tenantConfig.segmentoAplicado);
  const aviacaoLogisticsActive = isAviacaoSegment(tenantConfig.segmentoAplicado);

  const defaultTenantId = sessionTenantId ?? tenantIdFromRows ?? ENV_TENANT_ID ?? fallbackTenantId;
  const effectiveTenantId =
    aviacaoLogisticsActive && aviacaoBaseTenantId
      ? aviacaoBaseTenantId
      : defaultTenantId;

  useEffect(() => {
    if (!supabase || !sessionReady) return;
    let cancelled = false;
    void fetchSessionTenantId(supabase).then((tid) => {
      if (!cancelled) setSessionTenantId(tid);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, sessionReady]);

  useEffect(() => {
    if (!supabase || !sessionReady || !aviacaoLogisticsActive) {
      setAviacaoTenantOptions([]);
      return;
    }
    let cancelled = false;
    void fetchSessionTenants(supabase).then((opts) => {
      if (cancelled) return;
      setAviacaoTenantOptions(opts);
      setAviacaoBaseTenantId((prev) => {
        if (prev && opts.some((o) => o.id === prev)) return prev;
        const preferred =
          sessionTenantId && opts.some((o) => o.id === sessionTenantId)
            ? sessionTenantId
            : opts[0]?.id ?? null;
        return preferred;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, sessionReady, aviacaoLogisticsActive, sessionTenantId]);

  const handleAviacaoBaseChange = useCallback((tid: string) => {
    setAviacaoBaseTenantId(tid);
    setSelectedId(null);
  }, []);

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
    setTenantMetaLoaded(false);
    setSegmentBootstrapAttempted(false);
    let cancelled = false;
    void supabase
      .from("tenants")
      .select("configuracoes, segmento_definido")
      .eq("id", effectiveTenantId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.warn("[ScreenFlow] tenants.configuracoes:", error.message);
        if (data?.configuracoes != null) setTenantConfig(mergeTenantConfig(data.configuracoes));
        setSegmentoDefinido((data as { segmento_definido?: string | null } | null)?.segmento_definido ?? null);
        setTenantMetaLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, effectiveTenantId]);

  useEffect(() => {
    if (!supabase || !effectiveTenantId || !tenantMetaLoaded || segmentBootstrapAttempted) return;

    const presetId = shouldAutoApplySegmentPreset(tenantConfig, segmentoDefinido);
    if (!presetId) {
      setSegmentBootstrapAttempted(true);
      return;
    }

    setSegmentBootstrapAttempted(true);
    let cancelled = false;
    void (async () => {
      const patch = applySegmentPreset(presetId);
      const next: ResolvedTenantConfig = {
        ...tenantConfig,
        queueTabs: patch.queueTabs,
        cadastroCategories: patch.cadastroCategories,
        registerForm: patch.registerForm,
        segmentoAplicado: patch.segmentoAplicado,
      };
      const payload = configuracoesForSupabase(next);
      const { error: saveErr } = await supabase
        .from("tenants")
        .update({ configuracoes: payload })
        .eq("id", effectiveTenantId);
      if (cancelled) return;
      if (saveErr) {
        console.warn("[ScreenFlow] auto segment preset:", saveErr.message);
      } else {
        setTenantConfig(next);
        const visible = resolveVisibleQueueTabs(next);
        if (visible.length) setQueueTabId(visible[0]!.id);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    supabase,
    effectiveTenantId,
    tenantMetaLoaded,
    segmentBootstrapAttempted,
    tenantConfig,
    segmentoDefinido,
  ]);

  useEffect(() => {
    const visible = resolveVisibleQueueTabs(tenantConfig);
    const ids = visible.map((t) => t.id);
    if (ids.length && !ids.includes(queueTabId)) setQueueTabId(ids[0]!);
  }, [tenantConfig, queueTabId]);

  const visibleQueueTabs = useMemo(
    () =>
      aviacaoLogisticsActive
        ? resolveAviacaoQueueTabs(tenantConfig)
        : resolveVisibleQueueTabs(tenantConfig),
    [aviacaoLogisticsActive, tenantConfig]
  );

  const aviacaoActiveColumns = useMemo(
    () => (aviacaoLogisticsActive ? getAviacaoActiveColumns(visibleQueueTabs) : []),
    [aviacaoLogisticsActive, visibleQueueTabs]
  );

  const queueDisplayRows = useMemo(() => {
    let result = rows;
    if (docasLogisticsActive) result = filterDocasQueueRowsForPlan(result, planTier);
    if (aviacaoLogisticsActive) {
      result = filterAviacaoQueueRows(result, {
        priorityOnly: aviacaoFilterPriorityOnly,
        hideAguardandoPecas: aviacaoHideAguardandoPecas,
        hangarIds: aviacaoSelectedHangarIds.length > 0 ? aviacaoSelectedHangarIds : undefined,
      });
    }
    return result;
  }, [
    rows,
    docasLogisticsActive,
    aviacaoLogisticsActive,
    planTier,
    aviacaoFilterPriorityOnly,
    aviacaoHideAguardandoPecas,
    aviacaoSelectedHangarIds,
  ]);

  const tabCounts = useMemo(
    () => countActiveByQueueTab(queueDisplayRows, visibleQueueTabs),
    [queueDisplayRows, visibleQueueTabs]
  );

  const selected = useMemo(
    () => (selectedId ? rows.find((r) => r.id === selectedId) ?? null : null),
    [rows, selectedId]
  );

  const tenantIdForInsert = effectiveTenantId;

  const handleSelectId = useCallback((id: string) => {
    startTransition(() => setSelectedId(id));
  }, []);

  const openFlowSettings = useCallback(() => {
    setSettingsInitialTab("fluxo");
    setSettingsOpen(true);
  }, []);

  useEffect(() => {
    if (!supabase || !effectiveTenantId) return;
    let cancelled = false;
    void (async () => {
      const [p, l, s] = await Promise.all([
        supabase.from("profissionais").select("id,nome,especialidade").eq("tenant_id", effectiveTenantId).order("nome"),
        supabase.from("locais").select("id,nome").eq("tenant_id", effectiveTenantId).order("nome"),
        fetchServicos(supabase, effectiveTenantId),
      ]);
      if (cancelled) return;
      setCadastroLookups(
        buildCadastroLookups(
          (p.data as { id: string; nome: string | null; especialidade?: string | null }[] | null) ?? [],
          (l.data as { id: string; nome: string | null }[] | null) ?? [],
          s.data
        )
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, effectiveTenantId, tenantConfig.cadastroCategories]);

  const openGeneralSettings = useCallback(() => {
    setSettingsInitialTab("geral");
    setSettingsOpen(true);
  }, []);

  const applyLocalPatch = useCallback((id: string, patch: Record<string, unknown>) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? ({ ...r, ...patch } as AtendimentoLite) : r))
    );
  }, []);

  const refreshRows = useCallback(async () => {
    const applyNested = (
      nested: AtendimentoLiteNested[],
      servicos?: { id: string; nome: string | null }[]
    ) => {
      const lookup = servicos ? buildServicoLookup(servicos) : undefined;
      setRows(mapAtendimentosNestedToFlat(nested, lookup, tenantConfig.cadastroCategories));
    };

    const fetchServicosClient = async (): Promise<{ id: string; nome: string | null }[]> => {
      if (!supabase) return [];
      const { data } = await fetchServicos(supabase, effectiveTenantId);
      return data;
    };

    const tryServerQueue = async (): Promise<boolean> => {
      const queueTenant =
        parseTenantIdParam(effectiveTenantId) ?? parseTenantIdParam(ENV_TENANT_ID);
      if (!queueTenant) {
        setLoadError("tenant_id inválido — configure NEXT_PUBLIC_DEFAULT_TENANT_ID ou vincule um tenant.");
        setRows([]);
        return false;
      }
      try {
        const r = await fetch(
          `/api/atendimentos-queue?tenant_id=${encodeURIComponent(queueTenant)}`,
          { cache: "no-store" }
        );
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
        "classificacao_prioridade",
        "observacao",
        "cadastro_valores",
        "excluir_do_fechamento",
        "created_at",
        "pacientes ( nome )",
        "profissionais ( id, nome, especialidade )",
        "locais ( id, nome )",
      ].join(",\n      ");

      const [atendRes, servicos] = await Promise.all([
        (effectiveTenantId
          ? supabase
              .from("atendimentos_lite")
              .select(atendimentosSelect)
              .eq("tenant_id", effectiveTenantId)
              .order("created_at", { ascending: true })
          : supabase.from("atendimentos_lite").select(atendimentosSelect).order("created_at", { ascending: true })),
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
  }, [supabase, apiProbeDone, effectiveTenantId, tenantConfig.cadastroCategories]);

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
        cadastro_valores?: Record<string, string | null>;
        tv_id?: string | null;
        prioridade?: boolean;
        classificacao_prioridade?: string;
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
      applyLocalPatch(id, patch as Record<string, unknown>);
      return true;
    },
    [applyLocalPatch]
  );

  const patchAtendimento = useCallback(
    async (patch: {
      profissional_id?: string | null;
      observacao?: string | null;
      local_id?: string | null;
      especialidade_id?: string | null;
      cadastro_valores?: Record<string, string | null>;
      tv_id?: string | null;
      status?: string;
    }) => {
      if (!selectedId) return;
      applyLocalPatch(selectedId, patch);
      setPending(true);
      setLoadError(null);
      try {
        if (supabase) {
          const { error } = await supabase.from("atendimentos_lite").update(patch).eq("id", selectedId);
          if (!error) return;
          if (isNetworkLikeFetchFailure(error.message)) {
            const ok = await tryProxyPatch(selectedId, patch);
            if (!ok) void refreshRows();
            return;
          }
          setLoadError(error.message);
          void refreshRows();
          return;
        }
        const ok = await tryProxyPatch(selectedId, patch);
        if (!ok) void refreshRows();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (isNetworkLikeFetchFailure(msg)) {
          const ok = await tryProxyPatch(selectedId, patch);
          if (!ok) void refreshRows();
        } else {
          setLoadError(msg);
          void refreshRows();
        }
      } finally {
        setPending(false);
      }
    },
    [supabase, selectedId, applyLocalPatch, refreshRows, tryProxyPatch]
  );

  const purgeRow = useCallback(
    async (row: AtendimentoLite) => {
      if (!supabase) {
        setLoadError("Supabase indisponível para excluir o registro.");
        return;
      }
      setPending(true);
      setLoadError(null);
      const { ok, message } = await purgeAtendimentoRecord(supabase, row);
      if (!ok) {
        setLoadError(message ?? "Falha ao excluir registro.");
      } else {
        if (selectedId === row.id) setSelectedId(null);
        setRows((prev) => prev.filter((r) => r.id !== row.id));
        void refreshRows();
      }
      setPending(false);
    },
    [supabase, selectedId, refreshRows]
  );

  const updateStatus = useCallback(
    async (status: string, options?: { clearSelection?: boolean }) => {
      if (!selectedId || !selected) return;

      if (!proActive && status === STATUS_UPDATE.finalizar) {
        await purgeRow(selected);
        return;
      }

      setPending(true);
      setLoadError(null);

      try {
        if (supabase) {
          applyLocalPatch(selectedId, { status });
          const { error } = await supabase.from("atendimentos_lite").update({ status }).eq("id", selectedId);
          if (!error) {
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
    [supabase, selectedId, selected, proActive, purgeRow, applyLocalPatch, tryProxyPatch]
  );

  const selectedDocasStep = useMemo(() => {
    if (!docasLogisticsActive || !selected) return null;
    return resolveDocasStepFromObservacao(selected.observacao);
  }, [docasLogisticsActive, selected]);

  const selectedDocasStepLabel = useMemo(() => {
    if (!selectedDocasStep) return null;
    return getDocasStepLabel(selectedDocasStep, tenantConfig.queueTabs);
  }, [selectedDocasStep, tenantConfig.queueTabs]);

  const selectedAviacaoTabId = useMemo(() => {
    if (!aviacaoLogisticsActive || !selected || aviacaoActiveColumns.length === 0) return null;
    return resolveAviacaoTabIdFromObservacao(selected.observacao, aviacaoActiveColumns);
  }, [aviacaoLogisticsActive, selected, aviacaoActiveColumns]);

  const selectedAviacaoHangarLabel = useMemo(() => {
    if (!aviacaoLogisticsActive || !selected) return null;
    return getAviacaoHangarLabel(selected, tenantConfig.cadastroCategories, cadastroLookups);
  }, [aviacaoLogisticsActive, selected, tenantConfig.cadastroCategories, cadastroLookups]);

  const advanceDocasLogistics = useCallback(
    async (targetTabId: DocasQueueTabId, status?: string) => {
      if (!selectedId || !selected) return;
      const tab = findDocasQueueTabByStep(tenantConfig.queueTabs, targetTabId);
      if (!tab) return;
      const observacao = mergeDocasObservacao({
        current: selected.observacao,
        tab,
      });
      const patch: {
        observacao: string | null;
        status?: string;
      } = { observacao };
      if (status) patch.status = status;
      await patchAtendimento(patch);
    },
    [selectedId, selected, tenantConfig.queueTabs, patchAtendimento]
  );

  const shiftSelectedDocasStep = useCallback(
    (delta: -1 | 1) => {
      if (!selectedDocasStep) return;
      const target = shiftDocasStep(selectedDocasStep, delta);
      if (!target) return;
      void advanceDocasLogistics(target, docasStepTvStatus(target));
    },
    [selectedDocasStep, advanceDocasLogistics]
  );

  const advanceAviacaoLogistics = useCallback(
    async (targetTabId: string, status?: string, opts?: { justification?: string; action?: string }) => {
      if (!selectedId || !selected) return;
      const tab = findAviacaoQueueTabById(visibleQueueTabs, targetTabId);
      if (!tab) return;

      let justification = opts?.justification?.trim();
      if (requiresAviacaoPecaJustification(targetTabId) && !justification) {
        const input = window.prompt(
          "Justificativa obrigatória para Aguardando Peças:",
          ""
        );
        if (!input?.trim()) return;
        justification = input.trim();
      }

      const fromTabId = parseAviacaoFilaTabId(selected.observacao);
      let aviacaoFields = parseAviacaoCadastroFields(selected.observacao);

      let userLabel = "Operador";
      if (supabase) {
        const { data } = await supabase.auth.getUser();
        const email = data.user?.email?.trim();
        const metaName =
          typeof data.user?.user_metadata?.nome === "string"
            ? data.user.user_metadata.nome.trim()
            : "";
        userLabel = metaName || email || userLabel;
      }

      const action =
        opts?.action ??
        resolveAviacaoTabActionLabel(fromTabId, targetTabId);
      aviacaoFields = appendAviacaoTimelineEntry(aviacaoFields, {
        action,
        user: userLabel,
        detail: justification,
      });

      const observacao = mergeAviacaoObservacao({
        current: selected.observacao,
        tab,
        aviacaoFields,
      });
      const patch: {
        observacao: string | null;
        status?: string;
      } = { observacao };
      if (status) patch.status = status;
      await patchAtendimento(patch);
    },
    [selectedId, selected, visibleQueueTabs, patchAtendimento, supabase]
  );

  const registerAviacaoAvaria = useCallback(async () => {
    if (!selectedId || !selected) return;
    const detail = window.prompt("Descreva a avaria registrada:", "");
    if (!detail?.trim()) return;

    let userLabel = "Operador";
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email?.trim();
      const metaName =
        typeof data.user?.user_metadata?.nome === "string"
          ? data.user.user_metadata.nome.trim()
          : "";
      userLabel = metaName || email || userLabel;
    }

    const aviacaoFields = appendAviacaoTimelineEntry(
      parseAviacaoCadastroFields(selected.observacao),
      { action: "Avaria registrada", user: userLabel, detail: detail.trim() }
    );
    const observacao = mergeAviacaoObservacao({
      current: selected.observacao,
      aviacaoFields,
      preserveTabWhenUnset: true,
    });
    await patchAtendimento({ observacao });
  }, [selectedId, selected, supabase, patchAtendimento]);

  const shiftSelectedAviacaoStep = useCallback(
    (delta: -1 | 1) => {
      if (!selectedAviacaoTabId || aviacaoActiveColumns.length === 0) return;
      const target = shiftAviacaoTab(selectedAviacaoTabId, delta, aviacaoActiveColumns);
      if (!target) return;
      void advanceAviacaoLogistics(target, aviacaoStepTvStatus(normalizeAviacaoTabId(target)));
    },
    [selectedAviacaoTabId, aviacaoActiveColumns, advanceAviacaoLogistics]
  );

  useEffect(() => {
    if (!docasLogisticsActive || !selected) return;
    const step = resolveDocasStepFromObservacao(selected.observacao);
    if (tenantConfig.queueTabs.some((t) => t.id === step)) {
      setQueueTabId(step);
    }
  }, [docasLogisticsActive, selected, tenantConfig.queueTabs]);

  useEffect(() => {
    if (!aviacaoLogisticsActive || !selected || aviacaoActiveColumns.length === 0) return;
    const tabId = resolveAviacaoTabIdFromObservacao(selected.observacao, aviacaoActiveColumns);
    if (tabId) setQueueTabId(tabId);
  }, [aviacaoLogisticsActive, selected, aviacaoActiveColumns]);

  useEffect(() => {
    if (!sessionReady || envMissing || appView !== "fila" || !docasLogisticsActive) return;

    function isTypingTarget(target: EventTarget | null): boolean {
      if (!target || !(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
    }

    function onArrowKey(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (isTypingTarget(e.target)) return;
      if (!selectedId || pending) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        shiftSelectedDocasStep(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        shiftSelectedDocasStep(-1);
      }
    }

    window.addEventListener("keydown", onArrowKey, { capture: true });
    return () => window.removeEventListener("keydown", onArrowKey, { capture: true });
  }, [
    sessionReady,
    envMissing,
    appView,
    docasLogisticsActive,
    selectedId,
    pending,
    shiftSelectedDocasStep,
  ]);

  useEffect(() => {
    if (!sessionReady || envMissing || appView !== "fila" || !aviacaoLogisticsActive) return;

    function isTypingTarget(target: EventTarget | null): boolean {
      if (!target || !(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
    }

    function onArrowKey(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (isTypingTarget(e.target)) return;
      if (!selectedId || pending) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        shiftSelectedAviacaoStep(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        shiftSelectedAviacaoStep(-1);
      }
    }

    window.addEventListener("keydown", onArrowKey, { capture: true });
    return () => window.removeEventListener("keydown", onArrowKey, { capture: true });
  }, [
    sessionReady,
    envMissing,
    appView,
    aviacaoLogisticsActive,
    selectedId,
    pending,
    shiftSelectedAviacaoStep,
  ]);

  const handleDeleteRow = useCallback(
    async (row: AtendimentoLite) => {
      if (!proActive) {
        await purgeRow(row);
        return;
      }
      if (!supabase) {
        setLoadError("Supabase indisponível.");
        return;
      }
      const { error } = await supabase.from("atendimentos_lite").delete().eq("id", row.id);
      if (error) setLoadError(error.message);
      else {
        if (selectedId === row.id) setSelectedId(null);
        void refreshRows();
      }
    },
    [proActive, purgeRow, supabase, selectedId, refreshRows]
  );

  const canMutate =
    !pending && !!selectedId && (!!supabase || (!!mergedEnv.url && !!mergedEnv.anonKey));

  const shortcutHandlers = useMemo(
    () => ({
      onChamar: () => {
        if (!canMutate) return;
        if (docasLogisticsActive) {
          void advanceDocasLogistics(DOCAS_QUEUE_TAB.CHAMADO, STATUS_UPDATE.chamar);
        } else if (aviacaoLogisticsActive) {
          void advanceAviacaoLogistics(AVIACAO_QUEUE_TAB.TRIAGEM, STATUS_UPDATE.chamar);
        } else {
          void updateStatus(STATUS_UPDATE.chamar);
        }
      },
      onRechamar: () => {
        if (!canMutate) return;
        if (docasLogisticsActive) {
          void advanceDocasLogistics(DOCAS_QUEUE_TAB.DESCARREGANDO, STATUS_UPDATE.rechamar);
        } else if (aviacaoLogisticsActive) {
          void advanceAviacaoLogistics(AVIACAO_QUEUE_TAB.EM_MANUTENCAO, STATUS_UPDATE.rechamar);
        } else {
          void updateStatus(STATUS_UPDATE.rechamar);
        }
      },
      onFinalizar: () => {
        if (!canMutate || !selectedId) return;
        if (docasLogisticsActive) {
          void advanceDocasLogistics(DOCAS_QUEUE_TAB.LIBERADO, "Aguardando");
        } else if (aviacaoLogisticsActive) {
          void advanceAviacaoLogistics(AVIACAO_QUEUE_TAB.LIBERADO, "Aguardando");
        } else {
          setFinalizeOpen(true);
        }
      },
      onLimpar: () => setSelectedId(null),
      onNovoRegistro: () => setRegistryOpen(true),
      onToggleView: () => setQueueViewMode((m) => (m === "list" ? "kanban" : "list")),
      onOpenSettings: () => openGeneralSettings(),
      onCrudProfissionais: () => setQuickCrud({ title: "Equipe (profissionais)", table: "profissionais" }),
      onCrudLocais: () => setQuickCrud({ title: "Locais", table: "locais" }),
      onCrudServicos: () => setQuickCrud({ title: "Serviços", table: SERVICES_CRUD_TABLE }),
    }),
    [
      canMutate,
      selectedId,
      docasLogisticsActive,
      aviacaoLogisticsActive,
      advanceDocasLogistics,
      advanceAviacaoLogistics,
      updateStatus,
      openGeneralSettings,
      shiftSelectedDocasStep,
    ]
  );

  useKeyboardShortcuts(shortcutHandlers, sessionReady && !envMissing && appView === "fila");

  const handleOpenAgenda = useCallback(() => {
    if (!proActive) {
      setProUpgradeTitle("Agenda no Plano PRO");
      setProUpgradeDescription(
        "Gerencie agendamentos futuros com data e hora livres, edite e exclua compromissos e planeje a operação com antecedência. Ative o Plano PRO pelo WhatsApp."
      );
      setProUpgradeOpen(true);
      return;
    }
    setAppView((v) => (v === "agenda" ? "fila" : "agenda"));
  }, [proActive]);

  if (supabase && !sessionReady && !envMissing) {
    return (
      <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-zinc-100 text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Verificando sessão…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen max-h-screen min-h-0 w-full max-w-full min-w-0 flex-1 overflow-hidden bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <AppSidebar
        activeView={appView}
        onOpenSegment={() => setSegmentOpen(true)}
        onOpenSettings={openGeneralSettings}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onOpenReports={() => setReportsOpen(true)}
        onOpenAgenda={handleOpenAgenda}
        onSignOut={() => void supabase?.auth.signOut()}
      />

      <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden">
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

        <header
          className={`grid w-full max-w-full shrink-0 gap-2 overflow-x-hidden border-b border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900 ${appView === "fila" ? "lg:grid-cols-2" : "hidden"}`}
        >
          <ClientPanel
            selected={selected}
            loading={loading}
            supabase={supabase}
            canMutate={canMutate}
            pending={pending}
            priorityLawEnabled={tenantConfig.priorityLawEnabled}
            observacoesVisibility={tenantConfig.observacoesVisibility}
            cadastroCategories={tenantConfig.cadastroCategories}
            segmentoAplicado={tenantConfig.segmentoAplicado}
            tenantId={effectiveTenantId}
            tenantOptions={aviacaoLogisticsActive ? aviacaoTenantOptions : undefined}
            onTenantChange={aviacaoLogisticsActive ? handleAviacaoBaseChange : undefined}
            onChamar={() => {
              if (docasLogisticsActive) {
                void advanceDocasLogistics(DOCAS_QUEUE_TAB.CHAMADO, STATUS_UPDATE.chamar);
              } else if (aviacaoLogisticsActive) {
                void advanceAviacaoLogistics(AVIACAO_QUEUE_TAB.TRIAGEM, STATUS_UPDATE.chamar);
              } else {
                void updateStatus(STATUS_UPDATE.chamar);
              }
            }}
            onRechamar={() => {
              if (docasLogisticsActive) {
                void advanceDocasLogistics(DOCAS_QUEUE_TAB.DESCARREGANDO, STATUS_UPDATE.rechamar);
              } else if (aviacaoLogisticsActive) {
                void advanceAviacaoLogistics(AVIACAO_QUEUE_TAB.EM_MANUTENCAO, STATUS_UPDATE.rechamar);
              } else {
                void updateStatus(STATUS_UPDATE.rechamar);
              }
            }}
            onFinalizar={() => {
              if (docasLogisticsActive) {
                void advanceDocasLogistics(DOCAS_QUEUE_TAB.LIBERADO, "Aguardando");
              } else if (aviacaoLogisticsActive) {
                void advanceAviacaoLogistics(AVIACAO_QUEUE_TAB.LIBERADO, "Aguardando");
              } else {
                setFinalizeOpen(true);
              }
            }}
            onLimpar={() => setSelectedId(null)}
            aviacaoFilterPriorityOnly={aviacaoFilterPriorityOnly}
            onAviacaoFilterPriorityOnlyChange={setAviacaoFilterPriorityOnly}
            aviacaoHideAguardandoPecas={aviacaoHideAguardandoPecas}
            onAviacaoHideAguardandoPecasChange={setAviacaoHideAguardandoPecas}
            aviacaoSelectedHangarIds={aviacaoSelectedHangarIds}
            onAviacaoSelectedHangarIdsChange={setAviacaoSelectedHangarIds}
            onRegistrarAvaria={() => void registerAviacaoAvaria()}
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

        <main className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden p-2">
          {appView === "agenda" ? (
            <AgendaProView
              rows={rows}
              loading={loading}
              supabase={supabase}
              tenantId={tenantIdForInsert}
              tenantConfig={tenantConfig}
              cadastroCategories={tenantConfig.cadastroCategories}
              cadastroLookups={cadastroLookups}
              onRefresh={() => void refreshRows()}
              onEditRow={(row) => {
                setEditFromAgenda(true);
                setEditRow(row);
              }}
              onDeleteRow={handleDeleteRow}
            />
          ) : (
            <QueueSection
              rows={queueDisplayRows}
              queueTabs={visibleQueueTabs}
              tabCounts={tabCounts}
              queueTabId={queueTabId}
              onQueueTabId={setQueueTabId}
              priorityLawEnabled={tenantConfig.priorityLawEnabled}
              observacoesVisibility={tenantConfig.observacoesVisibility}
              cadastroCategories={tenantConfig.cadastroCategories}
              cadastroLookups={cadastroLookups}
              selectedId={selectedId}
              onSelectId={handleSelectId}
              loading={loading}
              supabase={supabase}
              onRefresh={() => void refreshRows()}
              onRegisterClick={() => setRegistryOpen(true)}
              onOpenFlowSettings={openFlowSettings}
              onEditRow={(row) => {
                setEditFromAgenda(false);
                setEditRow(row);
              }}
              viewMode={queueViewMode}
              onViewModeChange={setQueueViewMode}
              onObservacoesVisibilityChange={setObservacoesVisibility}
              onDeleteRow={handleDeleteRow}
              docasLogisticsActive={docasLogisticsActive}
              docasStepLabel={selectedDocasStepLabel}
              docasCurrentStep={selectedDocasStep}
              docasCanGoPrev={selectedDocasStep ? shiftDocasStep(selectedDocasStep, -1) !== null : false}
              docasCanGoNext={selectedDocasStep ? shiftDocasStep(selectedDocasStep, 1) !== null : false}
              docasStepperDisabled={pending}
              onDocasStepPrev={() => shiftSelectedDocasStep(-1)}
              onDocasStepNext={() => shiftSelectedDocasStep(1)}
              aviacaoLogisticsActive={aviacaoLogisticsActive}
              aviacaoHangarLabel={selectedAviacaoHangarLabel}
              aviacaoCanGoPrev={canShiftAviacaoTab(selectedAviacaoTabId, -1, aviacaoActiveColumns)}
              aviacaoCanGoNext={canShiftAviacaoTab(selectedAviacaoTabId, 1, aviacaoActiveColumns)}
              aviacaoStepperDisabled={pending}
              onAviacaoStepPrev={() => shiftSelectedAviacaoStep(-1)}
              onAviacaoStepNext={() => shiftSelectedAviacaoStep(1)}
            />
          )}
        </main>
      </div>

      <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      <ReportsModal open={reportsOpen} onClose={() => setReportsOpen(false)} proActive={proActive} />

      <FinalizeConfirmModal
        open={finalizeOpen}
        onClose={() => setFinalizeOpen(false)}
        selected={selected}
        pending={pending}
        onConfirmFinalize={() => {
          setFinalizeOpen(false);
          void updateStatus(STATUS_UPDATE.finalizar, { clearSelection: true });
        }}
        onRequestReturnUpgrade={() => {
          setFinalizeOpen(false);
          setProUpgradeTitle("Agendar retorno no Plano PRO");
          setProUpgradeDescription(
            "Registre retornos e acompanhe reagendamentos com histórico completo. O modo vitalício finaliza sem retenção — ative o Plano PRO para agendar retornos."
          );
          setProUpgradeOpen(true);
        }}
      />

      <ProUpgradeModal
        open={proUpgradeOpen}
        onClose={() => setProUpgradeOpen(false)}
        title={proUpgradeTitle}
        description={proUpgradeDescription}
      />

      {quickCrud && (
        <CrudEntityModal
          open
          supabase={supabase}
          title={quickCrud.title}
          table={quickCrud.table}
          tenantId={effectiveTenantId}
          onClose={() => setQuickCrud(null)}
          onSaved={() => void refreshRows()}
        />
      )}

      <SegmentConfigModal
        open={segmentOpen}
        onClose={() => setSegmentOpen(false)}
        supabase={supabase}
        tenantId={effectiveTenantId}
        segmentoDefinido={segmentoDefinido}
        config={tenantConfig}
        onConfigUpdated={(c) => {
          setTenantConfig(c);
          const first = resolveVisibleQueueTabs(c)[0]?.id;
          if (first) setQueueTabId(first);
          void refreshRows();
        }}
      />

      <SettingsHubModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        supabase={supabase}
        tenantId={effectiveTenantId}
        config={tenantConfig}
        initialMainTab={settingsInitialTab}
        onConfigUpdated={(c) => setTenantConfig(c)}
        onDataChanged={() => void refreshRows()}
        onRequestSegmentConfig={() => {
          setSettingsOpen(false);
          setSegmentOpen(true);
        }}
      />

      <RegistryPatientModal
        open={registryOpen}
        onClose={() => setRegistryOpen(false)}
        supabase={supabase}
        tenantId={tenantIdForInsert}
        tenantConfig={tenantConfig}
        onRegistered={(meta) => {
          if (meta?.queueTabId) setQueueTabId(meta.queueTabId);
          void refreshRows();
        }}
      />

      <EditAtendimentoModal
        open={!!editRow}
        row={editRow}
        onClose={() => {
          setEditRow(null);
          setEditFromAgenda(false);
        }}
        supabase={supabase}
        tenantConfig={tenantConfig}
        allowFullDatetime={proActive && editFromAgenda}
        onSaved={() => void refreshRows()}
      />
    </div>
  );
}
