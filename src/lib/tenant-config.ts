import type { QueueTabId } from "@/lib/atendimentos-lite";
import { QUEUE_TAB_LABELS } from "@/lib/atendimentos-lite";
import { SERVICES_CRUD_TABLE } from "@/lib/db-tables";

export const TODOS_TAB_ID = "tab-todos";
export const MAX_CADASTRO_CATEGORIES = 5;

export type CadastroTableKey = "profissionais" | "locais" | "servicos";

export type CadastroCategoryEntry = {
  id: string;
  label: string;
  enabled: boolean;
  tableKey: CadastroTableKey;
};

export const DEFAULT_CADASTRO_CATEGORIES: CadastroCategoryEntry[] = [
  { id: "cat-profissionais", label: "Equipe (profissionais)", enabled: true, tableKey: "profissionais" },
  { id: "cat-locais", label: "Locais / pontos de atendimento", enabled: true, tableKey: "locais" },
  { id: "cat-servicos", label: "Serviços", enabled: true, tableKey: "servicos" },
];

export const TODOS_QUEUE_TAB: QueueTabEntry = {
  id: TODOS_TAB_ID,
  preset: "todos",
  label: "Todos",
};

export function restoreDefaultCadastroCategories(): CadastroCategoryEntry[] {
  return DEFAULT_CADASTRO_CATEGORIES.map((c) => ({ ...c }));
}

export function restoreDefaultQueueTabs(): QueueTabEntry[] {
  return DEFAULT_QUEUE_TABS.map((t) => ({ ...t }));
}

export function cadastroCategoryCrudTable(cat: CadastroCategoryEntry): string {
  return cat.tableKey === "servicos" ? SERVICES_CRUD_TABLE : cat.tableKey;
}

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
  showTodosTab?: boolean;
  priorityLawEnabled?: boolean;
  observacoesVisibility?: ObservacoesVisibility;
  cadastroCategories?: CadastroCategoryEntry[];
  registerForm?: Partial<RegisterFormConfig>;
  tvDisplay?: Partial<TvDisplayConfig>;
};

export type ResolvedTenantConfig = {
  queueTabs: QueueTabEntry[];
  showTodosTab: boolean;
  priorityLawEnabled: boolean;
  observacoesVisibility: ObservacoesVisibility;
  cadastroCategories: CadastroCategoryEntry[];
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
    const presets: QueueTabPreset[] = [
      "todos",
      "ordem",
      "hora",
      "encaixe",
      "prioridade",
      "urgente",
      "outros",
    ];
    if (!id || !label || !presets.includes(preset)) continue;
    if (preset === "todos") continue;
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

function parseCadastroCategories(raw: unknown): CadastroCategoryEntry[] | null {
  if (!Array.isArray(raw)) return null;
  const keys: CadastroTableKey[] = ["profissionais", "locais", "servicos"];
  const out: CadastroCategoryEntry[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const label = typeof item.label === "string" ? item.label.trim() : "";
    const tableKey = item.tableKey as CadastroTableKey;
    const enabled = typeof item.enabled === "boolean" ? item.enabled : true;
    if (!id || !label || !keys.includes(tableKey)) continue;
    out.push({ id, label, enabled, tableKey });
  }
  return out.length ? out.slice(0, MAX_CADASTRO_CATEGORIES) : null;
}

export function syncRegisterFormFromCategories(
  categories: CadastroCategoryEntry[],
  rf: RegisterFormConfig
): RegisterFormConfig {
  const on = (key: CadastroTableKey) => categories.some((c) => c.enabled && c.tableKey === key);
  return {
    ...rf,
    showProfissional: on("profissionais"),
    showLocal: on("locais"),
    showServico: on("servicos"),
  };
}

/** Abas visíveis na fila (inclui "Todos" virtual quando ativo). */
export function resolveVisibleQueueTabs(config: ResolvedTenantConfig): QueueTabEntry[] {
  const base = config.queueTabs.filter((t) => t.preset !== "todos");
  return config.showTodosTab ? [TODOS_QUEUE_TAB, ...base] : base;
}

/** Mescla JSON salvo no Supabase com defaults seguros */
export function mergeTenantConfig(raw: unknown): ResolvedTenantConfig {
  const obj = isRecord(raw) ? raw : {};
  let queueTabs = parseQueueTabs(obj.queueTabs) ?? DEFAULT_QUEUE_TABS;
  queueTabs = queueTabs.filter((t) => t.preset !== "todos");
  const showTodosTab = typeof obj.showTodosTab === "boolean" ? obj.showTodosTab : true;
  const priorityLawEnabled =
    typeof obj.priorityLawEnabled === "boolean" ? obj.priorityLawEnabled : true;

  if (!priorityLawEnabled) {
    queueTabs = queueTabs.filter((t) => t.preset !== "prioridade" && t.preset !== "urgente");
    if (queueTabs.length === 0) queueTabs = [{ id: "tab-ordem", preset: "ordem", label: "Ordem de Chegada" }];
  }

  const cadastroCategories = parseCadastroCategories(obj.cadastroCategories) ?? DEFAULT_CADASTRO_CATEGORIES;
  const rfBase = { ...DEFAULT_REGISTER_FORM, ...parseRegisterForm(obj.registerForm) };
  const rf = syncRegisterFormFromCategories(cadastroCategories, rfBase);
  const tv = { ...DEFAULT_TV_DISPLAY, ...parseTvDisplay(obj.tvDisplay) };
  const observacoesVisibility: ObservacoesVisibility =
    obj.observacoesVisibility === "always" ? "always" : "hidden";

  return {
    queueTabs,
    showTodosTab,
    priorityLawEnabled,
    observacoesVisibility,
    cadastroCategories,
    registerForm: rf,
    tvDisplay: tv,
  };
}

export function configuracoesForSupabase(resolved: ResolvedTenantConfig): TenantConfiguracoes {
  return {
    queueTabs: resolved.queueTabs,
    showTodosTab: resolved.showTodosTab,
    priorityLawEnabled: resolved.priorityLawEnabled,
    observacoesVisibility: resolved.observacoesVisibility,
    cadastroCategories: resolved.cadastroCategories,
    registerForm: resolved.registerForm,
    tvDisplay: resolved.tvDisplay,
  };
}
