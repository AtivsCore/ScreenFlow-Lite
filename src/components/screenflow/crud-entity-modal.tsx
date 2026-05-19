"use client";

import {
  isMissingServicesTableError,
  isServicesTableCandidate,
  SERVICES_CRUD_TABLE,
} from "@/lib/db-tables";
import { resolveServicesTableName } from "@/lib/fetch-servicos";
import { resolveDefaultTenantId } from "@/lib/tenant-id";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";

type Row = { id: string; nome: string | null };

type CrudEntityModalProps = {
  open: boolean;
  onClose: () => void;
  supabase: SupabaseClient | null;
  title: string;
  table: string;
  tenantId?: string | null;
  onSaved?: () => void;
};

export function CrudEntityModal({
  open,
  onClose,
  supabase,
  title,
  table,
  tenantId,
  onSaved,
}: CrudEntityModalProps) {
  const effectiveTenantId = useMemo(
    () => tenantId?.trim() || resolveDefaultTenantId(),
    [tenantId]
  );

  const needsServicesResolve = table === SERVICES_CRUD_TABLE || isServicesTableCandidate(table);

  const [effectiveTable, setEffectiveTable] = useState(table);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEffectiveTable(table);
  }, [open, table]);

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

    const { data, error: err } = await supabase
      .from(tbl)
      .select("id,nome")
      .eq("tenant_id", effectiveTenantId)
      .order("nome");

    if (err) {
      setError(err.message);
      setRows([]);
    } else {
      setEffectiveTable(tbl);
      setRows((data as Row[] | null) ?? []);
    }
    setLoading(false);
  }, [supabase, table, open, effectiveTenantId, needsServicesResolve, ensureTable]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

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

    let { error: err } = await supabase.from(tbl).insert({
      nome: trimmed,
      tenant_id: effectiveTenantId,
    });

    if (err && needsServicesResolve && isMissingServicesTableError(err.message)) {
      const retry = await resolveServicesTableName(supabase, effectiveTenantId);
      if (retry.table && retry.table !== tbl) {
        tbl = retry.table;
        setEffectiveTable(tbl);
        const again = await supabase.from(tbl).insert({
          nome: trimmed,
          tenant_id: effectiveTenantId,
        });
        err = again.error;
      }
    }

    if (err) {
      const isRls = /row-level security/i.test(err.message);
      if (isRls) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (token) {
          try {
            const res = await fetch("/api/crud-entity", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                table: tbl,
                nome: trimmed,
                tenantId: effectiveTenantId,
              }),
            });
            const json = (await res.json()) as { ok?: boolean; message?: string };
            if (res.ok && json.ok) {
              setNome("");
              onSaved?.();
              await load();
              setBusy(false);
              return;
            }
            setError(json.message ?? err.message);
            setBusy(false);
            return;
          } catch (proxyErr) {
            const msg = proxyErr instanceof Error ? proxyErr.message : String(proxyErr);
            setError(`${err.message} (fallback API: ${msg})`);
            setBusy(false);
            return;
          }
        }
      }
      setError(err.message);
    } else {
      setNome("");
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

  const showDetectedTable =
    needsServicesResolve && effectiveTable !== table && effectiveTable !== SERVICES_CRUD_TABLE;

  return (
    <Modal open={open} title={title} onClose={onClose} widthClassName="max-w-md">
      <form onSubmit={handleAdd} className="mb-4 flex gap-2">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome"
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
          <p className="p-4 text-xs text-zinc-500">
            Nenhum registro ({effectiveTable}). Se a tabela não existir, rode{" "}
            docs/supabase-lite-create-servicos.sql no Supabase.
          </p>
        )}
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-zinc-800 dark:text-zinc-100"
            >
              <span className="min-w-0 truncate">{r.nome ?? "—"}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleDelete(r.id)}
                className="shrink-0 text-red-600 hover:underline dark:text-red-400"
              >
                Excluir
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
