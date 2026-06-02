import type { QueueTabId } from "@/lib/atendimentos-lite";
import { resolveClassificacaoPrioridade } from "@/lib/classificacao-prioridade";

const MARKER_RE = /^__sf_fila:([a-z]+)__(?:\r?\n|$)/;

const VALID_PRESETS = new Set<QueueTabId>([
  "ordem",
  "hora",
  "encaixe",
  "prioridade",
  "urgente",
  "outros",
]);

/** Incorpora preset da aba no início da observação (metadado interno, oculto na UI). */
export function embedFilaPreset(observacao: string | null | undefined, preset: QueueTabId): string | null {
  const userText = stripFilaPreset(observacao).trim();
  const marker = `__sf_fila:${preset}__`;
  if (!userText) return marker;
  return `${marker}\n${userText}`;
}

/** Remove metadado de preset da observação para exibição. */
export function stripFilaPreset(observacao: string | null | undefined): string {
  if (!observacao) return "";
  return observacao.replace(MARKER_RE, "").trim();
}

/** Lê preset gravado na observação. */
export function parseFilaPreset(observacao: string | null | undefined): QueueTabId | null {
  if (!observacao) return null;
  const m = MARKER_RE.exec(observacao);
  if (!m?.[1]) return null;
  const preset = m[1] as QueueTabId;
  return VALID_PRESETS.has(preset) ? preset : null;
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

/** Verifica se a linha pertence exclusivamente à aba informada. */
export function rowMatchesQueueTab(row: RowForPreset, tab: QueueTabId): boolean {
  return resolveRowFilaPreset(row) === tab;
}
