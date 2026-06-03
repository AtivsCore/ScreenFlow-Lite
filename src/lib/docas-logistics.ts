import {
  buildCadastroPayload,
  resolveCategoryDisplayLabel,
  type CadastroLegacyContext,
  type CadastroLookups,
  type CadastroValores,
} from "@/lib/cadastro-valores";
import { embedFilaPreset, parseFilaTabId } from "@/lib/fila-preset";
import { STATUS_UPDATE, type QueueTabId } from "@/lib/atendimentos-lite";
import type { CadastroCategoryEntry, QueueTabEntry } from "@/lib/tenant-config";

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

/** Única categoria obrigatória no primeiro cadastro (Placa). */
export const DOCAS_REQUIRED_CATEGORY_IDS = ["doc-c1"] as const;

/** Marcador JSON em `observacao` para campos de texto livre (não vai para UUID). */
export const DOCAS_DATA_TAG_RE = /__sf_docas:[^_\s]+__/gi;

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

export type DocasCadastroFields = Partial<Record<string, string>>;

/** Lê Placa, Motorista etc. gravados no marcador `__sf_docas:…__`. */
export function parseDocasCadastroFields(
  observacao: string | null | undefined
): DocasCadastroFields {
  if (!observacao) return {};
  const inline = observacao.match(/__sf_docas:([^_\s]+)__/i);
  if (!inline?.[1]) return {};
  try {
    const parsed = JSON.parse(decodeURIComponent(inline[1])) as Record<string, unknown>;
    const out: DocasCadastroFields = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string" && v.trim()) out[k] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

/** Incorpora ou atualiza o marcador de cadastro Docas na observação. */
export function embedDocasCadastroFields(
  observacao: string | null | undefined,
  fields: DocasCadastroFields
): string | null {
  const withoutTag = (observacao ?? "").replace(DOCAS_DATA_TAG_RE, "").trim();
  const payload: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v?.trim()) payload[k] = v.trim();
  }
  if (Object.keys(payload).length === 0) return withoutTag || null;
  const marker = `__sf_docas:${encodeURIComponent(JSON.stringify(payload))}__`;
  if (!withoutTag) return marker;
  return `${marker}\n${withoutTag}`;
}

/** Observação do novo registro: aba da fila + textos Docas + notas do usuário. */
export function buildDocasRegistryObservacao(
  userObs: string | null,
  filaPreset: QueueTabId,
  tabId: string | undefined,
  docasFields: DocasCadastroFields
): string | null {
  const withFila = embedFilaPreset(userObs || null, filaPreset, tabId);
  return embedDocasCadastroFields(withFila, docasFields);
}

/** Separa textos livres (observação) de UUIDs válidos (cadastro_valores / FKs). */
export function buildDocasSavePayload(
  formValues: Record<string, string>,
  categories: CadastroCategoryEntry[]
): {
  cadastroPayload: ReturnType<typeof buildCadastroPayload>;
  docasFields: DocasCadastroFields;
} {
  const selectValues: Record<string, string> = {};
  const docasFields: DocasCadastroFields = {};

  for (const cat of categories.filter((c) => c.enabled)) {
    const raw = formValues[cat.id]?.trim() ?? "";
    if (!raw) continue;
    if (isDocasTextField(cat.id)) {
      docasFields[cat.id] = raw;
    } else {
      selectValues[cat.id] = raw;
    }
  }

  return {
    cadastroPayload: buildCadastroPayload(selectValues, categories),
    docasFields,
  };
}

/** Rótulo de categoria na fila: textos do marcador Docas; demais via UUID/lookups. */
export function resolveDocasCategoryDisplay(
  categoryId: string,
  observacao: string | null | undefined,
  valores: CadastroValores,
  lookups: CadastroLookups,
  categories: CadastroCategoryEntry[],
  legacy?: CadastroLegacyContext
): string | null {
  if (isDocasTextField(categoryId)) {
    return parseDocasCadastroFields(observacao)[categoryId] ?? null;
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

/** Meta do card Kanban: Placa como título; Motorista e Carga nas linhas secundárias. */
export function resolveDocasKanbanMeta(
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
): { title: string; profissional: string | null; local: string | null; servico: string | null } {
  const fields = parseDocasCadastroFields(row.observacao);
  const legacyCtx: CadastroLegacyContext = {
    profissional_id: row.profissional_id,
    local_id: row.local_id,
    especialidade_id: row.especialidade_id,
    profissionalNome: row.profissionalNome,
    localNome: row.localNome,
    servicoNome: row.servicoNome,
  };
  const placa = fields["doc-c1"]?.trim() || null;
  const motorista = fields["doc-c2"]?.trim() || null;
  const carga =
    resolveDocasCategoryDisplay("doc-c3", row.observacao, row.cadastro_valores ?? {}, lookups, categories, legacyCtx) ??
    null;

  return {
    title: placa ?? row.nome?.trim() ?? "—",
    profissional: motorista,
    local: null,
    servico: carga,
  };
}
