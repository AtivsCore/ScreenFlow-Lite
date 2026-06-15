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
  resolveRowQueueTabId,
  rowMatchesQueueTabEntry,
} from "@/lib/fila-preset";
import {
  compareQueueArrivalOrder,
  horaComparable,
  isActiveQueueRow,
  timeMs,
  type AtendimentoLite,
  type QueueTabId,
} from "@/lib/atendimentos-lite";
import { isTodayHoraMarcada, isTodayOrFutureHoraMarcada } from "@/lib/hora-marcada";
import { isProPlan, type PlanTier } from "@/lib/plan-tier";
import { TODOS_QUEUE_TAB, type CadastroCategoryEntry, type QueueTabEntry } from "@/lib/tenant-config";

/** Slug canônico do segmento licenciado (`segmento_definido` / `segmentoAplicado`). */
export const SALAO_ESTETICA_SEGMENT_ID = "salao_estetica" as const;

/** Abas da esteira convergente — coluna soberana + pools periféricos. */
export const SALAO_TAB = {
  FILA_ATIVA: "tab-fila-ativa",
  HORA: "tab-hora",
  ORDEM: "tab-ordem",
  ENCAIXE_URGENTE: "tab-encaixe-urgente",
  AGUARDANDO_PAGAMENTO: "tab-aguardando-pagamento",
  REAGENDAR: "tab-reagendar",
} as const;

export type SalaoTabId = (typeof SALAO_TAB)[keyof typeof SALAO_TAB];

export const SALAO_QUEUE_TAB_ORDER: readonly SalaoTabId[] = [
  SALAO_TAB.FILA_ATIVA,
  SALAO_TAB.HORA,
  SALAO_TAB.ORDEM,
  SALAO_TAB.ENCAIXE_URGENTE,
  SALAO_TAB.AGUARDANDO_PAGAMENTO,
  SALAO_TAB.REAGENDAR,
];

export const SALAO_QUEUE_TAB_LABELS: Record<SalaoTabId, string> = {
  [SALAO_TAB.FILA_ATIVA]: "FILA ATIVA",
  [SALAO_TAB.HORA]: "HORA MARCADA",
  [SALAO_TAB.ORDEM]: "ORDEM DE CHEGADA",
  [SALAO_TAB.ENCAIXE_URGENTE]: "ENCAIXE / URGENTE",
  [SALAO_TAB.AGUARDANDO_PAGAMENTO]: "AGUARDANDO PAGAMENTO",
  [SALAO_TAB.REAGENDAR]: "REAGENDAR",
};

/** Colunas de fila cujo botão verde envia para aguardando pagamento. */
export const SALAO_QUEUE_FILA_TAB_IDS: readonly SalaoTabId[] = [
  SALAO_TAB.FILA_ATIVA,
  SALAO_TAB.HORA,
  SALAO_TAB.ORDEM,
  SALAO_TAB.ENCAIXE_URGENTE,
];

/** Pools periféricos que alimentam a fila ativa via "Atender Agora". */
export const SALAO_POOL_TAB_IDS: readonly SalaoTabId[] = [
  SALAO_TAB.ORDEM,
  SALAO_TAB.ENCAIXE_URGENTE,
];

/** Janela de antecedência (ms) para auto-mover hora marcada → fila ativa. */
export const SALAO_HORA_ACTIVATION_WINDOW_MS = 30 * 60 * 1000;

/** Ciclo de vida operacional do atendimento no salão. */
export const SALAO_STATUS = {
  waiting: "waiting",
  next: "next",
  called: "called",
  processing: "processing",
  completed: "completed",
} as const;

export type SalaoStatus = (typeof SALAO_STATUS)[keyof typeof SALAO_STATUS];

/** Profissional alocado — categoria `sal-c1`. */
export const SALAO_PROFISSIONAL_CATEGORY_ID = "sal-c1" as const;

/** Cadeira / sala de atendimento — categoria `sal-c2`. */
export const SALAO_LOCAL_CATEGORY_ID = "sal-c2" as const;

/** Serviços solicitados (múltiplos) — campo inline `sal-svc` na tag `__sf_salao:`. */
export const SALAO_FIELD_SERVICOS = "sal-svc" as const;

/** Timestamp ISO gravado ao marcar como próximo (`__sf_salao:`). */
export const SALAO_FIELD_MARKED_NEXT_AT = "marked_next_at" as const;

/** Peso de ordenação manual na coluna `tab-fila-ativa` (`__sf_salao:`). */
export const SALAO_FIELD_SORT_ORDER = "sort_order" as const;

export const SALAO_DATA_TAG_RE = /__sf_salao:[\s\S]*?__/gi;

const SALAO_DATA_PARSE = /__sf_salao:([\s\S]*?)__/i;

/** Ids legados do pipeline físico e abas antigas (migração). */
const LEGACY_PIPELINE_TAB_TO_SALAO_TAB: Record<string, SalaoTabId> = {
  fila_espera: SALAO_TAB.ORDEM,
  check_in: SALAO_TAB.ORDEM,
  em_atendimento: SALAO_TAB.FILA_ATIVA,
  finalizado_caixa: SALAO_TAB.ORDEM,
  "sal-t1": SALAO_TAB.ORDEM,
  "sal-t2": SALAO_TAB.FILA_ATIVA,
  "sal-t3": SALAO_TAB.FILA_ATIVA,
  "sal-t4": SALAO_TAB.FILA_ATIVA,
  "sal-t5": SALAO_TAB.ORDEM,
  cadeira_01: SALAO_TAB.FILA_ATIVA,
  cadeira_02: SALAO_TAB.FILA_ATIVA,
  sala_estetica_01: SALAO_TAB.FILA_ATIVA,
  "tab-encaixe": SALAO_TAB.ENCAIXE_URGENTE,
  "tab-urgente": SALAO_TAB.ENCAIXE_URGENTE,
};

export type SalaoCadastroFields = Partial<Record<string, string>>;

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

export function buildSalaoDefaultQueueTabs(): QueueTabEntry[] {
  return [
    {
      id: SALAO_TAB.FILA_ATIVA,
      preset: "outros",
      label: SALAO_QUEUE_TAB_LABELS[SALAO_TAB.FILA_ATIVA],
      customTypeLabel: SALAO_QUEUE_TAB_LABELS[SALAO_TAB.FILA_ATIVA],
    },
    { id: SALAO_TAB.HORA, preset: "hora", label: SALAO_QUEUE_TAB_LABELS[SALAO_TAB.HORA] },
    { id: SALAO_TAB.ORDEM, preset: "ordem", label: SALAO_QUEUE_TAB_LABELS[SALAO_TAB.ORDEM] },
    {
      id: SALAO_TAB.ENCAIXE_URGENTE,
      preset: "encaixe",
      label: SALAO_QUEUE_TAB_LABELS[SALAO_TAB.ENCAIXE_URGENTE],
    },
    {
      id: SALAO_TAB.AGUARDANDO_PAGAMENTO,
      preset: "outros",
      label: SALAO_QUEUE_TAB_LABELS[SALAO_TAB.AGUARDANDO_PAGAMENTO],
      customTypeLabel: SALAO_QUEUE_TAB_LABELS[SALAO_TAB.AGUARDANDO_PAGAMENTO],
    },
    { id: SALAO_TAB.REAGENDAR, preset: "reagendar", label: SALAO_QUEUE_TAB_LABELS[SALAO_TAB.REAGENDAR] },
  ];
}

export function resolveSalaoQueueTabs(config: {
  queueTabs: QueueTabEntry[];
  showTodosTab?: boolean;
}): QueueTabEntry[] {
  const hasClassificationTabs = config.queueTabs.some(
    (t) => t.preset !== "todos" && t.preset !== "outros"
  );
  const flowTabs = hasClassificationTabs ? config.queueTabs.filter((t) => t.preset !== "todos") : buildSalaoDefaultQueueTabs();
  return config.showTodosTab ? [TODOS_QUEUE_TAB, ...flowTabs] : flowTabs;
}

export function normalizeSalaoFilaTabId(tabId: string | null | undefined): string | null {
  if (!tabId) return null;
  return LEGACY_PIPELINE_TAB_TO_SALAO_TAB[tabId] ?? tabId;
}

export function resolveSalaoQueueTabLabel(
  tabId: string,
  queueTabs?: Array<Pick<QueueTabEntry, "id"> & Partial<Pick<QueueTabEntry, "label">>>
): string {
  const normalized = normalizeSalaoFilaTabId(tabId) ?? tabId;
  const tab = queueTabs?.find((t) => t.id === normalized);
  if (tab?.label?.trim()) return tab.label.trim();
  const presetLabel = SALAO_QUEUE_TAB_LABELS[normalized as SalaoTabId];
  if (presetLabel) return presetLabel;
  return normalized;
}

/** @deprecated Use resolveSalaoQueueTabLabel */
export function getSalaoStepLabel(
  step: string,
  queueTabs?: Pick<QueueTabEntry, "id" | "label">[]
): string {
  return resolveSalaoQueueTabLabel(step, queueTabs);
}

export function resolveSalaoKanbanColumnLabel(tab: Pick<QueueTabEntry, "id" | "label">): string {
  const saved = tab.label?.trim();
  if (saved) return saved.toUpperCase();
  return resolveSalaoQueueTabLabel(tab.id);
}

export function resolveSalaoQueueTabClickId(tabId: string): string {
  return normalizeSalaoFilaTabId(tabId) ?? tabId;
}

export function isSalaoQueueTabIdInVisible(queueTabId: string, visibleTabIds: string[]): boolean {
  if (visibleTabIds.includes(queueTabId)) return true;
  if (queueTabId === TODOS_QUEUE_TAB.id) return false;
  const normalized = normalizeSalaoFilaTabId(queueTabId);
  return visibleTabIds.some((id) => normalizeSalaoFilaTabId(id) === normalized);
}

export function isSalaoQueueTabSelected(queueTabId: string, tabId: string): boolean {
  if (tabId === TODOS_QUEUE_TAB.id || queueTabId === TODOS_QUEUE_TAB.id) {
    return queueTabId === tabId;
  }
  return normalizeSalaoFilaTabId(queueTabId) === normalizeSalaoFilaTabId(tabId);
}

export function resolveSalaoTabIdFromObservacao(
  observacao: string | null | undefined,
  activeColumns: Array<Pick<QueueTabEntry, "id"> & Partial<Pick<QueueTabEntry, "preset">>>
): string | null {
  if (activeColumns.length === 0) return null;
  const raw = parseFilaTabId(observacao);
  if (raw) {
    const normalized = normalizeSalaoFilaTabId(raw) ?? raw;
    const idx = activeColumns.findIndex((t) => t.id === normalized);
    if (idx >= 0) return activeColumns[idx]!.id;
  }
  const preset = parseFilaPreset(observacao);
  if (preset && preset !== "outros" && preset !== "todos") {
    const byPreset = activeColumns.find((t) => t.preset === preset);
    if (byPreset) return byPreset.id;
  }
  return activeColumns[0]?.id ?? null;
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

export function getSalaoMarkedNextAt(observacao: string | null | undefined): string | null {
  return parseSalaoCadastroFields(observacao)[SALAO_FIELD_MARKED_NEXT_AT] ?? null;
}

export function getSalaoSortOrder(observacao: string | null | undefined): number | null {
  const raw = parseSalaoCadastroFields(observacao)[SALAO_FIELD_SORT_ORDER];
  if (!raw?.trim()) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function resolveSalaoFilaAtivaTab(
  queueTabs: Pick<QueueTabEntry, "id" | "preset">[]
): Pick<QueueTabEntry, "id" | "preset"> {
  return (
    queueTabs.find((t) => t.id === SALAO_TAB.FILA_ATIVA) ?? {
      id: SALAO_TAB.FILA_ATIVA,
      preset: "outros",
    }
  );
}

export function isSalaoPoolTabId(tabId: string | null | undefined): boolean {
  if (!tabId) return false;
  const normalized = normalizeSalaoFilaTabId(tabId) ?? tabId;
  return (SALAO_POOL_TAB_IDS as readonly string[]).includes(normalized);
}

export function isSalaoQueueFilaTabId(tabId: string | null | undefined): boolean {
  if (!tabId) return false;
  const normalized = normalizeSalaoFilaTabId(tabId) ?? tabId;
  return (SALAO_QUEUE_FILA_TAB_IDS as readonly string[]).includes(normalized);
}

export function isSalaoAguardandoPagamentoTabId(tabId: string | null | undefined): boolean {
  if (!tabId) return false;
  const normalized = normalizeSalaoFilaTabId(tabId) ?? tabId;
  return normalized === SALAO_TAB.AGUARDANDO_PAGAMENTO;
}

export function resolveSalaoAguardandoPagamentoTab(
  queueTabs: Pick<QueueTabEntry, "id" | "preset" | "label">[]
): Pick<QueueTabEntry, "id" | "preset"> {
  return (
    queueTabs.find((t) => t.id === SALAO_TAB.AGUARDANDO_PAGAMENTO) ?? {
      id: SALAO_TAB.AGUARDANDO_PAGAMENTO,
      preset: "outros",
    }
  );
}

export type SalaoHeaderActionState = {
  showPrimary: boolean;
  primaryLabel: string;
  primaryAction: "aguardando_pagamento" | "finalizar" | null;
};

/** Botão verde dinâmico do balcão conforme a coluna do card selecionado. */
export function resolveSalaoHeaderActionState(
  tabId: string | null | undefined
): SalaoHeaderActionState {
  if (isSalaoAguardandoPagamentoTabId(tabId)) {
    return { showPrimary: true, primaryLabel: "Finalizar", primaryAction: "finalizar" };
  }
  if (isSalaoQueueFilaTabId(tabId)) {
    return {
      showPrimary: true,
      primaryLabel: "Aguardando Pagamento",
      primaryAction: "aguardando_pagamento",
    };
  }
  return { showPrimary: false, primaryLabel: "", primaryAction: null };
}

export function buildSalaoMoveToTabObservacao(
  currentObservacao: string | null | undefined,
  targetTab: Pick<QueueTabEntry, "id" | "preset">
): string | null {
  const salaoFields = parseSalaoCadastroFields(currentObservacao);
  if (targetTab.id !== SALAO_TAB.FILA_ATIVA) {
    delete salaoFields[SALAO_FIELD_SORT_ORDER];
  }
  if (targetTab.id !== SALAO_TAB.AGUARDANDO_PAGAMENTO) {
    delete salaoFields[SALAO_FIELD_MARKED_NEXT_AT];
  }
  return mergeSalaoObservacao({
    current: currentObservacao,
    tab: targetTab,
    salaoFields,
    preserveTabWhenUnset: false,
  });
}

export function buildSalaoMoveToAguardandoPagamentoObservacao(
  currentObservacao: string | null | undefined,
  queueTabs: Pick<QueueTabEntry, "id" | "preset" | "label">[]
): string | null {
  return buildSalaoMoveToTabObservacao(
    currentObservacao,
    resolveSalaoAguardandoPagamentoTab(queueTabs)
  );
}

/** Horário marcado entrou na janela de 30 min antecedentes ao momento atual. */
export function isSalaoHoraReadyForFilaAtiva(
  horaMarcada: string | null | undefined,
  nowMs = Date.now()
): boolean {
  if (!horaMarcada) return false;
  const scheduled = horaComparable(horaMarcada);
  if (!Number.isFinite(scheduled)) return false;
  return (
    scheduled >= nowMs - SALAO_HORA_ACTIVATION_WINDOW_MS && scheduled <= nowMs + SALAO_HORA_ACTIVATION_WINDOW_MS
  );
}

function resolveSalaoSortOrders(rows: AtendimentoLite[]): number[] {
  return rows
    .map((r) => getSalaoSortOrder(r.observacao))
    .filter((n): n is number => n !== null);
}

function compareSalaoFilaAtivaOrder(a: AtendimentoLite, b: AtendimentoLite): number {
  const sa = getSalaoSortOrder(a.observacao);
  const sb = getSalaoSortOrder(b.observacao);
  if (sa !== null && sb !== null && sa !== sb) return sa - sb;
  if (sa !== null && sb === null) return -1;
  if (sa === null && sb !== null) return 1;
  return compareQueueArrivalOrder(a, b);
}

export function buildSalaoMoveToFilaAtivaObservacao(
  currentObservacao: string | null | undefined,
  queueTabs: Pick<QueueTabEntry, "id" | "preset">[],
  position: "top" | "bottom",
  existingFilaAtivaRows: AtendimentoLite[]
): string | null {
  const filaTab = resolveSalaoFilaAtivaTab(queueTabs);
  const sortOrders = resolveSalaoSortOrders(existingFilaAtivaRows);
  const sortOrder =
    position === "top"
      ? sortOrders.length > 0
        ? Math.min(...sortOrders) - 1
        : 0
      : sortOrders.length > 0
        ? Math.max(...sortOrders) + 1
        : 0;

  const fields = parseSalaoCadastroFields(currentObservacao);
  fields[SALAO_FIELD_SORT_ORDER] = String(sortOrder);
  delete fields[SALAO_FIELD_MARKED_NEXT_AT];

  return mergeSalaoObservacao({
    current: currentObservacao,
    tab: filaTab,
    salaoFields: fields,
    preserveTabWhenUnset: false,
  });
}

export function buildSalaoSwapSortOrderObservacao(
  rowA: AtendimentoLite,
  rowB: AtendimentoLite
): { observacaoA: string | null; observacaoB: string | null } {
  const orderA = getSalaoSortOrder(rowA.observacao) ?? 0;
  const orderB = getSalaoSortOrder(rowB.observacao) ?? 0;
  const fieldsA = parseSalaoCadastroFields(rowA.observacao);
  const fieldsB = parseSalaoCadastroFields(rowB.observacao);
  fieldsA[SALAO_FIELD_SORT_ORDER] = String(orderB);
  fieldsB[SALAO_FIELD_SORT_ORDER] = String(orderA);
  return {
    observacaoA: mergeSalaoObservacao({
      current: rowA.observacao,
      salaoFields: fieldsA,
      preserveTabWhenUnset: true,
    }),
    observacaoB: mergeSalaoObservacao({
      current: rowB.observacao,
      salaoFields: fieldsB,
      preserveTabWhenUnset: true,
    }),
  };
}

export function collectSalaoHoraAutoMoveCandidates(
  rows: AtendimentoLite[],
  queueTabs: Pick<QueueTabEntry, "id" | "preset">[],
  nowMs = Date.now()
): AtendimentoLite[] {
  const horaTab = { id: SALAO_TAB.HORA, preset: "hora" as const };
  return rows.filter(
    (r) =>
      isActiveQueueRow(r) &&
      isSalaoActiveStatus(r.status) &&
      rowMatchesSalaoQueueTabEntry(r, horaTab, queueTabs) &&
      isSalaoHoraReadyForFilaAtiva(r.hora_marcada, nowMs)
  );
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
      const normalized = normalizeSalaoFilaTabId(tabId) ?? tabId;
      const preset = parseFilaPreset(current) ?? "ordem";
      withFila = embedFilaPreset(withFila, preset === "outros" ? "ordem" : preset, normalized);
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
  const tab = tabId ? { id: normalizeSalaoFilaTabId(tabId) ?? tabId, preset } : null;
  return mergeSalaoObservacao({
    current: userObs || null,
    tab,
    salaoFields,
    preserveTabWhenUnset: false,
  });
}

export function buildSalaoMarkedNextObservacao(
  currentObservacao: string | null | undefined
): string | null {
  const fields = parseSalaoCadastroFields(currentObservacao);
  fields[SALAO_FIELD_MARKED_NEXT_AT] = new Date().toISOString();
  return mergeSalaoObservacao({
    current: currentObservacao,
    salaoFields: fields,
    preserveTabWhenUnset: true,
  });
}

export function clearSalaoMarkedNextObservacao(
  currentObservacao: string | null | undefined
): string | null {
  const fields = parseSalaoCadastroFields(currentObservacao);
  delete fields[SALAO_FIELD_MARKED_NEXT_AT];
  return mergeSalaoObservacao({
    current: currentObservacao,
    salaoFields: fields,
    preserveTabWhenUnset: true,
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

export function normalizeSalaoStatus(
  status: string | null | undefined
): SalaoStatus | "legacy_waiting" | "legacy_called" | "legacy_completed" {
  const s = (status ?? "").trim().toLowerCase();
  if (s === SALAO_STATUS.waiting) return SALAO_STATUS.waiting;
  if (s === SALAO_STATUS.next) return SALAO_STATUS.next;
  if (s === SALAO_STATUS.called) return SALAO_STATUS.called;
  if (s === SALAO_STATUS.processing) return SALAO_STATUS.processing;
  if (s === SALAO_STATUS.completed) return SALAO_STATUS.completed;
  if (s === "finalizado") return SALAO_STATUS.completed;
  if (s.includes("recham")) return SALAO_STATUS.called;
  if (s.includes("chamado") || (s.includes("cham") && !s.includes("aguard"))) return SALAO_STATUS.called;
  if (s.includes("aguard")) return SALAO_STATUS.waiting;
  return SALAO_STATUS.waiting;
}

export function isSalaoWaitingStatus(status: string | null | undefined): boolean {
  const n = normalizeSalaoStatus(status);
  return n === SALAO_STATUS.waiting || n === "legacy_waiting";
}

export function isSalaoNextStatus(status: string | null | undefined): boolean {
  return normalizeSalaoStatus(status) === SALAO_STATUS.next;
}

export function isSalaoCalledStatus(status: string | null | undefined): boolean {
  const n = normalizeSalaoStatus(status);
  return n === SALAO_STATUS.called || n === "legacy_called";
}

export function isSalaoActiveStatus(status: string | null | undefined): boolean {
  const n = normalizeSalaoStatus(status);
  return n !== SALAO_STATUS.completed && n !== "legacy_completed";
}

export function normalizeSalaoStatusLabel(status: string | null | undefined): string {
  const n = normalizeSalaoStatus(status);
  switch (n) {
    case SALAO_STATUS.next:
      return "Próximo";
    case SALAO_STATUS.called:
    case "legacy_called":
      return "Chamado";
    case SALAO_STATUS.processing:
      return "Em atendimento";
    case SALAO_STATUS.completed:
    case "legacy_completed":
      return "Finalizado";
    case SALAO_STATUS.waiting:
    case "legacy_waiting":
    default:
      return "Aguardando";
  }
}

export function salaoStatusRank(status: string | null | undefined): number {
  const n = normalizeSalaoStatus(status);
  if (n === SALAO_STATUS.next) return 0;
  if (n === SALAO_STATUS.waiting || n === "legacy_waiting") return 1;
  if (n === SALAO_STATUS.called || n === "legacy_called") return 2;
  if (n === SALAO_STATUS.processing) return 3;
  return 4;
}

function compareSalaoNextThenTabOrder(
  a: AtendimentoLite,
  b: AtendimentoLite,
  tabPreset: QueueTabEntry["preset"]
): number {
  const rankDiff = salaoStatusRank(a.status) - salaoStatusRank(b.status);
  if (rankDiff !== 0) return rankDiff;

  const aNext = getSalaoMarkedNextAt(a.observacao);
  const bNext = getSalaoMarkedNextAt(b.observacao);
  if (isSalaoNextStatus(a.status) && isSalaoNextStatus(b.status)) {
    const tn = timeMs(aNext) - timeMs(bNext);
    if (tn !== 0) return tn;
  }

  if (tabPreset === "hora") {
    const th = horaComparable(a.hora_marcada) - horaComparable(b.hora_marcada);
    if (th !== 0) return th;
  }

  return compareQueueArrivalOrder(a, b);
}

export function rowMatchesSalaoQueueTabEntry(
  row: {
    observacao: string | null;
    hora_marcada: string | null;
    classificacao_prioridade: string | null;
    prioridade: boolean | null;
  },
  tab: Pick<QueueTabEntry, "id" | "preset">,
  queueTabs?: Pick<QueueTabEntry, "id" | "preset">[]
): boolean {
  if (tab.preset === "todos") return true;

  if (tab.id === SALAO_TAB.ENCAIXE_URGENTE) {
    const rawTabId = parseFilaTabId(row.observacao);
    if (rawTabId) {
      const normalized = normalizeSalaoFilaTabId(rawTabId) ?? rawTabId;
      if (normalized === SALAO_TAB.ENCAIXE_URGENTE) return true;
    }
    const preset = parseFilaPreset(row.observacao);
    if (preset === "encaixe" || preset === "urgente") return true;
  }

  const rawTabId = parseFilaTabId(row.observacao);
  if (rawTabId) {
    const normalized = normalizeSalaoFilaTabId(rawTabId) ?? rawTabId;
    if (normalized === tab.id) return true;
  }
  if (queueTabs?.length) {
    const resolved = resolveRowQueueTabId(row, queueTabs);
    if (resolved === tab.id) return true;
  }
  return rowMatchesQueueTabEntry(row, tab);
}

export function filterAndSortSalaoQueue(
  rows: AtendimentoLite[],
  tab: Pick<QueueTabEntry, "id" | "preset">,
  allTabs?: Pick<QueueTabEntry, "id" | "preset">[]
): AtendimentoLite[] {
  const active =
    tab.preset === "todos"
      ? rows.filter((r) => isActiveQueueRow(r) && isSalaoActiveStatus(r.status))
      : rows
          .filter((r) => isActiveQueueRow(r) && isSalaoActiveStatus(r.status))
          .filter((r) => rowMatchesSalaoQueueTabEntry(r, tab, allTabs));

  if (tab.id === SALAO_TAB.FILA_ATIVA) {
    return [...active].sort(compareSalaoFilaAtivaOrder);
  }

  return [...active].sort((a, b) => compareSalaoNextThenTabOrder(a, b, tab.preset));
}

export function countActiveBySalaoQueueTab(
  rows: AtendimentoLite[],
  tabs: Pick<QueueTabEntry, "id" | "preset">[]
): Record<string, number> {
  const active = rows.filter((r) => isActiveQueueRow(r) && isSalaoActiveStatus(r.status));
  const counts: Record<string, number> = {};
  for (const tab of tabs) {
    if (tab.preset === "todos") {
      counts[tab.id] = active.length;
    } else {
      counts[tab.id] = active.filter((r) => rowMatchesSalaoQueueTabEntry(r, tab, tabs)).length;
    }
  }
  return counts;
}

/** Rótulo do botão de chamada conforme o posto alocado (cadeira vs sala). */
export function resolveSalaoHoraMarcadaBadgeMeta(isSalaoSegment: boolean): {
  prefix: string;
  titlePrefix: string;
} {
  if (isSalaoSegment) {
    return { prefix: "Horário", titlePrefix: "Horário de atendimento" };
  }
  return { prefix: "Retirada", titlePrefix: "Previsão de retirada" };
}

export function resolveSalaoHeaderServicoLabel(
  row: Pick<
    AtendimentoLite,
    "observacao" | "cadastro_valores" | "especialidade_id" | "servicoNome"
  >,
  categories: CadastroCategoryEntry[],
  lookups: CadastroLookups
): string | null {
  const label = resolveSalaoCategoryDisplay(
    "sal-c3",
    row.observacao,
    row.cadastro_valores ?? {},
    lookups,
    categories,
    {
      especialidade_id: row.especialidade_id,
      servicoNome: row.servicoNome,
    }
  );
  return label?.trim() || null;
}

export function resolveSalaoChamarLabel(localNome: string | null | undefined): string {
  const n = (localNome ?? "").trim().toLowerCase();
  if (n.includes("estética") || n.includes("estetica") || n.includes("sala")) {
    return "Chamar para Sala";
  }
  return "Chamar para Cadeira";
}

export function resolveSalaoProfissionalKey(
  row: Pick<AtendimentoLite, "observacao" | "cadastro_valores" | "profissional_id" | "profissionalNome">,
  categories: CadastroCategoryEntry[],
  lookups: CadastroLookups
): string {
  return (
    resolveSalaoProfissionalLabel(row, categories, lookups)?.trim() ||
    row.profissionalNome?.trim() ||
    row.profissional_id ||
    "—"
  );
}

export type SalaoProximoEntry = {
  row: AtendimentoLite;
  profissional: string;
};

export type SalaoFilaAtivaTvDisplay = {
  highlight: AtendimentoLite | null;
  proximos: SalaoProximoEntry[];
};

/** TV do salão: lê exclusivamente `tab-fila-ativa` ordenada por `sort_order`. */
export function buildSalaoFilaAtivaTvDisplay(
  rows: AtendimentoLite[],
  categories: CadastroCategoryEntry[],
  lookups: CadastroLookups,
  queueTabs: Pick<QueueTabEntry, "id" | "preset">[]
): SalaoFilaAtivaTvDisplay {
  const filaTab = resolveSalaoFilaAtivaTab(queueTabs);
  const sorted = filterAndSortSalaoQueue(rows, filaTab, queueTabs);
  const highlight = sorted[0] ?? null;
  const proximos = sorted.slice(1, 5).map((row) => ({
    row,
    profissional: resolveSalaoProfissionalKey(row, categories, lookups),
  }));
  return { highlight, proximos };
}

/** @deprecated Use buildSalaoFilaAtivaTvDisplay — esteira convergente usa só fila ativa. */
export function buildSalaoProximosDaVez(
  rows: AtendimentoLite[],
  categories: CadastroCategoryEntry[],
  lookups: CadastroLookups,
  limit = 12
): SalaoProximoEntry[] {
  const queueTabs = buildSalaoDefaultQueueTabs();
  const { proximos, highlight } = buildSalaoFilaAtivaTvDisplay(rows, categories, lookups, queueTabs);
  const all = highlight ? [highlight, ...proximos.map((p) => p.row)] : proximos.map((p) => p.row);
  return all.slice(0, limit).map((row) => ({
    row,
    profissional: resolveSalaoProfissionalKey(row, categories, lookups),
  }));
}

/** Plano PRO: desbloqueia a aba consolidada de Agenda futura (não o campo no balcão). */
export function canUseSalaoAgendaFeatures(planTier: PlanTier): boolean {
  return isProPlan(planTier);
}

/** Observação padrão para agendamentos criados pela Agenda PRO do salão. */
export function buildSalaoAgendaBookingObservacao(
  userObs: string | null,
  salaoFields: SalaoCadastroFields
): string | null {
  return buildSalaoRegistryObservacao(userObs, "hora", SALAO_TAB.HORA, salaoFields);
}

/** Linha elegível na Agenda PRO: hoje ou futuro, coluna HORA MARCADA. */
export function isSalaoAgendaEligibleRow(
  row: AtendimentoLite,
  queueTabs: Pick<QueueTabEntry, "id" | "preset">[]
): boolean {
  if (!isActiveQueueRow(row) || !isSalaoActiveStatus(row.status)) return false;
  if (!isTodayOrFutureHoraMarcada(row.hora_marcada)) return false;
  const horaTab = { id: SALAO_TAB.HORA, preset: "hora" as const };
  return rowMatchesSalaoQueueTabEntry(row, horaTab, queueTabs);
}

/** Agendamento com horário no dia de hoje (ações rápidas na Agenda). */
export function isSalaoAgendaTodayRow(row: Pick<AtendimentoLite, "hora_marcada">): boolean {
  return isTodayHoraMarcada(row.hora_marcada);
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
