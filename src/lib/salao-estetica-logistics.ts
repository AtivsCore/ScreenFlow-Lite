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
  rowMatchesQueueTabEntry,
} from "@/lib/fila-preset";
import {
  compareQueueArrivalOrder,
  isActiveQueueRow,
  STATUS_UPDATE,
  type AtendimentoLite,
  type QueueTabId,
} from "@/lib/atendimentos-lite";
import { isProPlan, type PlanTier } from "@/lib/plan-tier";
import { TODOS_QUEUE_TAB, type CadastroCategoryEntry, type QueueTabEntry } from "@/lib/tenant-config";

/** Slug canônico do segmento licenciado (`segmento_definido` / `segmentoAplicado`). */
export const SALAO_ESTETICA_SEGMENT_ID = "salao_estetica" as const;

/** IDs estáveis das colunas de fluxo (marcador `__sf_fila:tab:…__`). */
export const SALAO_QUEUE_TAB = {
  FILA_ESPERA: "fila_espera",
  EM_ATENDIMENTO: "em_atendimento",
  FINALIZADO: "finalizado_caixa",
} as const;

export type SalaoQueueTabId = (typeof SALAO_QUEUE_TAB)[keyof typeof SALAO_QUEUE_TAB];

export const SALAO_PIPELINE_ORDER: readonly SalaoQueueTabId[] = [
  SALAO_QUEUE_TAB.FILA_ESPERA,
  SALAO_QUEUE_TAB.EM_ATENDIMENTO,
  SALAO_QUEUE_TAB.FINALIZADO,
];

export const SALAO_STEP_LABELS: Record<SalaoQueueTabId, string> = {
  [SALAO_QUEUE_TAB.FILA_ESPERA]: "FILA DE ESPERA (GERAL)",
  [SALAO_QUEUE_TAB.EM_ATENDIMENTO]: "EM ATENDIMENTO",
  [SALAO_QUEUE_TAB.FINALIZADO]: "FINALIZADO / CAIXA",
};

/** Colunas físicas legadas — mapeadas para `em_atendimento` na normalização. */
const SALAO_LEGACY_WORK_TAB_IDS = [
  "cadeira_01",
  "cadeira_02",
  "sala_estetica_01",
] as const;

/** Profissional alocado — categoria `sal-c1`. */
export const SALAO_PROFISSIONAL_CATEGORY_ID = "sal-c1" as const;

/** Cadeira / sala de atendimento — categoria `sal-c2`. */
export const SALAO_LOCAL_CATEGORY_ID = "sal-c2" as const;

/** Serviços solicitados (múltiplos) — campo inline `sal-svc` na tag `__sf_salao:`. */
export const SALAO_FIELD_SERVICOS = "sal-svc" as const;

export const SALAO_DATA_TAG_RE = /__sf_salao:[\s\S]*?__/gi;

const SALAO_DATA_PARSE = /__sf_salao:([\s\S]*?)__/i;

const LEGACY_TAB_ALIASES: Record<string, SalaoQueueTabId> = {
  "sal-t1": SALAO_QUEUE_TAB.FILA_ESPERA,
  "sal-t2": SALAO_QUEUE_TAB.EM_ATENDIMENTO,
  "sal-t3": SALAO_QUEUE_TAB.EM_ATENDIMENTO,
  "sal-t4": SALAO_QUEUE_TAB.EM_ATENDIMENTO,
  "sal-t5": SALAO_QUEUE_TAB.FINALIZADO,
  check_in: SALAO_QUEUE_TAB.FILA_ESPERA,
  cadeira_01: SALAO_QUEUE_TAB.EM_ATENDIMENTO,
  cadeira_02: SALAO_QUEUE_TAB.EM_ATENDIMENTO,
  sala_estetica_01: SALAO_QUEUE_TAB.EM_ATENDIMENTO,
};

export type SalaoCadastroFields = Partial<Record<string, string>>;

export type SalaoHeaderPrimaryAction = "chamar" | "iniciar" | "finalizar";

export type SalaoHeaderActionState = {
  chamarLabel: string;
  iniciarLabel: string;
  finalizarLabel: string;
  primaryAction: SalaoHeaderPrimaryAction;
};

export const SALAO_REGISTER_FORM_LABELS = {
  showClienteNome: "Cliente (Nome)",
  showProfissional: "Profissional Alocado",
  showServico: "Serviço Solicitado",
  showLocal: "Cadeira / Sala de Atendimento",
  showHoraMarcada: "Data e horário agendado",
  showObservacao: "Observações",
} as const;

export function isSalaoEsteticaSegment(segmentoAplicado: string | null | undefined): boolean {
  return segmentoAplicado === SALAO_ESTETICA_SEGMENT_ID;
}

export function isSalaoQueueTabId(id: string | null | undefined): id is SalaoQueueTabId {
  return !!id && (SALAO_PIPELINE_ORDER as readonly string[]).includes(id);
}

function isSalaoLegacyWorkTabId(id: string): boolean {
  return (SALAO_LEGACY_WORK_TAB_IDS as readonly string[]).includes(
    id as (typeof SALAO_LEGACY_WORK_TAB_IDS)[number]
  );
}

export function isSalaoCanonicalPipelineTabId(tabId: string | null | undefined): boolean {
  if (!tabId || tabId === TODOS_QUEUE_TAB.id) return false;
  if (isSalaoQueueTabId(tabId)) return true;
  if (isSalaoLegacyWorkTabId(tabId)) return true;
  return Object.prototype.hasOwnProperty.call(LEGACY_TAB_ALIASES, tabId);
}

export function normalizeSalaoTabId(tabId: string | null | undefined): SalaoQueueTabId {
  if (!tabId) return SALAO_QUEUE_TAB.FILA_ESPERA;
  if (isSalaoQueueTabId(tabId)) return tabId;
  return LEGACY_TAB_ALIASES[tabId] ?? SALAO_QUEUE_TAB.FILA_ESPERA;
}

export function salaoQueueTabIdsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (!isSalaoCanonicalPipelineTabId(a) || !isSalaoCanonicalPipelineTabId(b)) return false;
  return normalizeSalaoTabId(a) === normalizeSalaoTabId(b);
}

export function isSalaoQueueTabSelected(queueTabId: string, tabId: string): boolean {
  if (tabId === TODOS_QUEUE_TAB.id || queueTabId === TODOS_QUEUE_TAB.id) {
    return queueTabId === tabId;
  }
  return salaoQueueTabIdsMatch(queueTabId, tabId);
}

export function isSalaoQueueTabIdInVisible(queueTabId: string, visibleTabIds: string[]): boolean {
  if (visibleTabIds.includes(queueTabId)) return true;
  if (queueTabId === TODOS_QUEUE_TAB.id) return false;
  return visibleTabIds.some(
    (id) => id !== TODOS_QUEUE_TAB.id && salaoQueueTabIdsMatch(id, queueTabId)
  );
}

export function resolveSalaoQueueTabClickId(tabId: string): string {
  if (tabId === TODOS_QUEUE_TAB.id) return tabId;
  if (!isSalaoCanonicalPipelineTabId(tabId)) return tabId;
  return normalizeSalaoTabId(tabId);
}

export function buildSalaoCanonicalQueueTabs(): QueueTabEntry[] {
  return SALAO_PIPELINE_ORDER.map((id) => ({
    id,
    preset: "outros" as const,
    label: SALAO_STEP_LABELS[id],
    customTypeLabel: SALAO_STEP_LABELS[id],
  }));
}

export function resolveSalaoQueueTabs(config: {
  queueTabs: QueueTabEntry[];
  showTodosTab?: boolean;
}): QueueTabEntry[] {
  const flowTabs = buildSalaoCanonicalQueueTabs();
  return config.showTodosTab ? [TODOS_QUEUE_TAB, ...flowTabs] : flowTabs;
}

export function getSalaoActiveColumns(
  queueTabs: Pick<QueueTabEntry, "id" | "preset">[]
): Pick<QueueTabEntry, "id" | "preset">[] {
  return queueTabs.filter((t) => t.preset !== "todos");
}

export function findSalaoQueueTabByStep(
  queueTabs: Pick<QueueTabEntry, "id" | "label">[],
  step: SalaoQueueTabId
): Pick<QueueTabEntry, "id" | "label"> | undefined {
  const direct = queueTabs.find((t) => t.id === step);
  if (direct) return direct;
  return queueTabs.find((t) => normalizeSalaoTabId(t.id) === step);
}

export function findSalaoQueueTabById(
  queueTabs: Pick<QueueTabEntry, "id" | "label" | "preset">[],
  tabId: string
): Pick<QueueTabEntry, "id" | "label" | "preset"> | undefined {
  const direct = queueTabs.find((t) => t.id === tabId);
  if (direct) return direct;
  if (!isSalaoCanonicalPipelineTabId(tabId)) return undefined;
  const fallback = findSalaoQueueTabByStep(queueTabs, normalizeSalaoTabId(tabId));
  if (!fallback) return undefined;
  return queueTabs.find((t) => t.id === fallback.id) ?? { ...fallback, preset: "outros" as const };
}

export function getSalaoStepLabel(
  step: string,
  queueTabs?: Pick<QueueTabEntry, "id" | "label">[]
): string {
  const tab = queueTabs ? findSalaoQueueTabByStep(queueTabs, normalizeSalaoTabId(step)) : undefined;
  return tab?.label?.trim() || SALAO_STEP_LABELS[normalizeSalaoTabId(step)];
}

export function resolveSalaoKanbanColumnLabel(tab: Pick<QueueTabEntry, "id" | "label">): string {
  const saved = tab.label?.trim();
  if (saved) return saved.toUpperCase();
  return SALAO_STEP_LABELS[normalizeSalaoTabId(tab.id)];
}

export function resolveSalaoStepFromObservacao(
  observacao: string | null | undefined
): SalaoQueueTabId {
  return normalizeSalaoTabId(parseFilaTabId(observacao));
}

export function parseSalaoCadastroFields(
  observacao: string | null | undefined
): SalaoCadastroFields {
  if (!observacao) return {};
  const inline = SALAO_DATA_PARSE.exec(observacao);
  if (!inline?.[1]) return {};
  try {
    const parsed = JSON.parse(decodeURIComponent(inline[1])) as Record<string, unknown>;
    const out: SalaoCadastroFields = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string" && v.trim()) out[k] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

export function embedSalaoCadastroFields(
  observacao: string | null | undefined,
  fields: SalaoCadastroFields
): string | null {
  const withoutTag = (observacao ?? "").replace(SALAO_DATA_TAG_RE, "").trim();
  const payload: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v?.trim()) payload[k] = v.trim();
  }
  if (Object.keys(payload).length === 0) return withoutTag || null;
  const marker = `__sf_salao:${encodeURIComponent(JSON.stringify(payload))}__`;
  if (!withoutTag) return marker;
  return `${marker}\n${withoutTag}`;
}

export function mergeSalaoObservacao(params: {
  current?: string | null;
  tab?: Pick<QueueTabEntry, "id"> & { preset?: QueueTabEntry["preset"] } | null;
  salaoFields?: SalaoCadastroFields | null;
  preserveTabWhenUnset?: boolean;
  userObservacaoText?: string | null;
}): string | null {
  const current = params.current ?? null;
  const salaoFields =
    params.salaoFields !== undefined && params.salaoFields !== null
      ? params.salaoFields
      : parseSalaoCadastroFields(current);
  const userText =
    params.userObservacaoText !== undefined
      ? (params.userObservacaoText?.trim() || "")
      : (formatObservacaoForDisplay(current) ?? "");

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

  return embedSalaoCadastroFields(withFila, salaoFields);
}

export function buildSalaoRegistryObservacao(
  userObs: string | null,
  filaPreset: QueueTabId,
  tabId: string | undefined,
  salaoFields: SalaoCadastroFields
): string | null {
  const preset: QueueTabId = filaPreset === "todos" ? "ordem" : filaPreset;
  const tab = tabId ? { id: tabId, preset } : null;
  return mergeSalaoObservacao({
    current: userObs || null,
    tab,
    salaoFields,
    preserveTabWhenUnset: false,
  });
}

export function parseSalaoServicosSolicitados(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function serializeSalaoServicosSolicitados(ids: string[]): string {
  return ids.filter(Boolean).join(",");
}

export function buildSalaoSavePayload(
  formValues: Record<string, string>,
  categories: CadastroCategoryEntry[],
  servicosIds: string[]
): {
  cadastroPayload: ReturnType<typeof buildCadastroPayload>;
  salaoFields: SalaoCadastroFields;
} {
  const selectValues: Record<string, string> = {};
  const salaoFields: SalaoCadastroFields = {};

  for (const cat of categories.filter((c) => c.enabled)) {
    const raw = formValues[cat.id]?.trim() ?? "";
    if (!raw) continue;
    if (cat.id === SALAO_LOCAL_CATEGORY_ID || cat.id === SALAO_PROFISSIONAL_CATEGORY_ID) {
      selectValues[cat.id] = raw;
    }
  }

  if (servicosIds.length > 0) {
    salaoFields[SALAO_FIELD_SERVICOS] = serializeSalaoServicosSolicitados(servicosIds);
  } else {
    delete salaoFields[SALAO_FIELD_SERVICOS];
  }

  return {
    cadastroPayload: buildCadastroPayload(selectValues, categories),
    salaoFields,
  };
}

export function buildSalaoCategoryPatch(
  categoryValues: Record<string, string>,
  categories: CadastroCategoryEntry[],
  currentObservacao: string | null,
  servicosIds?: string[]
): ReturnType<typeof buildCadastroPayload> & { observacao: string | null } {
  const selectOnly: Record<string, string> = {};
  for (const cat of categories.filter((c) => c.enabled)) {
    const v = categoryValues[cat.id]?.trim();
    if (!v) continue;
    if (cat.id === SALAO_LOCAL_CATEGORY_ID || cat.id === SALAO_PROFISSIONAL_CATEGORY_ID) {
      selectOnly[cat.id] = v;
    }
  }
  const cadastroPayload = buildCadastroPayload(selectOnly, categories);
  const salaoFields = parseSalaoCadastroFields(currentObservacao);
  if (servicosIds) {
    if (servicosIds.length > 0) {
      salaoFields[SALAO_FIELD_SERVICOS] = serializeSalaoServicosSolicitados(servicosIds);
    } else {
      delete salaoFields[SALAO_FIELD_SERVICOS];
    }
  }
  const observacao = mergeSalaoObservacao({
    current: currentObservacao,
    salaoFields,
    preserveTabWhenUnset: true,
  });
  return { ...cadastroPayload, observacao };
}

const SALAO_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolveSalaoServicoDisplayLabel(id: string, lookups: CadastroLookups): string | null {
  const label = lookups.servicos.get(id)?.trim();
  if (label) return label;
  if (SALAO_UUID_RE.test(id.trim())) return null;
  return id.trim() || null;
}

export function resolveSalaoCategoryDisplay(
  categoryId: string,
  observacao: string | null | undefined,
  valores: CadastroValores,
  lookups: CadastroLookups,
  categories: CadastroCategoryEntry[],
  legacy?: CadastroLegacyContext
): string | null {
  if (categoryId === "sal-c3") {
    const ids = parseSalaoServicosSolicitados(
      parseSalaoCadastroFields(observacao)[SALAO_FIELD_SERVICOS]
    );
    if (ids.length === 0) {
      return resolveCategoryDisplayLabel(
        categoryId,
        valores,
        lookups,
        categories,
        undefined,
        legacy
      );
    }
    const labels = ids
      .map((id) => resolveSalaoServicoDisplayLabel(id, lookups))
      .filter((label): label is string => Boolean(label?.trim()));
    return labels.length > 0 ? labels.join(", ") : null;
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

export function resolveSalaoTabIdFromObservacao(
  observacao: string | null | undefined,
  activeColumns: Pick<QueueTabEntry, "id">[]
): string | null {
  if (activeColumns.length === 0) return null;
  const raw = parseFilaTabId(observacao);
  if (raw) {
    const idx = activeColumns.findIndex((t) => salaoQueueTabIdsMatch(t.id, raw));
    if (idx >= 0) return activeColumns[idx]!.id;
  }
  return activeColumns[0]?.id ?? null;
}

/** Coluna de trabalho genérica — cadeira/sala ficam nos metadados do card. */
export function resolveSalaoTabFromLocalNome(
  _localNome?: string | null,
  _queueTabs?: Pick<QueueTabEntry, "id" | "label">[]
): SalaoQueueTabId {
  return SALAO_QUEUE_TAB.EM_ATENDIMENTO;
}

export function resolveSalaoLocalLabel(
  row: Pick<AtendimentoLite, "observacao" | "cadastro_valores" | "local_id" | "localNome">,
  categories: CadastroCategoryEntry[],
  lookups: CadastroLookups
): string | null {
  const legacy: CadastroLegacyContext = {
    local_id: row.local_id,
    localNome: row.localNome,
  };
  return (
    resolveSalaoCategoryDisplay(
      SALAO_LOCAL_CATEGORY_ID,
      row.observacao,
      row.cadastro_valores ?? {},
      lookups,
      categories,
      legacy
    )?.trim() || null
  );
}

export function resolveSalaoProfissionalLabel(
  row: Pick<
    AtendimentoLite,
    | "observacao"
    | "cadastro_valores"
    | "profissional_id"
    | "profissionalNome"
  >,
  categories: CadastroCategoryEntry[],
  lookups: CadastroLookups
): string | null {
  const legacy: CadastroLegacyContext = {
    profissional_id: row.profissional_id,
    profissionalNome: row.profissionalNome,
  };
  return (
    resolveSalaoCategoryDisplay(
      SALAO_PROFISSIONAL_CATEGORY_ID,
      row.observacao,
      row.cadastro_valores ?? {},
      lookups,
      categories,
      legacy
    )?.trim() || null
  );
}

export function resolveSalaoKanbanMeta(
  row: Pick<
    AtendimentoLite,
    | "nome"
    | "observacao"
    | "cadastro_valores"
    | "profissional_id"
    | "local_id"
    | "especialidade_id"
    | "profissionalNome"
    | "localNome"
    | "servicoNome"
  >,
  categories: CadastroCategoryEntry[],
  lookups: CadastroLookups
): {
  title: string;
  profissional: string | null;
  local: string | null;
  servico: string | null;
  cadeiraLabel: string | null;
} {
  const legacy: CadastroLegacyContext = {
    profissional_id: row.profissional_id,
    local_id: row.local_id,
    especialidade_id: row.especialidade_id,
    profissionalNome: row.profissionalNome,
    localNome: row.localNome,
    servicoNome: row.servicoNome,
  };
  const profissional =
    resolveSalaoCategoryDisplay(
      SALAO_PROFISSIONAL_CATEGORY_ID,
      row.observacao,
      row.cadastro_valores ?? {},
      lookups,
      categories,
      legacy
    ) ?? null;
  const local =
    resolveSalaoCategoryDisplay(
      SALAO_LOCAL_CATEGORY_ID,
      row.observacao,
      row.cadastro_valores ?? {},
      lookups,
      categories,
      legacy
    ) ?? null;
  const servico =
    resolveSalaoCategoryDisplay(
      "sal-c3",
      row.observacao,
      row.cadastro_valores ?? {},
      lookups,
      categories,
      legacy
    ) ?? null;

  return {
    title: row.nome?.trim() || "—",
    profissional,
    local,
    servico,
    cadeiraLabel: local,
  };
}

export function rowMatchesSalaoQueueTabEntry(
  row: {
    observacao: string | null;
    hora_marcada: string | null;
    classificacao_prioridade: string | null;
    prioridade: boolean | null;
  },
  tab: Pick<QueueTabEntry, "id" | "preset">
): boolean {
  if (tab.preset === "todos") return true;
  const rowTabId = parseFilaTabId(row.observacao);
  if (rowTabId) {
    return salaoQueueTabIdsMatch(rowTabId, tab.id);
  }
  if (row.observacao?.includes("__sf_salao:")) {
    return normalizeSalaoTabId(tab.id) === SALAO_QUEUE_TAB.FILA_ESPERA;
  }
  return rowMatchesQueueTabEntry(row, tab);
}

export function filterAndSortSalaoQueue(
  rows: AtendimentoLite[],
  tab: Pick<QueueTabEntry, "id" | "preset">
): AtendimentoLite[] {
  const active =
    tab.preset === "todos"
      ? rows.filter(isActiveQueueRow)
      : rows
          .filter(isActiveQueueRow)
          .filter((r) => rowMatchesSalaoQueueTabEntry(r, tab));
  return [...active].sort(compareQueueArrivalOrder);
}

export function countActiveBySalaoQueueTab(
  rows: AtendimentoLite[],
  tabs: Pick<QueueTabEntry, "id" | "preset">[]
): Record<string, number> {
  const active = rows.filter(isActiveQueueRow);
  const counts: Record<string, number> = {};
  for (const tab of tabs) {
    if (tab.preset === "todos") {
      counts[tab.id] = active.length;
    } else {
      counts[tab.id] = active.filter((r) => rowMatchesSalaoQueueTabEntry(r, tab)).length;
    }
  }
  return counts;
}

function findSalaoActiveColumnIndex(
  tabId: string,
  activeColumns: Pick<QueueTabEntry, "id">[]
): number {
  const direct = activeColumns.findIndex((t) => t.id === tabId);
  if (direct >= 0) return direct;
  if (!isSalaoCanonicalPipelineTabId(tabId)) return -1;
  const normalized = normalizeSalaoTabId(tabId);
  return activeColumns.findIndex((t) => salaoQueueTabIdsMatch(t.id, normalized));
}

export function getSalaoTabIndex(
  tabId: string,
  activeColumns: Pick<QueueTabEntry, "id">[]
): number {
  return findSalaoActiveColumnIndex(tabId, activeColumns);
}

export function shiftSalaoTab(
  tabId: string,
  delta: -1 | 1,
  activeColumns: Pick<QueueTabEntry, "id">[]
): string | null {
  const idx = getSalaoTabIndex(tabId, activeColumns);
  if (idx < 0) return null;
  const next = idx + delta;
  if (next < 0 || next >= activeColumns.length) return null;
  return activeColumns[next]?.id ?? null;
}

export function canShiftSalaoTab(
  tabId: string | null | undefined,
  delta: -1 | 1,
  activeColumns: Pick<QueueTabEntry, "id">[]
): boolean {
  if (!tabId || activeColumns.length === 0) return false;
  return shiftSalaoTab(tabId, delta, activeColumns) !== null;
}

export function salaoStepTvStatus(step: SalaoQueueTabId): string | undefined {
  if (step === SALAO_QUEUE_TAB.FILA_ESPERA) return STATUS_UPDATE.chamar;
  if (step === SALAO_QUEUE_TAB.EM_ATENDIMENTO) return STATUS_UPDATE.rechamar;
  return undefined;
}

/** Rótulo do botão de chamada conforme o posto alocado (cadeira vs sala). */
export function resolveSalaoChamarLabel(localNome: string | null | undefined): string {
  const n = (localNome ?? "").trim().toLowerCase();
  if (n.includes("estética") || n.includes("estetica") || n.includes("sala")) {
    return "Chamar para Sala";
  }
  return "Chamar para Cadeira";
}

export function resolveSalaoHeaderActionState(
  tabId: string | null | undefined,
  localNome?: string | null
): SalaoHeaderActionState {
  const step = normalizeSalaoTabId(tabId);
  const chamarLabel = resolveSalaoChamarLabel(localNome);

  if (step === SALAO_QUEUE_TAB.FINALIZADO) {
    return {
      chamarLabel,
      iniciarLabel: "Iniciar Atendimento",
      finalizarLabel: "Finalizar / Caixa",
      primaryAction: "finalizar",
    };
  }

  if (step === SALAO_QUEUE_TAB.FILA_ESPERA) {
    return {
      chamarLabel,
      iniciarLabel: "Iniciar Atendimento",
      finalizarLabel: "Finalizar / Caixa",
      primaryAction: "chamar",
    };
  }

  return {
    chamarLabel,
    iniciarLabel: "Iniciar Atendimento",
    finalizarLabel: "Finalizar / Caixa",
    primaryAction: "iniciar",
  };
}

/** Plano PRO: desbloqueia a aba consolidada de Agenda futura (não o campo no balcão). */
export function canUseSalaoAgendaFeatures(planTier: PlanTier): boolean {
  return isProPlan(planTier);
}

/** Busca instantânea por nome do cliente (salão/estética). */
export function rowMatchesSalaoQueueSearch(
  row: Pick<AtendimentoLite, "nome" | "observacao" | "cadastro_valores">,
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const nome = row.nome?.trim().toLowerCase() ?? "";
  return nome.includes(q);
}

export function formatSalaoObservacaoForDisplay(
  observacao: string | null | undefined
): string {
  return formatObservacaoForDisplay(observacao);
}
