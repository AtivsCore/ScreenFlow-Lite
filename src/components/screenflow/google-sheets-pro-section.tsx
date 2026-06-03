"use client";

import { ProFeatureLock } from "@/components/screenflow/pro-feature-lock";
import { ProUpgradeButton } from "@/components/screenflow/pro-upgrade-button";

type GoogleSheetsProSectionProps = {
  proActive: boolean;
  value: string;
  onChange: (url: string | null) => void;
};

export function GoogleSheetsProSection({ proActive, value, onChange }: GoogleSheetsProSectionProps) {
  const field = (
    <label className="block rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/40">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Sincronização Google Planilhas
      </span>
      <input
        type="url"
        disabled={!proActive}
        value={value}
        onChange={(e) => onChange(e.target.value.trim() || null)}
        placeholder="https://docs.google.com/spreadsheets/…"
        className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
      />
      <p className="mt-1 text-[9px] text-zinc-500">Backup automático e exportação diária (exclusivo Plano PRO).</p>
    </label>
  );

  if (proActive) return field;

  return (
    <div className="space-y-3">
      <ProFeatureLock label="Plano PRO — Google Planilhas">{field}</ProFeatureLock>
      <ProUpgradeButton label="Quero ativar o Plano PRO" />
    </div>
  );
}
