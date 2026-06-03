import type { QueueTabEntry } from "@/lib/tenant-config";

/** Slug do segmento licenciado no painel Master (`segmento_definido` / `segmentoAplicado`). */
export const DOCAS_SEGMENT_ID = "docas" as const;

/** IDs estáveis das colunas da esteira (marcador `__sf_fila:tab:…__` na observação). */
export const DOCAS_QUEUE_TAB = {
  NO_PATIO: "no_patio",
  CHAMADO: "chamado",
  EM_OPERACAO: "em_operacao",
  LIBERADO: "liberado",
} as const;

export type DocasQueueTabId = (typeof DOCAS_QUEUE_TAB)[keyof typeof DOCAS_QUEUE_TAB];

/** Categorias obrigatórias no primeiro cadastro (Transportadora + Motorista). */
export const DOCAS_REQUIRED_CATEGORY_IDS = ["doc-c1", "doc-c2"] as const;

export function isDocasSegment(segmentoAplicado: string | null | undefined): boolean {
  return segmentoAplicado === DOCAS_SEGMENT_ID;
}

export function isDocasRequiredCategory(categoryId: string): boolean {
  return (DOCAS_REQUIRED_CATEGORY_IDS as readonly string[]).includes(categoryId);
}

export function findDocasQueueTab(
  queueTabs: Pick<QueueTabEntry, "id">[],
  tabId: DocasQueueTabId
): QueueTabEntry | undefined {
  return queueTabs.find((t) => t.id === tabId) as QueueTabEntry | undefined;
}
