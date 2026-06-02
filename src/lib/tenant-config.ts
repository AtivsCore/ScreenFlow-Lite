import type { QueueTabId } from "@/lib/atendimentos-lite";
import { QUEUE_TAB_LABELS } from "@/lib/atendimentos-lite";

export type QueueTabPreset = QueueTabId;

export type QueueTabEntry = {
  id: string;
  preset: QueueTabPreset;
  label: string;
  /** Rótulo personalizado quando `preset` é `outros`. */
  customTypeLabel?: string;
};

export type DisplayPaletteId = "red-black" | "yellow-black" | "blue-white" | "green-black";

export type RegisterFormConfig = {
  showClienteNome: boolean;
  showProfissional: boolean;
  showServico: boolean;
  showLocal: boolean;
  showHoraMarcada: boolean;
  showObservacao: boolean;
};

export type ObservacoesVisibility = "hidden" | "always";

export type TvDisplayConfig = {
  footerLines: string[];
  colorPalette: DisplayPaletteId;
  /** Data URL (pode ser grande) ou null */
  backgroundImageDataUrl: string | null;
  /** Destino do QR; default é a URL atual do /display */
  qrTargetUrl: string | null;
};

export type TenantConfiguracoes = {
  queueTabs?: QueueTabEntry[];
  priorityLawEnabled?: boolean;
  observacoesVisibility?: ObservacoesVisibility;
  registerForm?: Partial<RegisterFormConfig>;
  tvDisplay?: Partial<TvDisplayConfig>;
};

export type ResolvedTenantConfig = {
  queueTabs: QueueTabEntry[];
  priorityLawEnabled: boolean;
  observacoesVisibility: ObservacoesVisibility;
  registerForm: RegisterFormConfig;
  tvDisplay: TvDisplayConfig;
};

export const DEFAULT_QUEUE_TABS: QueueTabEntry[] = [
  { id: "tab-ordem", preset: "ordem", label: "Ordem de Chegada" },
  { id: "tab-hora", preset: "hora", label: "Hora Marcada" },
  { id: "tab-encaixe", preset: "encaixe", label: "Encaixe" },
  { id: "tab-prioridade", preset: "prioridade", label: "Prioridade" },
  { id: "tab-urgente", preset: "urgente", label: "Urgente" },
];

export const DEFAULT_REGISTER_FORM: RegisterFormConfig = {
  showClienteNome: true,
  showProfissional: true,
  showServico: true,
  showLocal: true,
  showHoraMarcada: true,
  showObservacao: true,
};

export const DEFAULT_TV_DISPLAY: TvDisplayConfig = {
  footerLines: ["Bem-vindo • Aguarde ser chamado"],
  colorPalette: "blue-white",
  backgroundImageDataUrl: null,
  qrTargetUrl: null,
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseQueueTabs(raw: unknown): QueueTabEntry[] | null {
  if (!Array.isArray(raw)) return null;
  const out: QueueTabEntry[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const preset = item.preset as QueueTabPreset;
    const label = typeof item.label === "string" ? item.label.trim() : "";
    const customTypeLabel =
      typeof item.customTypeLabel === "string" ? item.customTypeLabel.trim() : undefined;
    const presets: QueueTabPreset[] = ["ordem", "hora", "encaixe", "prioridade", "urgente", "outros"];
    if (!id || !label || !presets.includes(preset)) continue;
    out.push({
      id,
      preset,
      label,
      ...(preset === "outros" && customTypeLabel ? { customTypeLabel } : {}),
    });
  }
  return out.length ? out : null;
}

/** Rótulo do critério/tipo exibido na configuração da aba. */
export function queueTabTypeLabel(tab: QueueTabEntry): string {
  if (tab.preset === "outros" && tab.customTypeLabel) return tab.customTypeLabel;
  return QUEUE_TAB_LABELS[tab.preset];
}

function parseRegisterForm(raw: unknown): Partial<RegisterFormConfig> | null {
  if (!isRecord(raw)) return null;
  const b = (k: keyof RegisterFormConfig): boolean | undefined =>
    typeof raw[k] === "boolean" ? raw[k] : undefined;
  return {
    showClienteNome: b("showClienteNome"),
    showProfissional: b("showProfissional"),
    showServico: b("showServico"),
    showLocal: b("showLocal"),
    showHoraMarcada: b("showHoraMarcada"),
    showObservacao: b("showObservacao"),
  };
}

function parseTvDisplay(raw: unknown): Partial<TvDisplayConfig> | null {
  if (!isRecord(raw)) return null;
  const palettes: DisplayPaletteId[] = ["red-black", "yellow-black", "blue-white", "green-black"];
  const colorPalette =
    typeof raw.colorPalette === "string" && palettes.includes(raw.colorPalette as DisplayPaletteId)
      ? (raw.colorPalette as DisplayPaletteId)
      : undefined;
  const footerLines = Array.isArray(raw.footerLines)
    ? raw.footerLines.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : undefined;
  const backgroundImageDataUrl =
    raw.backgroundImageDataUrl === null
      ? null
      : typeof raw.backgroundImageDataUrl === "string"
        ? raw.backgroundImageDataUrl
        : undefined;
  const qrTargetUrl =
    raw.qrTargetUrl === null
      ? null
      : typeof raw.qrTargetUrl === "string"
        ? raw.qrTargetUrl.trim() || null
        : undefined;
  return { footerLines, colorPalette, backgroundImageDataUrl, qrTargetUrl };
}

/** Mescla JSON salvo no Supabase com defaults seguros */
export function mergeTenantConfig(raw: unknown): ResolvedTenantConfig {
  const obj = isRecord(raw) ? raw : {};
  let queueTabs = parseQueueTabs(obj.queueTabs) ?? DEFAULT_QUEUE_TABS;
  const priorityLawEnabled =
    typeof obj.priorityLawEnabled === "boolean" ? obj.priorityLawEnabled : true;

  if (!priorityLawEnabled) {
    queueTabs = queueTabs.filter((t) => t.preset !== "prioridade" && t.preset !== "urgente");
    if (queueTabs.length === 0) queueTabs = [{ id: "tab-ordem", preset: "ordem", label: "Ordem de Chegada" }];
  }

  const rf = { ...DEFAULT_REGISTER_FORM, ...parseRegisterForm(obj.registerForm) };
  const tv = { ...DEFAULT_TV_DISPLAY, ...parseTvDisplay(obj.tvDisplay) };
  const observacoesVisibility: ObservacoesVisibility =
    obj.observacoesVisibility === "always" ? "always" : "hidden";

  return {
    queueTabs,
    priorityLawEnabled,
    observacoesVisibility,
    registerForm: rf,
    tvDisplay: tv,
  };
}

export function configuracoesForSupabase(resolved: ResolvedTenantConfig): TenantConfiguracoes {
  return {
    queueTabs: resolved.queueTabs,
    priorityLawEnabled: resolved.priorityLawEnabled,
    observacoesVisibility: resolved.observacoesVisibility,
    registerForm: resolved.registerForm,
    tvDisplay: resolved.tvDisplay,
  };
}
