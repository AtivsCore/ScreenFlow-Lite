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

/** Campos de texto livre (não vão para UUID). */
export const AVIACAO_TEXT_FIELD_IDS = ["av-c1", "av-c3", "av-c4"] as const;

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

/** Resolve o id da coluna gravada na observação (ou a primeira coluna ativa). */
export function resolveAviacaoTabIdFromObservacao(
  observacao: string | null | undefined,
  activeColumns: Pick<QueueTabEntry, "id">[]
): string | null {
  if (activeColumns.length === 0) return null;
  const raw = parseFilaTabId(observacao);
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
  if (!observacao) return "";
  const stripped = observacao.replace(AVIACAO_DATA_TAG_RE, "").replace(AVIACAO_FILA_TAG_RE, "");
  const clean = formatObservacaoForDisplay(stripped)
    .replace(AVIACAO_OBSERVACAO_CLINIC_RESIDUAL_RE, "")
    .replace(/[ \t]*\r?\n+/gm, "\n")
    .trim();
  if (!clean || AVIACAO_RAW_TAG_LEAK_RE.test(clean)) return "";
  return clean;
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
      : formatObservacaoForDisplay(current);

  let withFila: string | null = userText || null;

  if (params.tab) {
    const rawPreset = params.tab.preset;
    const preset: QueueTabId =
      rawPreset === "todos" || !rawPreset ? "ordem" : (rawPreset as QueueTabId);
    withFila = embedFilaPreset(withFila, preset, params.tab.id);
  } else if (params.preserveTabWhenUnset !== false) {
    const tabId = parseFilaTabId(current);
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
