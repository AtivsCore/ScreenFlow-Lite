import { parseFilaTabId } from "@/lib/fila-preset";
import { STATUS_UPDATE } from "@/lib/atendimentos-lite";
import type { QueueTabEntry } from "@/lib/tenant-config";

/** Slug do segmento licenciado no painel Master (`segmento_definido` / `segmentoAplicado`). */
export const DOCAS_SEGMENT_ID = "docas" as const;

/** IDs estáveis das colunas da esteira (marcador `__sf_fila:tab:…__` na observação). */
export const DOCAS_QUEUE_TAB = {
  NO_PATIO: "no_patio",
  CHAMADO: "chamado",
  DESCARREGANDO: "descarregando",
  EM_CONFERENCIA: "em_conferencia",
  LIBERADO: "liberado",
} as const;

export type DocasQueueTabId = (typeof DOCAS_QUEUE_TAB)[keyof typeof DOCAS_QUEUE_TAB];

/** Ordem oficial da esteira (setas esquerda/direita). */
export const DOCAS_PIPELINE_ORDER: readonly DocasQueueTabId[] = [
  DOCAS_QUEUE_TAB.NO_PATIO,
  DOCAS_QUEUE_TAB.CHAMADO,
  DOCAS_QUEUE_TAB.DESCARREGANDO,
  DOCAS_QUEUE_TAB.EM_CONFERENCIA,
  DOCAS_QUEUE_TAB.LIBERADO,
];

/** Rótulos exibidos na tag fixa do cabeçalho. */
export const DOCAS_STEP_LABELS: Record<DocasQueueTabId, string> = {
  [DOCAS_QUEUE_TAB.NO_PATIO]: "NO PÁTIO (ESPERA)",
  [DOCAS_QUEUE_TAB.CHAMADO]: "CHAMADO P/ DOCA",
  [DOCAS_QUEUE_TAB.DESCARREGANDO]: "DESCARREGANDO",
  [DOCAS_QUEUE_TAB.EM_CONFERENCIA]: "EM CONFERÊNCIA",
  [DOCAS_QUEUE_TAB.LIBERADO]: "LIBERADO",
};

/** Largura fixa da tag (baseada na maior string do fluxo). */
export const DOCAS_STATUS_TAG_WIDTH_CLASS = "w-[11.75rem]";

/** Campos de texto livre no modal Novo registro (não usam `<select>`). */
export const DOCAS_TEXT_FIELD_IDS = ["doc-c1", "doc-c2"] as const;

/** Categorias obrigatórias no primeiro cadastro. */
export const DOCAS_REQUIRED_CATEGORY_IDS = ["doc-c1", "doc-c2"] as const;

const LEGACY_TAB_ALIASES: Record<string, DocasQueueTabId> = {
  em_operacao: DOCAS_QUEUE_TAB.DESCARREGANDO,
  "doc-t1": DOCAS_QUEUE_TAB.NO_PATIO,
  "doc-t2": DOCAS_QUEUE_TAB.CHAMADO,
  "doc-t3": DOCAS_QUEUE_TAB.DESCARREGANDO,
  "doc-t4": DOCAS_QUEUE_TAB.EM_CONFERENCIA,
  "doc-t5": DOCAS_QUEUE_TAB.LIBERADO,
};

export function isDocasSegment(segmentoAplicado: string | null | undefined): boolean {
  return segmentoAplicado === DOCAS_SEGMENT_ID;
}

export function isDocasTextField(categoryId: string): boolean {
  return (DOCAS_TEXT_FIELD_IDS as readonly string[]).includes(categoryId);
}

export function isDocasRequiredCategory(categoryId: string): boolean {
  return (DOCAS_REQUIRED_CATEGORY_IDS as readonly string[]).includes(categoryId);
}

export function isDocasQueueTabId(id: string | null | undefined): id is DocasQueueTabId {
  return !!id && (DOCAS_PIPELINE_ORDER as readonly string[]).includes(id);
}

export function normalizeDocasTabId(tabId: string | null | undefined): DocasQueueTabId {
  if (!tabId) return DOCAS_QUEUE_TAB.NO_PATIO;
  if (isDocasQueueTabId(tabId)) return tabId;
  return LEGACY_TAB_ALIASES[tabId] ?? DOCAS_QUEUE_TAB.NO_PATIO;
}

export function resolveDocasStepFromObservacao(
  observacao: string | null | undefined
): DocasQueueTabId {
  const tabId = parseFilaTabId(observacao);
  return normalizeDocasTabId(tabId);
}

export function findDocasQueueTab(
  queueTabs: Pick<QueueTabEntry, "id" | "label">[],
  tabId: DocasQueueTabId
): QueueTabEntry | undefined {
  return queueTabs.find((t) => t.id === tabId) as QueueTabEntry | undefined;
}

export function getDocasStepLabel(
  step: DocasQueueTabId,
  queueTabs?: Pick<QueueTabEntry, "id" | "label">[]
): string {
  const tab = queueTabs ? findDocasQueueTab(queueTabs, step) : undefined;
  return tab?.label?.toUpperCase() ?? DOCAS_STEP_LABELS[step];
}

export function getDocasStepIndex(step: DocasQueueTabId): number {
  return DOCAS_PIPELINE_ORDER.indexOf(step);
}

export function shiftDocasStep(step: DocasQueueTabId, delta: -1 | 1): DocasQueueTabId | null {
  const idx = getDocasStepIndex(step);
  if (idx < 0) return null;
  const next = idx + delta;
  if (next < 0 || next >= DOCAS_PIPELINE_ORDER.length) return null;
  return DOCAS_PIPELINE_ORDER[next] ?? null;
}

/** Status de chamada na TV conforme a etapa (quando aplicável). */
export function docasStepTvStatus(step: DocasQueueTabId): string | undefined {
  if (step === DOCAS_QUEUE_TAB.CHAMADO) return STATUS_UPDATE.chamar;
  if (step === DOCAS_QUEUE_TAB.DESCARREGANDO) return STATUS_UPDATE.rechamar;
  return undefined;
}
