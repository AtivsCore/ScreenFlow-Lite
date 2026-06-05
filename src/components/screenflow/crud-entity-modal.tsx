"use client";

import {
  filterAviacaoCrudRowsByField,
  nextAviacaoDrawerServicosOrdem,
  resolveAviacaoDrawerKey,
  type AviacaoLookupRow,
} from "@/lib/aviacao-logistics";
import {
  isMissingServicesTableError,
  isServicesTableCandidate,
  SERVICES_CRUD_TABLE,
} from "@/lib/db-tables";
import { formatProfissionalLabel, type ProfissionalRow } from "@/lib/profissionais-display";
import { resolveServicesTableName } from "@/lib/fetch-servicos";
import { resolveDefaultTenantId } from "@/lib/tenant-id";
import { fetchSessionTenantId } from "@/lib/session-tenant";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";

type BaseRow = { id: string; nome: string | null };
type ServicoRow = BaseRow & { ordem?: number | null };

type CrudEntityModalProps = {
  open: boolean;
  onClose: () => void;
  supabase: SupabaseClient | null;
  title: string;
  table: string;
  tenantId?: string | null;
  /** Slot da aviação (ex.: `av-c4`) para isolar gaveta virtual no CRUD. */
  cadastroCategoryId?: string | null;
  onSaved?: () => void;
};

export function CrudEntityModal({
  open,
  onClose,
  supabase,
  title,
  table,
  tenantId,
  cadastroCategoryId,
  onSaved,
}: CrudEntityModalProps) {
  const [sessionTenantId, setSessionTenantId] = useState<string | null>(null);

  const effectiveTenantId = useMemo(
    () => sessionTenantId ?? (tenantId?.trim() || resolveDefaultTenantId()),
    [sessionTenantId, tenantId]
  );

  const isProfissionais = table === "profissionais";
  const isLocais = table === "locais";
  const needsServicesResolve = table === SERVICES_CRUD_TABLE || isServicesTableCandidate(table);
  const needsReorder = needsServicesResolve || isLocais;

  const [effectiveTable, setEffectiveTable] = useState(table);
  const [rows, setRows] = useState<(BaseRow | ServicoRow | ProfissionalRow)[]>([]);
  const [ordemSupported, setOrdemSupported] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [especialidade, setEspecialidade] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEffectiveTable(table);
    setOrdemSupported(true);
    setNome("");
    setEspecialidade("");
  }, [open, table]);

  useEffect(() => {
    if (!open || !supabase) return;
    let cancelled = false;
    void fetchSessionTenantId(supabase).then((tid) => {
      if (!cancelled) setSessionTenantId(tid);
    });
    return () => {
      cancelled = true;
    };
  }, [open, supabase]);

  const ensureTable = useCallback(async (): Promise<string | null> => {
    if (!supabase) return null;
    if (!needsServicesResolve) return table;

    const { table: resolved, error: resolveErr } = await resolveServicesTableName(
      supabase,
      effectiveTenantId
    );
    if (!resolved) {
      setError(resolveErr);
      return null;
    }
    setEffectiveTable(resolved);
    return resolved;
  }, [supabase, needsServicesResolve, table, effectiveTenantId]);

  const load = useCallback(async () => {
    if (!supabase || !open) return;
    setLoading(true);
    setError(null);

    const tbl = needsServicesResolve ? await ensureTable() : table;
    if (!tbl) {
      setRows([]);
      setLoading(false);
      return;
    }

    const selectCols = isProfissionais
      ? "id,nome,especialidade"
      : needsReorder && ordemSupported
        ? "id,nome,ordem"
        : "id,nome";

    let query = supabase.from(tbl).select(selectCols).eq("tenant_id", effectiveTenantId);
    if (needsReorder && ordemSupported) {
      query = query.order("ordem").order("nome");
    } else {
      query = query.order("nome");
    }

    const { data, error: err } = await query;

    if (err && needsReorder && ordemSupported && /ordem/i.test(err.message)) {
      setOrdemSupported(false);
      setLoading(false);
      queueMicrotask(() => {
        void load();
      });
      return;
    }

    if (err) {
      setError(err.message);
      setRows([]);
    } else {
      setEffectiveTable(tbl);
      const raw = ((data as unknown) as (BaseRow | ServicoRow | ProfissionalRow)[] | null) ?? [];
      const scoped = cadastroCategoryId
        ? filterAviacaoCrudRowsByField(cadastroCategoryId, tbl, raw as AviacaoLookupRow[])
        : raw;
      setRows(scoped as (BaseRow | ServicoRow | ProfissionalRow)[]);
    }
    setLoading(false);
  }, [supabase, table, open, effectiveTenantId, needsServicesResolve, needsReorder, ordemSupported, ensureTable, isProfissionais, cadastroCategoryId]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function insertViaApi(
    tbl: string,
    payload: Record<string, unknown>
  ): Promise<{ ok: boolean; message?: string }> {
    if (!supabase) return { ok: false, message: "Supabase indisponível." };
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return { ok: false, message: "Sessão ausente." };

    const res = await fetch("/api/crud-entity", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ table: tbl, tenantId: effectiveTenantId, ...payload }),
    });
    const json = (await res.json()) as { ok?: boolean; message?: string };
    return { ok: !!res.ok && !!json.ok, message: json.message };
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = nome.trim();
    if (!trimmed || !supabase) return;
    setBusy(true);
    setError(null);

    let tbl = needsServicesResolve ? await ensureTable() : effectiveTable;
    if (!tbl) {
      setBusy(false);
      return;
    }

    const payload: Record<string, unknown> = {
      nome: trimmed,
      tenant_id: effectiveTenantId,
    };

    if (isProfissionais) {
      const esp = especialidade.trim();
      if (esp) payload.especialidade = esp;
    }

    if (needsReorder && ordemSupported) {
      const bucketOrdem =
        cadastroCategoryId && resolveAviacaoDrawerKey(cadastroCategoryId)
          ? nextAviacaoDrawerServicosOrdem(cadastroCategoryId, rows as AviacaoLookupRow[])
          : null;
      if (bucketOrdem !== null) {
        payload.ordem = bucketOrdem;
      } else {
        const maxOrdem = rows.reduce((max, r) => {
          const o = "ordem" in r && typeof r.ordem === "number" ? r.ordem : 0;
          return Math.max(max, o);
        }, -1);
        payload.ordem = maxOrdem + 1;
      }
    }

    let { error: err } = await supabase.from(tbl).insert(payload);

    if (err && needsServicesResolve && isMissingServicesTableError(err.message)) {
      const retry = await resolveServicesTableName(supabase, effectiveTenantId);
      if (retry.table && retry.table !== tbl) {
        tbl = retry.table;
        setEffectiveTable(tbl);
        const again = await supabase.from(tbl).insert(payload);
        err = again.error;
      }
    }

    if (err) {
      const isRls = /row-level security/i.test(err.message);
      if (isRls) {
        const viaApi = await insertViaApi(tbl, {
          nome: trimmed,
          ...(isProfissionais && especialidade.trim()
            ? { especialidade: especialidade.trim() }
            : {}),
          ...(needsReorder && ordemSupported ? { ordem: payload.ordem } : {}),
        });
        if (viaApi.ok) {
          setNome("");
          setEspecialidade("");
          onSaved?.();
          await load();
          setBusy(false);
          return;
        }
        setError(viaApi.message ?? err.message);
        setBusy(false);
        return;
      }
      setError(err.message);
    } else {
      setNome("");
      setEspecialidade("");
      onSaved?.();
      await load();
    }
    setBusy(false);
  }

  async function handleDelete(id: string) {
    if (!supabase || !confirm("Excluir este registro?")) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from(effectiveTable).delete().eq("id", id);
    if (err) setError(err.message);
    else {
      onSaved?.();
      await load();
    }
    setBusy(false);
  }

  async function moveRow(index: number, direction: -1 | 1) {
    if (!supabase || !needsReorder || !ordemSupported) return;
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= rows.length) return;

    const current = rows[index] as ServicoRow;
    const neighbor = rows[swapIndex] as ServicoRow;
    if (!current?.id || !neighbor?.id) return;

    setBusy(true);
    setError(null);

    const currentOrdem = typeof current.ordem === "number" ? current.ordem : index;
    const neighborOrdem = typeof neighbor.ordem === "number" ? neighbor.ordem : swapIndex;

    const [u1, u2] = await Promise.all([
      supabase.from(effectiveTable).update({ ordem: neighborOrdem }).eq("id", current.id),
      supabase.from(effectiveTable).update({ ordem: currentOrdem }).eq("id", neighbor.id),
    ]);

    if (u1.error || u2.error) {
      setError(u1.error?.message ?? u2.error?.message ?? "Falha ao reordenar.");
    } else {
      onSaved?.();
      await load();
    }
    setBusy(false);
  }

  function rowLabel(r: BaseRow | ServicoRow | ProfissionalRow): string {
    if (isProfissionais) return formatProfissionalLabel(r as ProfissionalRow);
    return r.nome ?? "—";
  }

  const showDetectedTable =
    needsServicesResolve && effectiveTable !== table && effectiveTable !== SERVICES_CRUD_TABLE;

  return (
    <Modal open={open} title={title} onClose={onClose} widthClassName="max-w-md">
      <form onSubmit={handleAdd} className="mb-4 flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={isProfissionais ? "Nome do profissional" : "Nome"}
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            disabled={busy || !supabase}
          />
          <button
            type="submit"
            disabled={busy || !supabase || !nome.trim()}
            className="shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Adicionar
          </button>
        </div>
        {isProfissionais ? (
          <input
            value={especialidade}
            onChange={(e) => setEspecialidade(e.target.value)}
            placeholder="Especialidade (opcional)"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            disabled={busy || !supabase}
          />
        ) : null}
      </form>
      {showDetectedTable ? (
        <p className="mb-2 text-[10px] text-zinc-500 dark:text-zinc-400">
          Tabela detectada: <code className="font-mono">{effectiveTable}</code>
        </p>
      ) : null}
      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
          {error}
        </p>
      )}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700">
        {loading && <p className="p-4 text-xs text-zinc-500">Carregando…</p>}
        {!loading && rows.length === 0 && (
          <p className="p-4 text-xs text-zinc-500">Nenhum registro encontrado.</p>
        )}
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map((r, index) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-zinc-800 dark:text-zinc-100"
            >
              <span className="min-w-0 flex-1 truncate">{rowLabel(r)}</span>
              <div className="flex shrink-0 items-center gap-1">
                {needsReorder && ordemSupported ? (
                  <>
                    <button
                      type="button"
                      title="Subir"
                      disabled={busy || index === 0}
                      onClick={() => void moveRow(index, -1)}
                      className="rounded border border-zinc-300 p-0.5 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <ChevronUp className="size-3.5" strokeWidth={2} aria-hidden />
                    </button>
                    <button
                      type="button"
                      title="Descer"
                      disabled={busy || index === rows.length - 1}
                      onClick={() => void moveRow(index, 1)}
                      className="rounded border border-zinc-300 p-0.5 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <ChevronDown className="size-3.5" strokeWidth={2} aria-hidden />
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleDelete(r.id)}
                  className="text-red-600 hover:underline dark:text-red-400"
                >
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
