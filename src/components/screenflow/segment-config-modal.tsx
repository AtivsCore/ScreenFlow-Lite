"use client";

import {
  applySegmentPreset,
  isSegmentLicensed,
  normalizeSegmentPresetId,
  SEGMENT_PRESETS,
  type SegmentPresetId,
} from "@/lib/segment-presets";
import { configuracoesForSupabase, type ResolvedTenantConfig } from "@/lib/tenant-config";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Check, Layers } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";

const SHADOW_TOOLTIP =
  "Este segmento não está ativo para a sua licença atual. Contate o suporte Master.";

type SegmentConfigModalProps = {
  open: boolean;
  onClose: () => void;
  supabase: SupabaseClient | null;
  tenantId: string | null;
  segmentoDefinido: string | null;
  config: ResolvedTenantConfig;
  onConfigUpdated: (next: ResolvedTenantConfig) => void;
};

export function SegmentConfigModal({
  open,
  onClose,
  supabase,
  tenantId,
  segmentoDefinido,
  config,
  onConfigUpdated,
}: SegmentConfigModalProps) {
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const licensedId = normalizeSegmentPresetId(segmentoDefinido);
  const appliedId = config.segmentoAplicado ?? licensedId;

  async function applyPreset(presetId: SegmentPresetId) {
    if (!isSegmentLicensed(presetId, segmentoDefinido)) return;
    setSaving(presetId);
    setError(null);
    const patch = applySegmentPreset(presetId);
    const next: ResolvedTenantConfig = {
      ...config,
      queueTabs: patch.queueTabs,
      cadastroCategories: patch.cadastroCategories,
      registerForm: patch.registerForm,
      segmentoAplicado: patch.segmentoAplicado,
    };
    const payload = configuracoesForSupabase(next);
    if (!tenantId || !supabase) {
      onConfigUpdated(next);
      setSaving(null);
      onClose();
      return;
    }
    const { error: err } = await supabase
      .from("tenants")
      .update({ configuracoes: payload })
      .eq("id", tenantId);
    if (err) {
      setError(err.message);
      setSaving(null);
      return;
    }
    onConfigUpdated(next);
    setSaving(null);
    onClose();
  }

  return (
    <Modal open={open} title="Configuração de Segmento" onClose={onClose} widthClassName="max-w-4xl">
      <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
        Escolha um template de ramo de atividade. Cada segmento define automaticamente as abas de fluxo e os
        campos de cadastro da recepção. Licença ativa:{" "}
        <span className="font-semibold text-zinc-800 dark:text-zinc-200">
          {SEGMENT_PRESETS.find((p) => p.id === licensedId)?.name ?? "Clínicas e Consultórios"}
        </span>
        .
      </p>

      {error ? (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
          {error}
        </p>
      ) : null}

      <div className="mb-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
        <table className="w-full min-w-[640px] border-collapse text-left text-[11px]">
          <thead className="bg-zinc-50 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/80 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2">Segmento</th>
              <th className="px-3 py-2">Campos gerados</th>
              <th className="px-3 py-2">Abas de fluxo</th>
              <th className="w-28 px-3 py-2 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {SEGMENT_PRESETS.map((preset) => {
              const licensed = isSegmentLicensed(preset.id, segmentoDefinido);
              const isApplied = appliedId === preset.id;
              return (
                <tr
                  key={preset.id}
                  className={`${licensed ? "" : "opacity-45"} ${isApplied ? "bg-zinc-50/80 dark:bg-zinc-800/40" : ""}`}
                  title={licensed ? undefined : SHADOW_TOOLTIP}
                >
                  <td className="px-3 py-2 align-top font-medium text-zinc-900 dark:text-zinc-100">
                    <span className="mr-1.5">{preset.emoji}</span>
                    {preset.name}
                    {isApplied ? (
                      <span className="ml-2 inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                        <Check className="size-3" strokeWidth={2} aria-hidden />
                        Ativo
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 align-top text-zinc-600 dark:text-zinc-400">{preset.fieldsSummary}</td>
                  <td className="px-3 py-2 align-top text-zinc-600 dark:text-zinc-400">{preset.tabsSummary}</td>
                  <td className="px-3 py-2 align-top text-right">
                    <button
                      type="button"
                      disabled={!licensed || saving !== null}
                      title={licensed ? `Aplicar ${preset.name}` : SHADOW_TOOLTIP}
                      onClick={() => void applyPreset(preset.id)}
                      className="rounded-lg border border-zinc-300 px-2 py-1 text-[10px] font-semibold text-zinc-800 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      {saving === preset.id ? "Aplicando…" : "Aplicar"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50/80 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900/40">
        <Layers className="mt-0.5 size-4 shrink-0 text-zinc-500" strokeWidth={1.75} aria-hidden />
        <p className="text-[10px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          O tema <strong>em branco</strong> está sempre disponível e zera categorias e abas para customização total.
          Segmentos bloqueados (opacidade reduzida) exigem upgrade de licença no painel Master.
        </p>
      </div>
    </Modal>
  );
}
