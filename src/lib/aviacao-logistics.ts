import {
  buildCadastroPayload,
  resolveCategoryDisplayLabel,
  type CadastroLegacyContext,
  type CadastroLookups,
  type CadastroValores,
} from "@/lib/cadastro-valores";
import {
  embedFilaPreset,
  formatObservacaoForDisplay,
  parseFilaTabId,
  parseFilaPreset,
} from "@/lib/fila-preset";
import { STATUS_UPDATE, type QueueTabId } from "@/lib/atendimentos-lite";
import { SERVICES_CRUD_TABLE } from "@/lib/db-tables";
import { formatProfissionalLabel, type ProfissionalRow } from "@/lib/profissionais-display";
import type { CadastroCategoryEntry, QueueTabEntry } from "@/lib/tenant-config";

/** Slug do segmento no Master / `segmentoAplicado` (Aviação e Logística de Manutenção). */
export const AVIACAO_SEGMENT_ID = "aviacao_mro" as const;

export const AVIACAO_HANGAR_UNALLOCATED_LABEL = "NÃO ALOCADO";

/** IDs estáveis das colunas do fluxo híbrido (marcador `__sf_fila:tab:…__`). */
export const AVIACAO_QUEUE_TAB = {
  TRIAGEM: "triagem",
  AGUARDANDO_PECA: "aguardando_peca",
  EM_EXECUCAO: "em_execucao",
  TESTE_VOO: "teste_voo",
  LIBERADO: "liberado",
} as const;

export type AviacaoQueueTabId = (typeof AVIACAO_QUEUE_TAB)[keyof typeof AVIACAO_QUEUE_TAB];

export const AVIACAO_PIPELINE_ORDER: readonly AviacaoQueueTabId[] = [
  AVIACAO_QUEUE_TAB.TRIAGEM,
  AVIACAO_QUEUE_TAB.AGUARDANDO_PECA,
  AVIACAO_QUEUE_TAB.EM_EXECUCAO,
  AVIACAO_QUEUE_TAB.TESTE_VOO,
  AVIACAO_QUEUE_TAB.LIBERADO,
];

export const AVIACAO_STEP_LABELS: Record<AviacaoQueueTabId, string> = {
  [AVIACAO_QUEUE_TAB.TRIAGEM]: "TRIAGEM",
  [AVIACAO_QUEUE_TAB.AGUARDANDO_PECA]: "EM MANUTENÇÃO",
  [AVIACAO_QUEUE_TAB.EM_EXECUCAO]: "EM EXECUÇÃO",
  [AVIACAO_QUEUE_TAB.TESTE_VOO]: "TESTE DE VOO",
  [AVIACAO_QUEUE_TAB.LIBERADO]: "LIBERADO",
};

export const AVIACAO_HANGAR_TAG_WIDTH_CLASS = "w-[10.5rem]";

/** Campos de texto livre persistidos na tag `__sf_aviacao:` (não vão para UUID). */
export const AVIACAO_TEXT_FIELD_IDS = ["av-c1", "av-c3", "av-c4", "av-c5"] as const;

/** Campos híbridos (combobox) no cabeçalho — exclui `av-c5` (texto puro no modal). */
export const AVIACAO_HYBRID_COMBOBOX_FIELD_IDS = ["av-c1", "av-c3", "av-c4"] as const;

/**
 * Gavetas virtuais isoladas por slot de formulário.
 * Categorias 3–5 compartilham a tabela física `servicos`, mas com buckets de `ordem` distintos.
 */
export type AviacaoDrawerKey =
  | "profissionais"
  | "locais"
  | "servicos_prefixo"
  | "categoria_custom_4"
  | "categoria_custom_5";

export const AVIACAO_FIELD_DRAWER_KEY: Record<string, AviacaoDrawerKey> = {
  "av-c1": "profissionais",
  "av-c2": "locais",
  "av-c3": "servicos_prefixo",
  "av-c4": "categoria_custom_4",
  "av-c5": "categoria_custom_5",
};

export const AVIACAO_DRAWER_SERVICOS_BUCKET: Partial<
  Record<AviacaoDrawerKey, { min: number; max: number }>
> = {
  servicos_prefixo: { min: 100_000, max: 199_999 },
  categoria_custom_4: { min: 200_000, max: 299_999 },
  categoria_custom_5: { min: 300_000, max: 399_999 },
};

/** Hangar / box (select UUID em `locais`). */
export const AVIACAO_HANGAR_CATEGORY_ID = "av-c2";

/** Categorias ocultas no painel superior do cliente (aviacao_mro). */
export const AVIACAO_CLIENT_PANEL_HIDDEN_CATEGORY_IDS = ["av-c5"] as const;

/** Rótulos fixos no painel superior (independente de customização salva no tenant). */
export const AVIACAO_CATEGORY_DISPLAY_LABELS: Partial<Record<string, string>> = {
  "av-c1": "Responsável / Mecânico",
};

const AVIACAO_OBSERVACAO_CLINIC_RESIDUAL_RE =
  /\b(?:Medical\s+Dark\s+Mode|Acessibilidade(?:\s+Visual)?|Modo\s+Escuro\s+Médico)\b/gi;

/** Tags técnicas que não devem vazar no card (inclui ids com `_`, ex.: `aguardando_peca`). */
const AVIACAO_FILA_TAG_RE = /__sf_fila:[\s\S]*?__/gi;
const AVIACAO_RAW_TAG_LEAK_RE = /__sf_(?:fila|aviacao|docas):/i;

export const AVIACAO_REQUIRED_CATEGORY_IDS = ["av-c3"] as const;

export const AVIACAO_DATA_TAG_RE = /__sf_aviacao:[\s\S]*?__/gi;

const AVIACAO_DATA_PARSE = /__sf_aviacao:([\s\S]*?)__/i;

const LEGACY_TAB_ALIASES: Record<string, AviacaoQueueTabId> = {
  "av-t1": AVIACAO_QUEUE_TAB.TRIAGEM,
  "av-t2": AVIACAO_QUEUE_TAB.AGUARDANDO_PECA,
  "av-t3": AVIACAO_QUEUE_TAB.EM_EXECUCAO,
  "av-t4": AVIACAO_QUEUE_TAB.TESTE_VOO,
  "av-t5": AVIACAO_QUEUE_TAB.LIBERADO,
};

export function isAviacaoSegment(segmentoAplicado: string | null | undefined): boolean {
  return segmentoAplicado === AVIACAO_SEGMENT_ID;
}

export function isAviacaoTextField(categoryId: string): boolean {
  return (AVIACAO_TEXT_FIELD_IDS as readonly string[]).includes(categoryId);
}

/** Combobox híbrido no cabeçalho (sugestão + texto livre). */
export function isAviacaoHybridComboboxField(categoryId: string): boolean {
  return (AVIACAO_HYBRID_COMBOBOX_FIELD_IDS as readonly string[]).includes(categoryId);
}

/** Urgência da peça: texto livre simples (sem listas) nos modais. */
export function isAviacaoRegistryFreeTextField(categoryId: string): boolean {
  return categoryId === "av-c5";
}

export function resolveAviacaoDrawerKey(fieldId: string): AviacaoDrawerKey | null {
  return AVIACAO_FIELD_DRAWER_KEY[fieldId] ?? null;
}

export function isAviacaoDrawerServicosBacked(drawer: AviacaoDrawerKey): boolean {
  return drawer in AVIACAO_DRAWER_SERVICOS_BUCKET;
}

export function filterServicosForAviacaoDrawer(
  drawer: AviacaoDrawerKey,
  servicos: AviacaoLookupRow[]
): AviacaoLookupRow[] {
  const bucket = AVIACAO_DRAWER_SERVICOS_BUCKET[drawer];
  if (!bucket) {
    return servicos.filter((s) => (s.ordem ?? 0) < 100_000);
  }
  return servicos.filter((s) => {
    const ordem = s.ordem ?? 0;
    return ordem >= bucket.min && ordem <= bucket.max;
  });
}

export function resolveAviacaoCrudTable(fieldId: string): string {
  const drawer = resolveAviacaoDrawerKey(fieldId);
  if (drawer === "profissionais") return "profissionais";
  if (drawer === "locais") return "locais";
  if (drawer && isAviacaoDrawerServicosBacked(drawer)) return SERVICES_CRUD_TABLE;
  return SERVICES_CRUD_TABLE;
}

export function filterAviacaoCrudRowsByField(
  fieldId: string,
  table: string,
  rows: AviacaoLookupRow[]
): AviacaoLookupRow[] {
  const drawer = resolveAviacaoDrawerKey(fieldId);
  if (!drawer) return rows;

  if (table === "profissionais" || table === "profissionais_lite") {
    return drawer === "profissionais" ? rows : [];
  }
  if (table === "locais") {
    return drawer === "locais" ? rows : [];
  }
  if (table.includes("servico") || table === "servicos") {
    if (isAviacaoDrawerServicosBacked(drawer)) {
      return filterServicosForAviacaoDrawer(drawer, rows);
    }
    return drawer === "profissionais" || drawer === "locais" ? [] : rows;
  }
  return rows;
}

export function nextAviacaoDrawerServicosOrdem(
  fieldId: string,
  existingRows: AviacaoLookupRow[]
): number | null {
  const drawer = resolveAviacaoDrawerKey(fieldId);
  if (!drawer || !isAviacaoDrawerServicosBacked(drawer)) return null;
  const bucket = AVIACAO_DRAWER_SERVICOS_BUCKET[drawer];
  if (!bucket) return null;
  const inBucket = existingRows.filter((s) => {
    const ordem = s.ordem ?? 0;
    return ordem >= bucket.min && ordem <= bucket.max;
  });
  const maxOrdem = inBucket.reduce(
    (max, row) => Math.max(max, row.ordem ?? bucket.min - 1),
    bucket.min - 1
  );
  return Math.min(maxOrdem + 1, bucket.max);
}

export function resolveAviacaoCategoryLabel(
  cat: Pick<CadastroCategoryEntry, "id" | "label">
): string {
  return AVIACAO_CATEGORY_DISPLAY_LABELS[cat.id] ?? cat.label;
}

export type AviacaoComboboxOption = { id: string; label: string };

export type AviacaoLookupRow = {
  id: string;
  nome: string | null;
  ordem?: number | null;
  especialidade?: string | null;
};

/** Rótulos canônicos dos campos híbridos — usados para resolver a categoria ativa no tenant. */
const AVIACAO_HYBRID_FIELD_CANONICAL_LABELS: Record<string, readonly string[]> = {
  "av-c1": ["Responsável / Mecânico"],
  "av-c3": ["Prefixo da Aeronave"],
  "av-c4": ["Modelo da Aeronave"],
};

function normalizeCategoryLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Resolve a categoria configurada no tenant para um slot fixo do formulário (ex.: `av-c3`). */
export function findAviacaoCategoryForField(
  fieldId: string,
  categories: CadastroCategoryEntry[]
): CadastroCategoryEntry | undefined {
  const enabled = categories.filter((c) => c.enabled);
  const byId = enabled.find((c) => c.id === fieldId);
  if (byId) return byId;

  const canonical = AVIACAO_HYBRID_FIELD_CANONICAL_LABELS[fieldId];
  if (!canonical) return undefined;

  const targets = new Set(canonical.map(normalizeCategoryLabel));
  return enabled.find((c) => {
    const labels = [c.label, resolveAviacaoCategoryLabel(c)].map(normalizeCategoryLabel);
    return labels.some((l) => targets.has(l));
  });
}

/** Sugestões do combobox pela gaveta virtual isolada do slot (ex.: `av-c4` ≠ `av-c3`). */
export function resolveAviacaoComboboxOptions(
  fieldId: string,
  _categories: CadastroCategoryEntry[],
  lookups: {
    profissionais: AviacaoLookupRow[];
    locais: AviacaoLookupRow[];
    servicos: AviacaoLookupRow[];
  }
): AviacaoComboboxOption[] {
  const drawer = resolveAviacaoDrawerKey(fieldId);
  if (!drawer) return [];

  const toOptions = (
    rows: AviacaoLookupRow[],
    labelFor?: (row: AviacaoLookupRow) => string
  ): AviacaoComboboxOption[] => {
    const seen = new Set<string>();
    const out: AviacaoComboboxOption[] = [];
    for (const row of rows) {
      const label = (labelFor?.(row) ?? row.nome ?? row.id).trim();
      if (!label) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ id: row.id, label });
    }
    return out;
  };

  switch (drawer) {
    case "profissionais":
      return toOptions(lookups.profissionais, (row) =>
        formatProfissionalLabel(row as ProfissionalRow)
      );
    case "locais":
      return toOptions(lookups.locais);
    case "servicos_prefixo":
    case "categoria_custom_4":
      return toOptions(filterServicosForAviacaoDrawer(drawer, lookups.servicos));
    default:
      return [];
  }
}

export function isAviacaoRequiredCategory(categoryId: string): boolean {
  return (AVIACAO_REQUIRED_CATEGORY_IDS as readonly string[]).includes(categoryId);
}

export function isAviacaoQueueTabId(id: string | null | undefined): id is AviacaoQueueTabId {
  return !!id && (AVIACAO_PIPELINE_ORDER as readonly string[]).includes(id);
}

export function normalizeAviacaoTabId(tabId: string | null | undefined): AviacaoQueueTabId {
  if (!tabId) return AVIACAO_QUEUE_TAB.TRIAGEM;
  if (isAviacaoQueueTabId(tabId)) return tabId;
  return LEGACY_TAB_ALIASES[tabId] ?? AVIACAO_QUEUE_TAB.TRIAGEM;
}

export function resolveAviacaoStepFromObservacao(
  observacao: string | null | undefined
): AviacaoQueueTabId {
  return normalizeAviacaoTabId(parseFilaTabId(observacao));
}

export function findAviacaoQueueTabByStep(
  queueTabs: Pick<QueueTabEntry, "id" | "label">[],
  step: AviacaoQueueTabId
): Pick<QueueTabEntry, "id" | "label"> | undefined {
  const direct = queueTabs.find((t) => t.id === step);
  if (direct) return direct;
  return queueTabs.find((t) => normalizeAviacaoTabId(t.id) === step);
}

export function getAviacaoStepIndex(step: AviacaoQueueTabId): number {
  return AVIACAO_PIPELINE_ORDER.indexOf(step);
}

/** Colunas ativas do fluxo Kanban/lista (exclui aba virtual "Todos"). */
export function getAviacaoActiveColumns(
  queueTabs: Pick<QueueTabEntry, "id" | "preset">[]
): Pick<QueueTabEntry, "id" | "preset">[] {
  return queueTabs.filter((t) => t.preset !== "todos");
}

function findAviacaoActiveColumnIndex(
  tabId: string,
  activeColumns: Pick<QueueTabEntry, "id">[]
): number {
  const direct = activeColumns.findIndex((t) => t.id === tabId);
  if (direct >= 0) return direct;
  const normalized = normalizeAviacaoTabId(tabId);
  return activeColumns.findIndex((t) => normalizeAviacaoTabId(t.id) === normalized);
}

/** Índice dinâmico da coluna atual nas abas configuradas (0 … length-1). */
export function getAviacaoTabIndex(
  tabId: string,
  activeColumns: Pick<QueueTabEntry, "id">[]
): number {
  return findAviacaoActiveColumnIndex(tabId, activeColumns);
}

/** Lê a tag de coluna canônica (primeira linha — a mais recente gravada). */
export function parseAviacaoFilaTabId(observacao: string | null | undefined): string | null {
  if (!observacao) return null;
  const leading = observacao.trimStart().match(/^__sf_fila:tab:([a-z0-9_-]+)__/i);
  if (leading?.[1]) return leading[1];
  return parseFilaTabId(observacao);
}

/** Remove metadados técnicos antes de regravar (evita acúmulo de tags). */
export function sanitizeObservacaoForAviacaoSave(
  observacao: string | null | undefined
): string | null {
  if (!observacao) return null;
  const text = observacao
    .replace(AVIACAO_DATA_TAG_RE, "")
    .replace(AVIACAO_FILA_TAG_RE, "")
    .replace(/^[ \t]*\r?\n+/gm, "")
    .replace(/\r?\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}

/** Resolve o id da coluna gravada na observação (ou a primeira coluna ativa). */
export function resolveAviacaoTabIdFromObservacao(
  observacao: string | null | undefined,
  activeColumns: Pick<QueueTabEntry, "id">[]
): string | null {
  if (activeColumns.length === 0) return null;
  const raw = parseAviacaoFilaTabId(observacao);
  if (raw && findAviacaoActiveColumnIndex(raw, activeColumns) >= 0) return raw;
  return activeColumns[0]?.id ?? null;
}

/** Avança/retrocede entre colunas reais configuradas (suporta colunas extras além do preset). */
export function shiftAviacaoTab(
  tabId: string,
  delta: -1 | 1,
  activeColumns: Pick<QueueTabEntry, "id">[]
): string | null {
  const idx = getAviacaoTabIndex(tabId, activeColumns);
  if (idx < 0) return null;
  const next = idx + delta;
  if (next < 0 || next >= activeColumns.length) return null;
  return activeColumns[next]?.id ?? null;
}

export function canShiftAviacaoTab(
  tabId: string | null | undefined,
  delta: -1 | 1,
  activeColumns: Pick<QueueTabEntry, "id">[]
): boolean {
  if (!tabId || activeColumns.length === 0) return false;
  return shiftAviacaoTab(tabId, delta, activeColumns) !== null;
}

/** @deprecated Prefer `shiftAviacaoTab` com `getAviacaoActiveColumns` para colunas dinâmicas. */
export function shiftAviacaoStep(step: AviacaoQueueTabId, delta: -1 | 1): AviacaoQueueTabId | null {
  const idx = getAviacaoStepIndex(step);
  if (idx < 0) return null;
  const next = idx + delta;
  if (next < 0 || next >= AVIACAO_PIPELINE_ORDER.length) return null;
  return AVIACAO_PIPELINE_ORDER[next] ?? null;
}

/** Localiza aba configurada pelo id bruto (preset estável, legado ou coluna customizada). */
export function findAviacaoQueueTabById(
  queueTabs: Pick<QueueTabEntry, "id" | "label" | "preset">[],
  tabId: string
): Pick<QueueTabEntry, "id" | "label" | "preset"> | undefined {
  const direct = queueTabs.find((t) => t.id === tabId);
  if (direct) return direct;
  const fallback = findAviacaoQueueTabByStep(queueTabs, normalizeAviacaoTabId(tabId));
  if (!fallback) return undefined;
  return queueTabs.find((t) => t.id === fallback.id) ?? { ...fallback, preset: "outros" as const };
}

export function getAviacaoStepLabel(
  step: AviacaoQueueTabId,
  queueTabs?: Pick<QueueTabEntry, "id" | "label">[]
): string {
  const tab = queueTabs ? findAviacaoQueueTabByStep(queueTabs, step) : undefined;
  return tab?.label?.toUpperCase() ?? AVIACAO_STEP_LABELS[step];
}

/** Rótulo exibido no cabeçalho da coluna Kanban (força "EM MANUTENÇÃO" na 2ª etapa). */
export function resolveAviacaoKanbanColumnLabel(tab: Pick<QueueTabEntry, "id" | "label">): string {
  if (normalizeAviacaoTabId(tab.id) === AVIACAO_QUEUE_TAB.AGUARDANDO_PECA) {
    return "EM MANUTENÇÃO";
  }
  return tab.label;
}

/** Observação limpa para cards Aviação — sem resíduos de segmentos clínicos. */
export function formatAviacaoObservacaoForDisplay(
  observacao: string | null | undefined
): string {
  const clean = sanitizeObservacaoForAviacaoSave(observacao);
  if (!clean) return "";
  const text = clean
    .replace(AVIACAO_OBSERVACAO_CLINIC_RESIDUAL_RE, "")
    .replace(/[ \t]*\r?\n+/gm, "\n")
    .trim();
  if (!text || AVIACAO_RAW_TAG_LEAK_RE.test(text)) return "";
  return text;
}

/** Status de chamada na TV conforme a etapa (quando aplicável). */
export function aviacaoStepTvStatus(step: AviacaoQueueTabId): string | undefined {
  if (step === AVIACAO_QUEUE_TAB.TRIAGEM) return STATUS_UPDATE.chamar;
  if (step === AVIACAO_QUEUE_TAB.EM_EXECUCAO) return STATUS_UPDATE.rechamar;
  return undefined;
}

export type AviacaoCadastroFields = Partial<Record<string, string>>;

export function parseAviacaoCadastroFields(
  observacao: string | null | undefined
): AviacaoCadastroFields {
  if (!observacao) return {};
  const inline = AVIACAO_DATA_PARSE.exec(observacao);
  if (!inline?.[1]) return {};
  try {
    const parsed = JSON.parse(decodeURIComponent(inline[1])) as Record<string, unknown>;
    const out: AviacaoCadastroFields = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string" && v.trim()) out[k] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

export function embedAviacaoCadastroFields(
  observacao: string | null | undefined,
  fields: AviacaoCadastroFields
): string | null {
  const withoutTag = (observacao ?? "").replace(AVIACAO_DATA_TAG_RE, "").trim();
  const payload: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v?.trim()) payload[k] = v.trim();
  }
  if (Object.keys(payload).length === 0) return withoutTag || null;
  const marker = `__sf_aviacao:${encodeURIComponent(JSON.stringify(payload))}__`;
  if (!withoutTag) return marker;
  return `${marker}\n${withoutTag}`;
}

export function mergeAviacaoObservacao(params: {
  current?: string | null;
  tab?: Pick<QueueTabEntry, "id"> & { preset?: QueueTabEntry["preset"] } | null;
  aviacaoFields?: AviacaoCadastroFields | null;
  preserveTabWhenUnset?: boolean;
  userObservacaoText?: string | null;
}): string | null {
  const current = params.current ?? null;
  const aviacaoFields =
    params.aviacaoFields !== undefined && params.aviacaoFields !== null
      ? params.aviacaoFields
      : parseAviacaoCadastroFields(current);
  const userText =
    params.userObservacaoText !== undefined
      ? (params.userObservacaoText?.trim() || "")
      : (sanitizeObservacaoForAviacaoSave(current) ?? "");

  let withFila: string | null = userText || null;

  if (params.tab) {
    const rawPreset = params.tab.preset;
    const preset: QueueTabId =
      rawPreset === "todos" || !rawPreset ? "ordem" : (rawPreset as QueueTabId);
    withFila = embedFilaPreset(withFila, preset, params.tab.id);
  } else if (params.preserveTabWhenUnset !== false) {
    const tabId = parseAviacaoFilaTabId(current);
    if (tabId) {
      withFila = embedFilaPreset(withFila, "outros", tabId);
    } else {
      const preset = parseFilaPreset(current);
      if (preset) withFila = embedFilaPreset(withFila, preset);
    }
  }

  return embedAviacaoCadastroFields(withFila, aviacaoFields);
}

export function buildAviacaoRegistryObservacao(
  userObs: string | null,
  filaPreset: QueueTabId,
  tabId: string | undefined,
  aviacaoFields: AviacaoCadastroFields
): string | null {
  const preset: QueueTabId = filaPreset === "todos" ? "ordem" : filaPreset;
  const tab = tabId ? { id: tabId, preset } : null;
  return mergeAviacaoObservacao({
    current: userObs || null,
    tab,
    aviacaoFields,
    preserveTabWhenUnset: false,
  });
}

export function buildAviacaoSavePayload(
  formValues: Record<string, string>,
  categories: CadastroCategoryEntry[]
): {
  cadastroPayload: ReturnType<typeof buildCadastroPayload>;
  aviacaoFields: AviacaoCadastroFields;
} {
  const selectValues: Record<string, string> = {};
  const aviacaoFields: AviacaoCadastroFields = {};

  for (const cat of categories.filter((c) => c.enabled)) {
    const raw = formValues[cat.id]?.trim() ?? "";
    if (!raw) continue;
    if (isAviacaoTextField(cat.id)) {
      aviacaoFields[cat.id] = raw;
    } else {
      selectValues[cat.id] = raw;
    }
  }

  return {
    cadastroPayload: buildCadastroPayload(selectValues, categories),
    aviacaoFields,
  };
}

export function buildAviacaoCategoryPatch(
  categoryValues: Record<string, string>,
  categories: CadastroCategoryEntry[],
  currentObservacao: string | null
): ReturnType<typeof buildCadastroPayload> & { observacao: string | null } {
  const selectOnly: Record<string, string> = {};
  for (const cat of categories.filter((c) => c.enabled)) {
    if (isAviacaoTextField(cat.id)) continue;
    const v = categoryValues[cat.id]?.trim();
    if (v) selectOnly[cat.id] = v;
  }
  const cadastroPayload = buildCadastroPayload(selectOnly, categories);
  const aviacaoFields = parseAviacaoCadastroFields(currentObservacao);
  for (const id of AVIACAO_TEXT_FIELD_IDS) {
    const t = categoryValues[id]?.trim();
    if (t) aviacaoFields[id] = t;
    else delete aviacaoFields[id];
  }
  const observacao = mergeAviacaoObservacao({
    current: currentObservacao,
    aviacaoFields,
    preserveTabWhenUnset: true,
  });
  return { ...cadastroPayload, observacao };
}

export function resolveAviacaoCategoryDisplay(
  categoryId: string,
  observacao: string | null | undefined,
  valores: CadastroValores,
  lookups: CadastroLookups,
  categories: CadastroCategoryEntry[],
  legacy?: CadastroLegacyContext
): string | null {
  if (isAviacaoTextField(categoryId)) {
    return parseAviacaoCadastroFields(observacao)[categoryId] ?? null;
  }
  return resolveCategoryDisplayLabel(
    categoryId,
    valores,
    lookups,
    categories,
    undefined,
    legacy
  );
}

/** Rótulo do hangar/box para a tag central do stepper. */
export function getAviacaoHangarLabel(
  row: {
    observacao: string | null;
    cadastro_valores?: CadastroValores | null;
    local_id?: string | null;
    localNome?: string | null;
  },
  categories: CadastroCategoryEntry[],
  lookups: CadastroLookups
): string {
  const legacyCtx: CadastroLegacyContext = {
    local_id: row.local_id,
    localNome: row.localNome,
  };
  const label =
    resolveAviacaoCategoryDisplay(
      AVIACAO_HANGAR_CATEGORY_ID,
      row.observacao,
      row.cadastro_valores ?? {},
      lookups,
      categories,
      legacyCtx
    )?.trim() || null;
  return label ? label.toUpperCase() : AVIACAO_HANGAR_UNALLOCATED_LABEL;
}

export function resolveAviacaoKanbanMeta(
  row: {
    observacao: string | null;
    nome: string | null;
    cadastro_valores?: CadastroValores | null;
    profissional_id?: string | null;
    local_id?: string | null;
    especialidade_id?: string | null;
    profissionalNome?: string | null;
    localNome?: string | null;
    servicoNome?: string | null;
  },
  categories: CadastroCategoryEntry[],
  lookups: CadastroLookups
): {
  title: string;
  profissional: string | null;
  local: string | null;
  servico: string | null;
  hangarLabel: string | null;
} {
  const legacyCtx: CadastroLegacyContext = {
    profissional_id: row.profissional_id,
    local_id: row.local_id,
    especialidade_id: row.especialidade_id,
    profissionalNome: row.profissionalNome,
    localNome: row.localNome,
    servicoNome: row.servicoNome,
  };
  const prefixo =
    resolveAviacaoCategoryDisplay("av-c3", row.observacao, row.cadastro_valores ?? {}, lookups, categories, legacyCtx) ??
    null;
  const pilotoCliente = row.nome?.trim() || null;
  const modelo =
    resolveAviacaoCategoryDisplay("av-c4", row.observacao, row.cadastro_valores ?? {}, lookups, categories, legacyCtx) ??
    null;
  const hangar =
    resolveAviacaoCategoryDisplay(
      AVIACAO_HANGAR_CATEGORY_ID,
      row.observacao,
      row.cadastro_valores ?? {},
      lookups,
      categories,
      legacyCtx
    ) ?? null;

  return {
    title: prefixo ?? row.nome?.trim() ?? "—",
    profissional: pilotoCliente,
    local: null,
    servico: modelo,
    hangarLabel: hangar,
  };
}
