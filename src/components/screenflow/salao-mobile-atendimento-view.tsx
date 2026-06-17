"use client";

import type { AtendimentoLite, AtendimentoLiteNested } from "@/lib/atendimentos-lite";
import { formatHoraMarcada, mapAtendimentosNestedToFlat } from "@/lib/atendimentos-lite";
import { buildServicoLookup } from "@/lib/atendimentos-rest";
import { buildCadastroLookups, type CadastroLookups } from "@/lib/cadastro-valores";
import {
  mergeTenantConfig,
  restoreDefaultCadastroCategories,
  type CadastroCategoryEntry,
  type ResolvedTenantConfig,
} from "@/lib/tenant-config";
import { resolvePublicTenantId } from "@/lib/tenant-id";
import {
  buildSalaoChamarParaCadeiraPatch,
  buildSalaoDefaultQueueTabs,
  buildSalaoMoveToAguardandoPagamentoObservacao,
  calculateSalaoTotal,
  filterSalaoMobileProfissionalDayRows,
  formatSalaoCurrency,
  isSalaoEsteticaSegment,
  normalizeSalaoStatusLabel,
  resolveSalaoChamarLabel,
  resolveSalaoKanbanMeta,
  resolveSalaoServicoIdsFromRow,
} from "@/lib/salao-estetica-logistics";
import { useMergedSupabaseClient } from "@/hooks/use-merged-supabase-client";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

const PROF_STORAGE_PREFIX = "sf-salao-mobile-prof";

function profStorageKey(tenantId: string): string {
  return `${PROF_STORAGE_PREFIX}-${tenantId}`;
}

function readStoredProfissionalId(tenantId: string): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(profStorageKey(tenantId))?.trim() ?? "";
  } catch {
    return "";
  }
}

function writeStoredProfissionalId(tenantId: string, profissionalId: string): void {
  if (typeof window === "undefined") return;
  try {
    if (profissionalId) localStorage.setItem(profStorageKey(tenantId), profissionalId);
    else localStorage.removeItem(profStorageKey(tenantId));
  } catch {
    /* quota */
  }
}

export function SalaoMobileAtendimentoView() {
  const searchParams = useSearchParams();
  const tenantId = useMemo(
    () => resolvePublicTenantId(searchParams.get("tenantId") ?? searchParams.get("tenant_id")),
    [searchParams]
  );

  const { supabase } = useMergedSupabaseClient();

  const [config, setConfig] = useState<ResolvedTenantConfig>(() => mergeTenantConfig({}));
  const [rows, setRows] = useState<AtendimentoLite[]>([]);
  const [cadastroLookups, setCadastroLookups] = useState<CadastroLookups>({
    profissionais: new Map(),
    locais: new Map(),
    servicos: new Map(),
    servicosValor: new Map(),
  });
  const [profissionalId, setProfissionalId] = useState("");
  const [selectedRow, setSelectedRow] = useState<AtendimentoLite | null>(null);
  const [drawerLocalId, setDrawerLocalId] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [calling, setCalling] = useState(false);
  const [sendingToCaixa, setSendingToCaixa] = useState(false);
  const [callFeedback, setCallFeedback] = useState<string | null>(null);

  const cadastroCategoriesRef = useRef<CadastroCategoryEntry[]>(restoreDefaultCadastroCategories());
  const initialLoadDoneRef = useRef(false);

  const salaoActive = isSalaoEsteticaSegment(config.segmentoAplicado);
  const cadastroCategories = useMemo(
    () => config.cadastroCategories ?? restoreDefaultCadastroCategories(),
    [config.cadastroCategories]
  );
  const queueTabs = useMemo(
    () => (config.queueTabs.length > 0 ? config.queueTabs : buildSalaoDefaultQueueTabs()),
    [config.queueTabs]
  );

  useEffect(() => {
    cadastroCategoriesRef.current = cadastroCategories;
  }, [cadastroCategories]);

  const profissionaisOptions = useMemo(() => {
    return [...cadastroLookups.profissionais.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [cadastroLookups.profissionais]);

  const locaisOptions = useMemo(() => {
    return [...cadastroLookups.locais.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [cadastroLookups.locais]);

  const dayRows = useMemo(() => {
    if (!profissionalId) return [];
    return filterSalaoMobileProfissionalDayRows(rows, profissionalId);
  }, [rows, profissionalId]);

  const fetchMobileAppointments = useCallback(
    async (silent = false) => {
      if (!tenantId) {
        setLoadError("tenantId ausente ou inválido na URL.");
        setRows([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (!silent && !initialLoadDoneRef.current) {
        setLoading(true);
      } else if (silent) {
        setRefreshing(true);
      }

      try {
        const [qRes, cRes, cadRes] = await Promise.all([
          fetch(`/api/atendimentos-queue?tenant_id=${encodeURIComponent(tenantId)}`, {
            cache: "no-store",
          }),
          fetch(`/api/tenant-config?tenant_id=${encodeURIComponent(tenantId)}`, {
            cache: "no-store",
          }),
          fetch(`/api/salao-mobile-cadastros?tenant_id=${encodeURIComponent(tenantId)}`, {
            cache: "no-store",
          }),
        ]);

        const qJson = (await qRes.json()) as {
          ok?: boolean;
          data?: unknown;
          servicos?: { id: string; nome: string | null; valor?: number | null }[];
          message?: string;
        };
        if (!qRes.ok || !qJson.ok || !Array.isArray(qJson.data)) {
          throw new Error(qJson.message || `Fila HTTP ${qRes.status}`);
        }

        const cJson = (await cRes.json()) as { ok?: boolean; config?: unknown; message?: string };
        if (cRes.ok && cJson.ok && cJson.config) {
          setConfig(mergeTenantConfig(cJson.config));
        }

        const nested = qJson.data as AtendimentoLiteNested[];
        const lookup = qJson.servicos ? buildServicoLookup(qJson.servicos) : undefined;
        const flat = mapAtendimentosNestedToFlat(
          nested,
          lookup,
          cadastroCategoriesRef.current
        ).filter((r) => (r.tenant_id ?? "").toLowerCase() === tenantId);
        setRows(flat);

        const cadJson = (await cadRes.json()) as {
          ok?: boolean;
          profissionais?: { id: string; nome: string | null; especialidade?: string | null }[];
          locais?: { id: string; nome: string | null }[];
          servicos?: { id: string; nome: string | null; valor?: number | null }[];
        };

        if (cadRes.ok && cadJson.ok) {
          setCadastroLookups(
            buildCadastroLookups(
              cadJson.profissionais ?? [],
              cadJson.locais ?? [],
              cadJson.servicos ?? qJson.servicos ?? []
            )
          );
        } else if (qJson.servicos) {
          setCadastroLookups(buildCadastroLookups([], [], qJson.servicos));
        }

        setLoadError(null);
        initialLoadDoneRef.current = true;
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : String(e));
        initialLoadDoneRef.current = true;
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [tenantId, profissionalId]
  );

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    const stored = readStoredProfissionalId(tenantId);
    if (stored) setProfissionalId(stored);
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId || !profissionalId) return;
    writeStoredProfissionalId(tenantId, profissionalId);
  }, [tenantId, profissionalId]);

  useEffect(() => {
    if (!tenantId) return;

    void fetchMobileAppointments(false);

    const intervalId = window.setInterval(() => {
      void fetchMobileAppointments(true);
    }, 8000);

    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;

    if (supabase) {
      channel = supabase
        .channel(`salao-mobile-${tenantId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "atendimentos_lite" },
          () => {
            void fetchMobileAppointments(true);
          }
        )
        .subscribe();
    }

    return () => {
      window.clearInterval(intervalId);
      if (channel && supabase) {
        void supabase.removeChannel(channel);
      }
    };
  }, [tenantId, profissionalId, fetchMobileAppointments, supabase]);

  useEffect(() => {
    if (!selectedRow) return;
    setDrawerLocalId(selectedRow.local_id?.trim() ?? "");
    setCallFeedback(null);
  }, [selectedRow]);

  const handleProfissionalChange = (id: string) => {
    setProfissionalId(id);
    setSelectedRow(null);
  };

  const chamarParaCadeira = async () => {
    if (!selectedRow || calling) return;
    setCalling(true);
    setCallFeedback(null);

    const patch = buildSalaoChamarParaCadeiraPatch(selectedRow, rows, queueTabs, {
      localId: drawerLocalId || null,
    });

    try {
      if (supabase) {
        const { error } = await supabase
          .from("atendimentos_lite")
          .update(patch)
          .eq("id", selectedRow.id);
        if (error) throw new Error(error.message);
      } else {
        const r = await fetch("/api/atendimentos-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: selectedRow.id, ...patch }),
        });
        const j = (await r.json()) as { ok?: boolean; message?: string };
        if (!r.ok || !j.ok) throw new Error(j.message || `HTTP ${r.status}`);
      }

      setRows((prev) =>
        prev.map((r) =>
          r.id === selectedRow.id
            ? {
                ...r,
                status: patch.status,
                observacao: patch.observacao,
                local_id: patch.local_id ?? r.local_id,
                localNome: patch.local_id
                  ? cadastroLookups.locais.get(patch.local_id) ?? r.localNome
                  : r.localNome,
              }
            : r
        )
      );
      setCallFeedback("Cliente chamado com sucesso!");
      window.setTimeout(() => {
        setSelectedRow(null);
        setCallFeedback(null);
      }, 1200);
    } catch (e) {
      setCallFeedback(e instanceof Error ? e.message : "Falha ao chamar cliente.");
    } finally {
      setCalling(false);
    }
  };

  const enviarParaCaixa = async () => {
    if (!selectedRow || sendingToCaixa || calling) return;
    setSendingToCaixa(true);
    setCallFeedback(null);

    const observacao = buildSalaoMoveToAguardandoPagamentoObservacao(
      selectedRow.observacao,
      queueTabs
    );
    const patch = { observacao };

    try {
      if (supabase) {
        const { error } = await supabase
          .from("atendimentos_lite")
          .update(patch)
          .eq("id", selectedRow.id);
        if (error) throw new Error(error.message);
      } else {
        const r = await fetch("/api/atendimentos-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: selectedRow.id, ...patch }),
        });
        const j = (await r.json()) as { ok?: boolean; message?: string };
        if (!r.ok || !j.ok) throw new Error(j.message || `HTTP ${r.status}`);
      }

      setRows((prev) =>
        prev.map((r) => (r.id === selectedRow.id ? { ...r, observacao } : r))
      );
      setCallFeedback("Cliente enviado para o caixa!");
      window.setTimeout(() => {
        setSelectedRow(null);
        setCallFeedback(null);
      }, 1200);
    } catch (e) {
      setCallFeedback(e instanceof Error ? e.message : "Falha ao enviar para o caixa.");
    } finally {
      setSendingToCaixa(false);
    }
  };

  const drawerMeta = selectedRow
    ? resolveSalaoKanbanMeta(selectedRow, cadastroCategories, cadastroLookups)
    : null;

  const drawerPricing = selectedRow
    ? calculateSalaoTotal(resolveSalaoServicoIdsFromRow(selectedRow), cadastroLookups)
    : null;

  const chamarLabel = resolveSalaoChamarLabel(
    drawerLocalId ? cadastroLookups.locais.get(drawerLocalId) : drawerMeta?.local
  );

  if (!tenantId) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-950 p-6 text-center text-sm text-zinc-300">
        URL inválida. Use{" "}
        <span className="font-mono text-xs">/atendimento/mobile?tenantId=&lt;uuid&gt;</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-zinc-950 text-zinc-50">
      <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-sm font-semibold tracking-tight">Minha Fila</h1>
            <p className="text-[10px] text-zinc-500">Controle remoto — ScreenFlow Lite</p>
          </div>
          <button
            type="button"
            aria-label="Atualizar lista"
            disabled={refreshing}
            onClick={() => void fetchMobileAppointments(true)}
            className="flex size-9 items-center justify-center rounded-full border border-zinc-700 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100 disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={2} />
            ) : (
              <RefreshCw className="size-4" strokeWidth={2} />
            )}
          </button>
        </div>

        <label className="mt-3 block">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Profissional
          </span>
          <select
            value={profissionalId}
            onChange={(e) => handleProfissionalChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-50 outline-none focus:border-emerald-600"
          >
            <option value="">Selecione…</option>
            {profissionaisOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-3 pb-28">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-zinc-500">
            <Loader2 className="size-6 animate-spin" strokeWidth={2} />
            <p className="text-xs">Carregando atendimentos…</p>
          </div>
        ) : loadError ? (
          <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-4 text-xs text-red-300">
            {loadError}
          </p>
        ) : !salaoActive ? (
          <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-4 text-xs text-amber-200">
            Este tenant não está configurado para o preset Salão / Estética.
          </p>
        ) : !profissionalId ? (
          <p className="py-12 text-center text-xs text-zinc-500">
            Selecione seu nome acima para ver a fila do dia.
          </p>
        ) : dayRows.length === 0 ? (
          <p className="py-12 text-center text-xs text-zinc-500">
            Nenhum atendimento agendado para hoje.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {dayRows.map((row) => {
              const meta = resolveSalaoKanbanMeta(row, cadastroCategories, cadastroLookups);
              const statusLabel = normalizeSalaoStatusLabel(row.status);
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedRow(row)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-3 text-left transition active:scale-[0.99] active:bg-zinc-800"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-base font-semibold text-emerald-400">
                        {formatHoraMarcada(row.hora_marcada)}
                      </span>
                      <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-zinc-400">
                        {statusLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold leading-snug text-zinc-50">
                      {meta.title}
                    </p>
                    {meta.servico ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-400">
                        {meta.servico}
                      </p>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {selectedRow && drawerMeta ? (
        <>
          <button
            type="button"
            aria-label="Fechar detalhes"
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setSelectedRow(null)}
          />
          <div
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-zinc-700 bg-zinc-900 px-4 pt-4 shadow-2xl"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-700" />

            <p className="font-mono text-lg font-semibold text-emerald-400">
              {formatHoraMarcada(selectedRow.hora_marcada)}
            </p>
            <h2 className="mt-1 text-lg font-bold leading-tight text-zinc-50">{drawerMeta.title}</h2>

            <div className="mt-4 space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Serviços</p>
              {drawerPricing && drawerPricing.items.length > 0 ? (
                <ul className="space-y-1.5">
                  {drawerPricing.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 text-sm text-zinc-300"
                    >
                      <span className="min-w-0 truncate">{item.nome}</span>
                      <span className="shrink-0 font-mono text-xs text-zinc-400">
                        {item.valor !== null ? formatSalaoCurrency(item.valor) : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500">{drawerMeta.servico ?? "—"}</p>
              )}
              {drawerPricing?.total !== null && drawerPricing?.total !== undefined ? (
                <p className="border-t border-zinc-800 pt-2 text-right text-sm font-semibold text-emerald-400">
                  Total: {formatSalaoCurrency(drawerPricing.total)}
                </p>
              ) : null}
            </div>

            <label className="mt-4 block">
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Cadeira / Sala
              </span>
              <select
                value={drawerLocalId}
                onChange={(e) => setDrawerLocalId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-50 outline-none focus:border-emerald-600"
              >
                <option value="">—</option>
                {locaisOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>

            {callFeedback ? (
              <p
                className={`mt-3 text-center text-xs ${
                  callFeedback.includes("sucesso") || callFeedback.includes("caixa")
                    ? "text-emerald-400"
                    : "text-red-400"
                }`}
              >
                {callFeedback}
              </p>
            ) : null}

            <button
              type="button"
              disabled={sendingToCaixa || calling}
              onClick={() => void enviarParaCaixa()}
              className="mt-4 w-full rounded-xl border border-amber-500/60 bg-amber-950/40 py-3 text-sm font-bold text-amber-100 shadow-sm transition hover:bg-amber-950/70 active:bg-amber-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sendingToCaixa ? "Enviando…" : "Enviar para o Caixa"}
            </button>

            <button
              type="button"
              disabled={calling || sendingToCaixa}
              onClick={() => void chamarParaCadeira()}
              className="mt-2 w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-emerald-500 active:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {calling ? "Chamando…" : chamarLabel}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
