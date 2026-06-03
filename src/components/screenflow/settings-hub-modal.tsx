"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { QUEUE_TAB_LABELS } from "@/lib/atendimentos-lite";
import {
  cadastroCategoryCrudTable,
  configuracoesForSupabase,
  MAX_CADASTRO_CATEGORIES,
  queueTabTypeLabel,
  restoreDefaultCadastroCategories,
  restoreDefaultQueueTabs,
  syncRegisterFormFromCategories,
  type CadastroCategoryEntry,
  type CadastroTableKey,
  type QueueTabPreset,
  type ResolvedTenantConfig,
} from "@/lib/tenant-config";
import { isProPlan, LIFETIME_STORAGE_NOTICE } from "@/lib/plan-tier";
import { Briefcase, ChevronDown, ChevronUp, ClipboardList, Layers, MapPin, Palette, Settings2, UserCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { CrudEntityModal } from "@/components/screenflow/crud-entity-modal";
import { ProFeatureLock } from "@/components/screenflow/pro-feature-lock";
import { SecuritySettingsPanel } from "@/components/screenflow/security-settings-panel";

type SettingsHubModalProps = {
  open: boolean;
  onClose: () => void;
  supabase: SupabaseClient | null;
  tenantId: string | null;
  config: ResolvedTenantConfig;
  initialMainTab?: MainTab;
  onConfigUpdated: (next: ResolvedTenantConfig) => void;
  onDataChanged?: () => void;
};

type MainTab = "fluxo" | "geral" | "cadastros";

const PRESETS: QueueTabPreset[] = ["ordem", "hora", "encaixe", "prioridade", "urgente", "outros"];

const TABLE_KEY_LABELS: Record<CadastroTableKey, string> = {
  profissionais: "Equipe / profissionais",
  locais: "Locais",
  servicos: "Serviços",
};

const TABLE_KEY_ICONS = {
  profissionais: UserCheck,
  locais: MapPin,
  servicos: Briefcase,
} as const;

export function SettingsHubModal({
  open,
  onClose,
  supabase,
  tenantId,
  config,
  initialMainTab = "fluxo",
  onConfigUpdated,
  onDataChanged,
}: SettingsHubModalProps) {
  const [mainTab, setMainTab] = useState<MainTab>("fluxo");
  const [draft, setDraft] = useState<ResolvedTenantConfig>(config);
  const [crud, setCrud] = useState<null | { title: string; table: string }>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [newTabLabel, setNewTabLabel] = useState("");
  const [newTabPreset, setNewTabPreset] = useState<QueueTabPreset>("ordem");
  const [customTypeName, setCustomTypeName] = useState("");

  useEffect(() => {
    if (open) {
      setDraft(config);
      setSaveErr(null);
      setMainTab(initialMainTab);
    }
  }, [open, config, initialMainTab]);

  function moveQueueTab(index: number, direction: -1 | 1) {
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= draft.queueTabs.length) return;
    updateDraft((d) => {
      const tabs = [...d.queueTabs];
      const tmp = tabs[index]!;
      tabs[index] = tabs[swapIndex]!;
      tabs[swapIndex] = tmp;
      return { ...d, queueTabs: tabs };
    });
  }

  function enforcePriorityLaw(next: ResolvedTenantConfig): ResolvedTenantConfig {
    let tabs = next.queueTabs;
    if (!next.priorityLawEnabled) {
      tabs = tabs.filter((t) => t.preset !== "prioridade" && t.preset !== "urgente");
      if (tabs.length === 0) tabs = [{ id: crypto.randomUUID(), preset: "ordem", label: "Ordem de Chegada" }];
    }
    return { ...next, queueTabs: tabs };
  }

  async function persist(next: ResolvedTenantConfig) {
    setSaving(true);
    setSaveErr(null);
    const payload = configuracoesForSupabase(next);
    if (!tenantId || !supabase) {
      onConfigUpdated(next);
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("tenants").update({ configuracoes: payload }).eq("id", tenantId);
    if (error) {
      setSaveErr(error.message);
      setSaving(false);
      return;
    }
    onConfigUpdated(next);
    onDataChanged?.();
    setSaving(false);
  }

  function updateDraft(mut: (d: ResolvedTenantConfig) => ResolvedTenantConfig) {
    setDraft((d) => enforcePriorityLaw(mut(d)));
  }

  function patchCadastroCategories(mut: (cats: CadastroCategoryEntry[]) => CadastroCategoryEntry[]) {
    updateDraft((d) => {
      const next = mut(d.cadastroCategories);
      const cadastroCategories = next.slice(0, MAX_CADASTRO_CATEGORIES);
      return {
        ...d,
        cadastroCategories,
        registerForm: syncRegisterFormFromCategories(cadastroCategories, d.registerForm),
      };
    });
  }

  function moveCadastroCategory(index: number, direction: -1 | 1) {
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= draft.cadastroCategories.length) return;
    patchCadastroCategories((cats) => {
      const next = [...cats];
      const tmp = next[index]!;
      next[index] = next[swapIndex]!;
      next[swapIndex] = tmp;
      return next;
    });
  }

  const footerText = draft.tvDisplay.footerLines.join("\n");
  const proActive = isProPlan(draft.planTier);

  return (
    <>
      <Modal open={open && !crud} title="Configurações" onClose={onClose} widthClassName="max-w-lg">
        <div className="mb-3 flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
          {(
            [
              ["fluxo", "Fluxo de abas", Layers],
              ["geral", "Geral & TV", Settings2],
              ["cadastros", "Cadastros base", ClipboardList],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMainTab(id)}
              className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[10px] font-semibold transition sm:text-[11px] ${
                mainTab === id
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              <Icon className="size-3.5 shrink-0 opacity-70" strokeWidth={1.75} aria-hidden />
              {label}
            </button>
          ))}
        </div>

        {saveErr && (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
            {saveErr}
          </p>
        )}

        {mainTab === "fluxo" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Edite rótulos, remova vistas ou adicione novas (cada aba usa um tipo de ordenação da fila).
              </p>
              <button
                type="button"
                className="shrink-0 rounded-lg border border-zinc-300 px-2.5 py-1 text-[10px] font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                onClick={() =>
                  updateDraft((d) => ({
                    ...d,
                    queueTabs: restoreDefaultQueueTabs(),
                  }))
                }
              >
                Restaurar Padrão
              </button>
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/60">
              <div>
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">Ativar aba &quot;Todos&quot;</p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  Exibe uma vista com todos os registros ativos, independentemente da aba de preset.
                </p>
              </div>
              <input
                type="checkbox"
                className="size-4 accent-zinc-900 dark:accent-zinc-100"
                checked={draft.showTodosTab}
                onChange={(e) => updateDraft((d) => ({ ...d, showTodosTab: e.target.checked }))}
              />
            </label>

            <ul className="max-h-52 space-y-2 overflow-auto rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
              {draft.queueTabs.map((tab, idx) => (
                <li
                  key={tab.id}
                  className="flex flex-wrap items-center gap-2 rounded-md bg-zinc-50 px-2 py-1.5 dark:bg-zinc-900/60"
                >
                  <span className="font-mono text-[9px] text-zinc-400">{idx + 1}</span>
                  <div className="flex shrink-0 flex-col gap-0.5">
                    <button
                      type="button"
                      title="Subir"
                      disabled={idx === 0}
                      onClick={() => moveQueueTab(idx, -1)}
                      className="rounded border border-zinc-300 p-0.5 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <ChevronUp className="size-3" strokeWidth={2} aria-hidden />
                    </button>
                    <button
                      type="button"
                      title="Descer"
                      disabled={idx === draft.queueTabs.length - 1}
                      onClick={() => moveQueueTab(idx, 1)}
                      className="rounded border border-zinc-300 p-0.5 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <ChevronDown className="size-3" strokeWidth={2} aria-hidden />
                    </button>
                  </div>
                  <input
                    value={tab.label}
                    onChange={(e) =>
                      updateDraft((d) => ({
                        ...d,
                        queueTabs: d.queueTabs.map((t) => (t.id === tab.id ? { ...t, label: e.target.value } : t)),
                      }))
                    }
                    className="min-w-[8rem] flex-1 rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
                  />
                  <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[9px] font-medium uppercase text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {queueTabTypeLabel(tab)}
                  </span>
                  <button
                    type="button"
                    disabled={draft.queueTabs.length <= 1}
                    className="text-[10px] font-medium text-red-600 hover:underline disabled:opacity-30 dark:text-red-400"
                    onClick={() =>
                      updateDraft((d) => ({
                        ...d,
                        queueTabs: d.queueTabs.filter((t) => t.id !== tab.id),
                      }))
                    }
                  >
                    Excluir
                  </button>
                </li>
              ))}
            </ul>

            <div className="rounded-lg border border-dashed border-zinc-300 p-2 dark:border-zinc-600">
              <p className="mb-2 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">Adicionar aba</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                {newTabPreset !== "outros" ? (
                  <label className="block flex-1 text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
                    Nome
                    <input
                      value={newTabLabel}
                      onChange={(e) => setNewTabLabel(e.target.value)}
                      placeholder="Ex.: Retorno"
                      className="mt-0.5 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-[11px] dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
                    />
                  </label>
                ) : null}
                <label className="block w-full text-[10px] font-medium text-zinc-600 dark:text-zinc-400 sm:w-40">
                  Tipo
                  <select
                    value={newTabPreset}
                    onChange={(e) => setNewTabPreset(e.target.value as QueueTabPreset)}
                    className="mt-0.5 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-[11px] dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
                  >
                    {PRESETS.map((p) => (
                      <option key={p} value={p}>
                        {QUEUE_TAB_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </label>
                {newTabPreset === "outros" ? (
                  <label className="block flex-1 text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
                    Nome personalizado do tipo
                    <input
                      value={customTypeName}
                      onChange={(e) => setCustomTypeName(e.target.value)}
                      placeholder="Ex.: VIP, Retornos…"
                      className="mt-0.5 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-[11px] dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
                    />
                  </label>
                ) : null}
                <button
                  type="button"
                  className="rounded-lg bg-zinc-900 px-3 py-2 text-[11px] font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
                  onClick={() => {
                    if (newTabPreset === "outros") {
                      const custom = customTypeName.trim();
                      if (!custom) return;
                      updateDraft((d) => ({
                        ...d,
                        queueTabs: [
                          ...d.queueTabs,
                          {
                            id: crypto.randomUUID(),
                            preset: "outros",
                            label: custom,
                            customTypeLabel: custom,
                          },
                        ],
                      }));
                      setCustomTypeName("");
                      return;
                    }
                    const label = newTabLabel.trim();
                    if (!label) return;
                    if (!draft.priorityLawEnabled && (newTabPreset === "prioridade" || newTabPreset === "urgente")) {
                      return;
                    }
                    updateDraft((d) => ({
                      ...d,
                      queueTabs: [...d.queueTabs, { id: crypto.randomUUID(), preset: newTabPreset, label }],
                    }));
                    setNewTabLabel("");
                  }}
                >
                  Adicionar
                </button>
              </div>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() => void persist(draft)}
              className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {saving ? "Salvando…" : "Salvar fluxo de abas"}
            </button>
          </div>
        )}

        {mainTab === "geral" && (
          <div className="space-y-4">
            <p className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-2.5 py-2 text-[10px] leading-snug text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100">
              {LIFETIME_STORAGE_NOTICE}
            </p>

            <SecuritySettingsPanel supabase={supabase} />

            <ProFeatureLock label="Plano PRO — Google Planilhas">
              <label className="block rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/40">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Sincronização Google Planilhas
                </span>
                <input
                  type="url"
                  disabled={!proActive}
                  value={draft.googleSheetsUrl ?? ""}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      googleSheetsUrl: e.target.value.trim() || null,
                    }))
                  }
                  placeholder="https://docs.google.com/spreadsheets/…"
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
                />
                <p className="mt-1 text-[9px] text-zinc-500">
                  Backup automático e exportação diária (exclusivo Plano PRO).
                </p>
              </label>
            </ProFeatureLock>

            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/60">
              <div>
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">Ativar lei de prioridade</p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  Inativo: remove prioridade da fila, do registro e oculta abas relacionadas.
                </p>
              </div>
              <input
                type="checkbox"
                className="size-4 accent-zinc-900 dark:accent-zinc-100"
                checked={draft.priorityLawEnabled}
                onChange={(e) =>
                  updateDraft((d) => ({
                    ...d,
                    priorityLawEnabled: e.target.checked,
                  }))
                }
              />
            </label>

            <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/40">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Observações na fila
              </p>
              <div className="space-y-1.5 text-[10px] text-zinc-700 dark:text-zinc-300">
                <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <input
                    type="radio"
                    name="obs-vis"
                    className="accent-zinc-900 dark:accent-zinc-100"
                    checked={draft.observacoesVisibility === "hidden"}
                    onChange={() => updateDraft((d) => ({ ...d, observacoesVisibility: "hidden" }))}
                  />
                  <span>Ocultar informações (padrão) — ícone de olho na fila</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <input
                    type="radio"
                    name="obs-vis"
                    className="accent-zinc-900 dark:accent-zinc-100"
                    checked={draft.observacoesVisibility === "always"}
                    onChange={() => updateDraft((d) => ({ ...d, observacoesVisibility: "always" }))}
                  />
                  <span>Deixar observações sempre visíveis na linha</span>
                </label>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/40">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Registro inteligente (campos visíveis)
              </p>
              <div className="grid gap-1.5 text-[10px] text-zinc-700 dark:text-zinc-300">
                {(
                  [
                    ["showClienteNome", "Nome do cliente"],
                    ["showProfissional", "Profissional (lista)"],
                    ["showServico", "Serviço (lista)"],
                    ["showLocal", "Local (lista)"],
                    ["showHoraMarcada", "Horário marcado"],
                    ["showObservacao", "Observações"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex cursor-pointer items-center justify-between gap-2 rounded px-1 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                    <span>{label}</span>
                    <input
                      type="checkbox"
                      className="size-3.5 accent-zinc-900 dark:accent-zinc-100"
                      checked={draft.registerForm[key]}
                      onChange={(e) =>
                        updateDraft((d) => ({
                          ...d,
                          registerForm: { ...d.registerForm, [key]: e.target.checked },
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
              <p className="mt-2 text-[9px] text-zinc-500 dark:text-zinc-500">
                Profissional, serviço e local usam apenas listas do cadastro base (sem texto livre).
              </p>
            </div>

            <div className="border-t border-zinc-200 pt-3 dark:border-zinc-700">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                <Palette className="size-4 text-zinc-500" strokeWidth={1.75} aria-hidden />
                Painel público (TV)
              </div>
              <label className="mb-2 block text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
                Frases no rodapé (uma por linha)
                <textarea
                  value={footerText}
                  rows={3}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      tvDisplay: {
                        ...d.tvDisplay,
                        footerLines: e.target.value
                          .split("\n")
                          .map((x) => x.trim())
                          .filter(Boolean),
                      },
                    }))
                  }
                  className="mt-1 w-full resize-none rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-[11px] dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
                />
              </label>

              <label className="mb-2 block text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
                Paleta de alto contraste
                <select
                  value={draft.tvDisplay.colorPalette}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      tvDisplay: {
                        ...d.tvDisplay,
                        colorPalette: e.target.value as ResolvedTenantConfig["tvDisplay"]["colorPalette"],
                      },
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-[11px] dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
                >
                  <option value="red-black">Vermelho / Preto</option>
                  <option value="yellow-black">Amarelo / Preto</option>
                  <option value="blue-white">Azul / Branco</option>
                  <option value="green-black">Verde / Preto</option>
                </select>
              </label>

              <label className="mb-2 block text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
                URL do QR Code (vazio = página atual do painel)
                <input
                  value={draft.tvDisplay.qrTargetUrl ?? ""}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      tvDisplay: {
                        ...d.tvDisplay,
                        qrTargetUrl: e.target.value.trim() || null,
                      },
                    }))
                  }
                  placeholder="https://…"
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-[11px] dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
                />
              </label>

              <label className="block text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
                Imagem de fundo (opacidade baixa na TV)
                <input
                  type="file"
                  accept="image/*"
                  className="mt-1 block w-full text-[11px] text-zinc-600 file:mr-2 file:rounded file:border-0 file:bg-zinc-200 file:px-2 file:py-1 dark:text-zinc-400 dark:file:bg-zinc-800"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) {
                      updateDraft((d) => ({ ...d, tvDisplay: { ...d.tvDisplay, backgroundImageDataUrl: null } }));
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => {
                      const url = typeof reader.result === "string" ? reader.result : null;
                      updateDraft((d) => ({ ...d, tvDisplay: { ...d.tvDisplay, backgroundImageDataUrl: url } }));
                    };
                    reader.readAsDataURL(f);
                  }}
                />
                {draft.tvDisplay.backgroundImageDataUrl ? (
                  <button
                    type="button"
                    className="mt-1 text-[10px] text-red-600 hover:underline dark:text-red-400"
                    onClick={() =>
                      updateDraft((d) => ({ ...d, tvDisplay: { ...d.tvDisplay, backgroundImageDataUrl: null } }))
                    }
                  >
                    Remover imagem
                  </button>
                ) : null}
              </label>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() => void persist(draft)}
              className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {saving ? "Salvando…" : "Salvar geral e TV"}
            </button>
          </div>
        )}

        {mainTab === "cadastros" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Cadastros opcionais para listas na recepção e no registro inteligente. Até{" "}
                {MAX_CADASTRO_CATEGORIES} categorias.
              </p>
              <button
                type="button"
                className="shrink-0 rounded-lg border border-zinc-300 px-2.5 py-1 text-[10px] font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                onClick={() =>
                  patchCadastroCategories(() => restoreDefaultCadastroCategories())
                }
              >
                Restaurar Padrão
              </button>
            </div>

            <ul className="max-h-64 space-y-2 overflow-auto rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
              {draft.cadastroCategories.map((cat, idx) => {
                const Icon = TABLE_KEY_ICONS[cat.tableKey];
                return (
                  <li
                    key={cat.id}
                    className="flex flex-wrap items-center gap-2 rounded-md bg-zinc-50 px-2 py-1.5 dark:bg-zinc-900/60"
                  >
                    <div className="flex shrink-0 flex-col gap-0.5">
                      <button
                        type="button"
                        title="Subir"
                        disabled={idx === 0}
                        onClick={() => moveCadastroCategory(idx, -1)}
                        className="rounded border border-zinc-300 p-0.5 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        <ChevronUp className="size-3" strokeWidth={2} aria-hidden />
                      </button>
                      <button
                        type="button"
                        title="Descer"
                        disabled={idx === draft.cadastroCategories.length - 1}
                        onClick={() => moveCadastroCategory(idx, 1)}
                        className="rounded border border-zinc-300 p-0.5 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        <ChevronDown className="size-3" strokeWidth={2} aria-hidden />
                      </button>
                    </div>
                    <Icon className="size-4 shrink-0 text-zinc-500" strokeWidth={1.75} aria-hidden />
                    <input
                      value={cat.label}
                      onChange={(e) =>
                        patchCadastroCategories((cats) =>
                          cats.map((c) => (c.id === cat.id ? { ...c, label: e.target.value } : c))
                        )
                      }
                      className="min-w-[8rem] flex-1 rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
                    />
                    <select
                      value={cat.tableKey}
                      onChange={(e) =>
                        patchCadastroCategories((cats) =>
                          cats.map((c) =>
                            c.id === cat.id ? { ...c, tableKey: e.target.value as CadastroTableKey } : c
                          )
                        )
                      }
                      className="rounded border border-zinc-200 bg-white px-1.5 py-1 text-[10px] dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
                    >
                      {(Object.keys(TABLE_KEY_LABELS) as CadastroTableKey[]).map((key) => (
                        <option key={key} value={key}>
                          {TABLE_KEY_LABELS[key]}
                        </option>
                      ))}
                    </select>
                    <label className="flex shrink-0 items-center gap-1 text-[10px] text-zinc-600 dark:text-zinc-400">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-zinc-900 dark:accent-zinc-100"
                        checked={cat.enabled}
                        onChange={(e) =>
                          patchCadastroCategories((cats) =>
                            cats.map((c) => (c.id === cat.id ? { ...c, enabled: e.target.checked } : c))
                          )
                        }
                      />
                      Ativo
                    </label>
                    <button
                      type="button"
                      className="shrink-0 text-[10px] font-medium text-zinc-700 hover:underline dark:text-zinc-300"
                      onClick={() =>
                        setCrud({ title: cat.label, table: cadastroCategoryCrudTable(cat) })
                      }
                    >
                      Gerenciar
                    </button>
                    <button
                      type="button"
                      disabled={draft.cadastroCategories.length <= 1}
                      className="shrink-0 text-[10px] font-medium text-red-600 hover:underline disabled:opacity-30 dark:text-red-400"
                      onClick={() =>
                        patchCadastroCategories((cats) => cats.filter((c) => c.id !== cat.id))
                      }
                    >
                      Excluir
                    </button>
                  </li>
                );
              })}
            </ul>

            {draft.cadastroCategories.length < MAX_CADASTRO_CATEGORIES ? (
              <button
                type="button"
                className="w-full rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-[11px] font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900/60"
                onClick={() => {
                  if (draft.cadastroCategories.length >= MAX_CADASTRO_CATEGORIES) return;
                  patchCadastroCategories((cats) => [
                    ...cats,
                    {
                      id: crypto.randomUUID(),
                      label: "Nova categoria",
                      enabled: true,
                      tableKey: "profissionais",
                    },
                  ]);
                }}
              >
                + Adicionar categoria
              </button>
            ) : (
              <p className="text-center text-[10px] text-zinc-500 dark:text-zinc-400">
                Limite de {MAX_CADASTRO_CATEGORIES} categorias atingido.
              </p>
            )}

            <button
              type="button"
              disabled={saving}
              onClick={() => void persist(draft)}
              className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {saving ? "Salvando…" : "Salvar cadastros base"}
            </button>
          </div>
        )}

        {!supabase && (
          <p className="mt-3 text-[10px] text-amber-700 dark:text-amber-300">
            Supabase indisponível: configurações serão aplicadas apenas nesta sessão (não persistidas no banco).
          </p>
        )}
      </Modal>

      {crud && (
        <CrudEntityModal
          open
          supabase={supabase}
          title={crud.title}
          table={crud.table}
          tenantId={tenantId}
          onClose={() => setCrud(null)}
          onSaved={onDataChanged}
        />
      )}
    </>
  );
}
