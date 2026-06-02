import type { QueueTabId } from "@/lib/atendimentos-lite";
import { resolveClassificacaoPrioridade } from "@/lib/classificacao-prioridade";

/** Remove todas as tags `__sf_fila:...__` (início ou corpo do texto). */
const FILA_TAG_GLOBAL = /__sf_fila:[a-z]+__/gi;

const MARKER_PARSE = /^__sf_fila:([a-z]+)__(?:\r?\n|$)/i;

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
    .replace(/^[ \t]*\r?\n+/gm, "")
    .replace(/\r?\n{3,}/g, "\n\n")
    .trim();
}

/** @deprecated Alias — use formatObservacaoForDisplay */
export function stripFilaPreset(observacao: string | null | undefined): string {
  return formatObservacaoForDisplay(observacao);
}

/** Incorpora preset da aba no início da observação (metadado interno, oculto na UI). */
export function embedFilaPreset(observacao: string | null | undefined, preset: QueueTabId): string | null {
  if (preset === "todos") preset = "ordem";
  const userText = formatObservacaoForDisplay(observacao);
  const marker = `__sf_fila:${preset}__`;
  if (!userText) return marker;
  return `${marker}\n${userText}`;
}

/** Lê preset gravado na observação. */
export function parseFilaPreset(observacao: string | null | undefined): QueueTabId | null {
  if (!observacao) return null;
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

/** Resolve em qual aba o registro pertence (marker explícito ou inferência legada). */
export function resolveRowFilaPreset(row: RowForPreset): QueueTabId {
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
