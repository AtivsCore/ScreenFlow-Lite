import type { QueueTabId } from "@/lib/atendimentos-lite";
import { resolveClassificacaoPrioridade } from "@/lib/classificacao-prioridade";
import type { QueueTabEntry } from "@/lib/tenant-config";

/** Remove todas as tags `__sf_fila:...__` (presets, abas customizadas e ids com `_`). */
const FILA_TAG_GLOBAL = /__sf_fila:[\s\S]*?__/gi;

/** Marcador de cadastro Docas em observação (textos livres — ver docas-logistics). */
const DOCAS_DATA_TAG_GLOBAL = /__sf_docas:[\s\S]*?__/gi;

/** Marcador de cadastro Aviação em observação (ver aviacao-logistics). */
const AVIACAO_DATA_TAG_GLOBAL = /__sf_aviacao:[\s\S]*?__/gi;

/** Marcador de cadastro Salão/Estética em observação (ver salao-estetica-logistics). */
const SALAO_DATA_TAG_GLOBAL = /__sf_salao:[\s\S]*?__/gi;

/** Equivalência de ids de coluna Docas (estável ↔ legado `doc-t*`). */
const DOCAS_KANBAN_TAB_EQUIV: Record<string, string> = {
  em_operacao: "descarregando",
  "doc-t1": "no_patio",
  "doc-t2": "chamado",
  "doc-t3": "descarregando",
  "doc-t4": "em_conferencia",
  "doc-t5": "liberado",
};

/** Equivalência de ids de coluna Aviação (estável ↔ legado `av-t*` / fluxo 5 colunas). */
const AVIACAO_KANBAN_TAB_EQUIV: Record<string, string> = {
  "av-t1": "triagem",
  "av-t2": "em_manutencao",
  "av-t3": "inspecao_qc",
  "av-t4": "teste_voo",
  "av-t5": "liberado",
  aguardando_peca: "em_manutencao",
  em_execucao: "inspecao_qc",
};

/** Equivalência de ids de coluna Salão/Estética (estável ↔ legado `sal-t*`). */
const SALAO_KANBAN_TAB_EQUIV: Record<string, string> = {
  "sal-t1": "fila_espera",
  "sal-t2": "em_atendimento",
  "sal-t3": "em_atendimento",
  "sal-t4": "em_atendimento",
  "sal-t5": "finalizado_caixa",
  check_in: "fila_espera",
  cadeira_01: "em_atendimento",
  cadeira_02: "em_atendimento",
  sala_estetica_01: "em_atendimento",
  em_atendimento: "tab-fila-ativa",
  "tab-encaixe": "tab-encaixe-urgente",
  "tab-urgente": "tab-encaixe-urgente",
};

/** Equivalência de ids de coluna Oficina / Hardware TI (estável ↔ legado `of-t*`). */
const AUTOMOTIVO_KANBAN_TAB_EQUIV: Record<string, string> = {
  "of-t1": "orcamento",
  "of-t2": "aguardando_pecas",
  "of-t3": "em_manutencao",
  "of-t4": "lavagem_estetica",
  "of-t5": "pronto_retirada",
  inspecao_qc: "em_manutencao",
  teste_voo: "em_manutencao",
  estetica_lavagem: "lavagem_estetica",
  liberado: "pronto_retirada",
};

function normalizeKanbanTabId(id: string): string {
  return (
    DOCAS_KANBAN_TAB_EQUIV[id] ??
    AVIACAO_KANBAN_TAB_EQUIV[id] ??
    SALAO_KANBAN_TAB_EQUIV[id] ??
    AUTOMOTIVO_KANBAN_TAB_EQUIV[id] ??
    id
  );
}

const MARKER_PARSE = /^__sf_fila:([a-z]+)__(?:\r?\n|$)/i;
const TAB_MARKER_PARSE = /^__sf_fila:tab:([a-z0-9_-]+)__(?:\r?\n|$)/i;

const VALID_PRESETS = new Set<QueueTabId>([
  "todos",
  "ordem",
  "hora",
  "encaixe",
  "prioridade",
  "urgente",
  "reagendar",
  "outros",
]);

/** Texto de observação limpo para exibição na UI (sem metadados técnicos). */
export function formatObservacaoForDisplay(observacao: string | null | undefined): string {
  if (!observacao) return "";
  return observacao
    .replace(FILA_TAG_GLOBAL, "")
    .replace(DOCAS_DATA_TAG_GLOBAL, "")
    .replace(AVIACAO_DATA_TAG_GLOBAL, "")
    .replace(SALAO_DATA_TAG_GLOBAL, "")
    .replace(/^[ \t]*\r?\n+/gm, "")
    .replace(/\r?\n{3,}/g, "\n\n")
    .trim();
}

/** @deprecated Alias — use formatObservacaoForDisplay */
export function stripFilaPreset(observacao: string | null | undefined): string {
  return formatObservacaoForDisplay(observacao);
}

/** Incorpora metadado de aba (preset ou id único da aba). */
export function embedFilaPreset(
  observacao: string | null | undefined,
  preset: QueueTabId,
  tabId?: string
): string | null {
  if (preset === "todos") preset = "ordem";
  const userText = formatObservacaoForDisplay(observacao);
  const marker = tabId ? `__sf_fila:tab:${tabId}__` : `__sf_fila:${preset}__`;
  if (!userText) return marker;
  return `${marker}\n${userText}`;
}

/** Lê id da aba gravado na observação (segmentos customizados). */
export function parseFilaTabId(observacao: string | null | undefined): string | null {
  if (!observacao) return null;
  const trimmed = observacao.trimStart();
  const m = TAB_MARKER_PARSE.exec(trimmed);
  if (m?.[1]) return m[1];
  const inline = observacao.match(/__sf_fila:tab:([a-z0-9_-]+)__/i);
  return inline?.[1] ?? null;
}

/** Lê preset gravado na observação. */
export function parseFilaPreset(observacao: string | null | undefined): QueueTabId | null {
  if (!observacao) return null;
  if (parseFilaTabId(observacao)) return "outros";
  const m = MARKER_PARSE.exec(observacao.trimStart());
  if (!m?.[1]) {
    const inline = observacao.match(/__sf_fila:([a-z]+)__/i);
    if (!inline?.[1]) return null;
    const preset = inline[1].toLowerCase() as QueueTabId;
    return VALID_PRESETS.has(preset) && preset !== "todos" ? preset : null;
  }
  const preset = m[1].toLowerCase() as QueueTabId;
  return VALID_PRESETS.has(preset) && preset !== "todos" ? preset : null;
}

type RowForPreset = {
  observacao: string | null;
  hora_marcada: string | null;
  classificacao_prioridade: string | null;
  prioridade: boolean | null;
};

/** Resolve id da aba configurada para a linha (marker ou inferência por preset). */
export function resolveRowQueueTabId(
  row: RowForPreset,
  queueTabs: Pick<QueueTabEntry, "id" | "preset">[]
): string {
  const fromMarker = parseFilaTabId(row.observacao);
  if (fromMarker) {
    const hit = queueTabs.find((t) => t.id === fromMarker);
    if (hit) return hit.id;
  }
  const preset = resolveRowFilaPreset(row);
  const byPreset = queueTabs.find((t) => t.preset === preset);
  if (byPreset) return byPreset.id;
  return queueTabs[0]?.id ?? "";
}

/** Grava observação com o mesmo marcador usado no modal de novo registro. */
export function embedObservacaoForQueueTab(
  observacao: string | null | undefined,
  tab: Pick<QueueTabEntry, "id" | "preset"> | undefined
): string | null {
  const preset = tab?.preset === "todos" ? "ordem" : (tab?.preset ?? "ordem");
  return embedFilaPreset(observacao, preset, tab?.id);
}

/** Resolve em qual aba o registro pertence (marker explícito ou inferência legada). */
export function resolveRowFilaPreset(row: RowForPreset): QueueTabId {
  const tabId = parseFilaTabId(row.observacao);
  if (tabId) return "outros";

  const fromMarker = parseFilaPreset(row.observacao);
  if (fromMarker) return fromMarker;

  const c = resolveClassificacaoPrioridade(row.classificacao_prioridade, row.prioridade);
  if (c === "emergencia") return "urgente";
  if (c === "prioritario") return "prioridade";
  if (row.hora_marcada) return "hora";
  return "ordem";
}

/** Verifica se a linha pertence exclusivamente à aba informada (`todos` = todas). */
export function rowMatchesQueueTab(row: RowForPreset, tab: QueueTabId): boolean {
  if (tab === "todos") return true;
  return resolveRowFilaPreset(row) === tab;
}

/** Filtro exclusivo por entrada de aba (suporta marcador por tab.id). */
export function rowMatchesQueueTabEntry(row: RowForPreset, tab: Pick<QueueTabEntry, "id" | "preset">): boolean {
  if (tab.preset === "todos") return true;
  const tabId = parseFilaTabId(row.observacao);
  if (tabId) {
    return normalizeKanbanTabId(tabId) === normalizeKanbanTabId(tab.id);
  }
  if (row.observacao?.includes("__sf_docas:") && normalizeKanbanTabId(tab.id) === "no_patio") {
    return true;
  }
  if (row.observacao?.includes("__sf_aviacao:") && normalizeKanbanTabId(tab.id) === "triagem") {
    return true;
  }
  if (row.observacao?.includes("__sf_salao:") && !parseFilaTabId(row.observacao) && !parseFilaPreset(row.observacao)) {
    const preset = row.hora_marcada ? "hora" : "ordem";
    return tab.preset === preset;
  }
  return rowMatchesQueueTab(row, tab.preset);
}
