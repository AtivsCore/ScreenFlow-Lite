import { SERVICES_TABLE } from "@/lib/db-tables";
import { rowMatchesQueueTab, rowMatchesQueueTabEntry } from "@/lib/fila-preset";
import type { CadastroValores } from "@/lib/cadastro-valores";
import { hydrateCadastroValores } from "@/lib/cadastro-valores";
import type { QueueTabEntry } from "@/lib/tenant-config";
import { formatProfissionalLabel } from "@/lib/profissionais-display";

/** Linha de `public.atendimentos_lite` (formato plano usado na UI) */
export type AtendimentoLite = {
  id: string;
  tenant_id: string | null;
  paciente_id: string | null;
  profissional_id: string | null;
  local_id: string | null;
  especialidade_id: string | null;
  tv_id: string | null;
  hora_marcada: string | null;
  status: string | null;
  prioridade: boolean | null;
  classificacao_prioridade: string | null;
  observacao: string | null;
  excluir_do_fechamento: boolean | null;
  cadastro_valores?: CadastroValores | null;
  created_at: string | null;
  nome: string | null;
  profissionalNome: string | null;
  localNome: string | null;
  servicoNome: string | null;
};

/** Resposta do `.select()` com FKs embutidas */
export type AtendimentoLiteNested = {
  id: string;
  tenant_id: string | null;
  paciente_id: string | null;
  profissional_id: string | null;
  local_id?: string | null;
  especialidade_id?: string | null;
  tv_id?: string | null;
  hora_marcada: string | null;
  status: string | null;
  prioridade: boolean | null;
  classificacao_prioridade?: string | null;
  observacao: string | null;
  excluir_do_fechamento?: boolean | null;
  cadastro_valores?: CadastroValores | null;
  created_at: string | null;
  pacientes?: { nome: string | null } | { nome: string | null }[] | null;
  profissionais?:
    | { id: string; nome: string | null; especialidade?: string | null }
    | { id: string; nome: string | null; especialidade?: string | null }[]
    | null
    | undefined;
  locais?: { id: string; nome: string | null } | { id: string; nome: string | null }[] | null;
  /** Legado; use chave dinâmica conforme `SERVICES_TABLE` em `db-tables`. */
  especialidades?: { id: string; nome: string | null } | { id: string; nome: string | null }[] | null;
  servicos?: { id: string; nome: string | null } | { id: string; nome: string | null }[] | null;
};

function nomeRelacionamento(
  rel: { nome: string | null } | { nome: string | null }[] | null | undefined
): string | null {
  if (rel == null) return null;
  if (Array.isArray(rel)) return rel[0]?.nome ?? null;
  return rel.nome ?? null;
}

function profissionalRel(
  rel:
    | { id: string; nome: string | null; especialidade?: string | null }
    | { id: string; nome: string | null; especialidade?: string | null }[]
    | null
    | undefined
): { id: string | null; nome: string | null; displayNome: string | null } {
  if (rel == null) return { id: null, nome: null, displayNome: null };
  const one = Array.isArray(rel) ? rel[0] : rel;
  const nome = one?.nome ?? null;
  return {
    id: one?.id ?? null,
    nome,
    displayNome: one ? formatProfissionalLabel(one) : null,
  };
}

function nomeJoinRel(
  rel: { nome: string | null } | { nome: string | null }[] | null | undefined
): string | null {
  if (rel == null) return null;
  if (Array.isArray(rel)) return rel[0]?.nome ?? null;
  return rel.nome ?? null;
}

function servicoNomeFromNested(row: AtendimentoLiteNested): string | null {
  const dict = row as unknown as Record<string, unknown>;
  const embed = dict[SERVICES_TABLE] ?? dict.especialidades ?? dict.servicos;
  return nomeJoinRel(embed as Parameters<typeof nomeJoinRel>[0]);
}

/** Converte o retorno do join embutido para o modelo plano da tabela */
export function mapAtendimentoNestedToFlat(
  row: AtendimentoLiteNested,
  categories?: import("@/lib/tenant-config").CadastroCategoryEntry[]
): AtendimentoLite {
  const prof = profissionalRel(row.profissionais);
  const cadastro_valores = hydrateCadastroValores(
    row.cadastro_valores,
    categories ?? [],
    {
      profissional_id: row.profissional_id ?? prof.id,
      local_id: row.local_id,
      especialidade_id: row.especialidade_id,
    }
  );
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    paciente_id: row.paciente_id,
    profissional_id: row.profissional_id ?? prof.id,
    local_id: row.local_id ?? null,
    especialidade_id: row.especialidade_id ?? null,
    tv_id: row.tv_id ?? null,
    hora_marcada: row.hora_marcada,
    status: row.status,
    prioridade: row.prioridade,
    classificacao_prioridade: row.classificacao_prioridade ?? null,
    observacao: row.observacao,
    excluir_do_fechamento: row.excluir_do_fechamento ?? false,
    cadastro_valores,
    created_at: row.created_at,
    nome: nomeRelacionamento(row.pacientes),
    profissionalNome: prof.displayNome ?? prof.nome,
    localNome: nomeJoinRel(row.locais),
    servicoNome: servicoNomeFromNested(row),
  };
}

/** Aplica lookup de serviços (busca independente) sobre linhas já mapeadas. */
export function applyServicoLookup(
  rows: AtendimentoLite[],
  lookup: Map<string, string | null>
): AtendimentoLite[] {
  return rows.map((row) => {
    if (!row.especialidade_id) return row;
    const nome = lookup.get(row.especialidade_id);
    if (nome === undefined) return row;
    return { ...row, servicoNome: nome };
  });
}

export function mapAtendimentosNestedToFlat(
  nested: AtendimentoLiteNested[],
  servicoLookup?: Map<string, string | null>,
  categories?: import("@/lib/tenant-config").CadastroCategoryEntry[]
): AtendimentoLite[] {
  const flat = nested.map((r) => mapAtendimentoNestedToFlat(r, categories));
  return servicoLookup ? applyServicoLookup(flat, servicoLookup) : flat;
}

/** Valores escritos nos botões de ação da recepção */
export const STATUS_UPDATE = {
  chamar: "Chamado",
  rechamar: "Rechamando",
  finalizar: "Finalizado",
} as const;

/** Rótulo de status na fila: somente aguardando, chamado ou rechamado. */
export function normalizeQueueStatusLabel(
  status: string | null | undefined
): "aguardando" | "chamado" | "rechamado" {
  const s = (status ?? "").trim().toLowerCase();
  if (s.includes("recham")) return "rechamado";
  if (s.includes("chamado") || (s.includes("cham") && !s.includes("aguard"))) return "chamado";
  return "aguardando";
}

export type QueueTabId = "todos" | "ordem" | "hora" | "encaixe" | "prioridade" | "urgente" | "outros";

export const QUEUE_TAB_LABELS: Record<QueueTabId, string> = {
  todos: "Todos",
  ordem: "Ordem de Chegada",
  hora: "Hora Marcada",
  encaixe: "Encaixe",
  prioridade: "Prioridade",
  urgente: "Urgente",
  outros: "Outros",
};

/** Contagem de registros ativos por aba (chave = tab.id). */
export function countActiveByQueueTab(
  rows: AtendimentoLite[],
  tabs: Pick<QueueTabEntry, "id" | "preset">[]
): Record<string, number> {
  const active = rows.filter(isActiveQueueRow);
  const counts: Record<string, number> = {};
  for (const tab of tabs) {
    if (tab.preset === "todos") {
      counts[tab.id] = active.length;
    } else {
      counts[tab.id] = active.filter((r) => rowMatchesQueueTabEntry(r, tab)).length;
    }
  }
  return counts;
}

/** ms desde epoch; fallback +inf para ordenar por último */
export function timeMs(raw: string | null | undefined): number {
  if (!raw) return Number.POSITIVE_INFINITY;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

/** Distância absoluta entre agora e o horário marcado (hoje), em ms — para “perto do horário”. */
export function distanceFromNowMs(horaMarcada: string | null): number {
  if (!horaMarcada) return Number.POSITIVE_INFINITY;
  const t = Date.parse(horaMarcada);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.abs(t - Date.now());
}

export function horaComparable(raw: string | null): number {
  if (!raw) return Number.POSITIVE_INFINITY;
  const ms = Date.parse(raw);
  if (!Number.isNaN(ms)) return ms;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(raw.trim());
  if (m) {
    const d = new Date();
    d.setHours(Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : 0, 0);
    return d.getTime();
  }
  return Number.POSITIVE_INFINITY;
}

export function isFinalizado(row: AtendimentoLite): boolean {
  return (row.status ?? "").trim().toLowerCase() === "finalizado";
}

export function isActiveQueueRow(row: AtendimentoLite): boolean {
  return !isFinalizado(row);
}

export type QueueSortOptions = {
  /** @deprecated Ordenação da fila é sempre por ordem de chegada (created_at). */
  priorityLawEnabled?: boolean;
};

/** Ordem fixa de chegada: created_at asc, desempate por id (estável ao mudar status). */
export function compareQueueArrivalOrder(a: AtendimentoLite, b: AtendimentoLite): number {
  const tc = timeMs(a.created_at) - timeMs(b.created_at);
  if (tc !== 0) return tc;
  return a.id.localeCompare(b.id);
}

/**
 * Filtra finalizados e aplica ordenação da aba.
 * Posição fixa por ordem de chegada (`created_at`, desempate `id`) — mudança de status não reordena.
 */
export function filterAndSortQueue(
  rows: AtendimentoLite[],
  tab: Pick<QueueTabEntry, "id" | "preset">,
  _options?: QueueSortOptions
): AtendimentoLite[] {
  const preset = tab.preset;
  const active =
    preset === "todos"
      ? rows.filter(isActiveQueueRow)
      : rows.filter(isActiveQueueRow).filter((r) => rowMatchesQueueTabEntry(r, tab));
  return [...active].sort(compareQueueArrivalOrder);
}

export function formatHoraMarcada(value: string | null): string {
  if (!value) return "—";
  const ms = Date.parse(value);
  if (!Number.isNaN(ms)) {
    return new Date(ms).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return value;
}

export function formatCreatedAt(value: string | null): string {
  if (!value) return "—";
  const ms = Date.parse(value);
  if (!Number.isNaN(ms)) {
    return new Date(ms).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return value;
}
