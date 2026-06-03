import type { QueueTabId } from "@/lib/atendimentos-lite";
import { resolveClassificacaoPrioridade } from "@/lib/classificacao-prioridade";
import type { QueueTabEntry } from "@/lib/tenant-config";

/** Remove todas as tags `__sf_fila:...__` (presets e abas customizadas). */
const FILA_TAG_GLOBAL = /__sf_fila:[^\s_]+(?::[^\s_]+)?__/gi;

/** Marcador de cadastro Docas em observação (textos livres — ver docas-logistics). */
const DOCAS_DATA_TAG_GLOBAL = /__sf_docas:[^_\s]+__/gi;

const MARKER_PARSE = /^__sf_fila:([a-z]+)__(?:\r?\n|$)/i;
const TAB_MARKER_PARSE = /^__sf_fila:tab:([a-z0-9-]+)__(?:\r?\n|$)/i;

const VALID_PRESETS = new Set<QueueTabId>([
  "todos",
  "ordem",
  "hora",
  "encaixe",
  "prioridade",
  "urgente",
  "outros",
]);

/** Texto de observação limpo para exibição na UI (sem metadados técnicos). */
export function formatObservacaoForDisplay(observacao: string | null | undefined): string {
  if (!observacao) return "";
  return observacao
    .replace(FILA_TAG_GLOBAL, "")
    .replace(DOCAS_DATA_TAG_GLOBAL, "")
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
  const inline = observacao.match(/__sf_fila:tab:([a-z0-9-]+)__/i);
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
  if (tabId) return tabId === tab.id;
  return rowMatchesQueueTab(row, tab.preset);
}
