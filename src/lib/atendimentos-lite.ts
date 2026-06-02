import { SERVICES_TABLE } from "@/lib/db-tables";
import { prioridadeSortWeight } from "@/lib/classificacao-prioridade";
import { rowMatchesQueueTab } from "@/lib/fila-preset";
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
export function mapAtendimentoNestedToFlat(row: AtendimentoLiteNested): AtendimentoLite {
  const prof = profissionalRel(row.profissionais);
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
  servicoLookup?: Map<string, string | null>
): AtendimentoLite[] {
  const flat = nested.map(mapAtendimentoNestedToFlat);
  return servicoLookup ? applyServicoLookup(flat, servicoLookup) : flat;
}

/** Valores escritos nos botões de ação da recepção */
export const STATUS_UPDATE = {
  chamar: "Chamado",
  rechamar: "Rechamando",
  finalizar: "Finalizado",
} as const;

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
  tabIds: { id: string; preset: QueueTabId }[]
): Record<string, number> {
  const active = rows.filter(isActiveQueueRow);
  const counts: Record<string, number> = {};
  for (const tab of tabIds) {
    if (tab.preset === "todos") {
      counts[tab.id] = active.length;
    } else {
      counts[tab.id] = active.filter((r) => rowMatchesQueueTab(r, tab.preset)).length;
    }
  }
  return counts;
}

function prioridadeOrdemRow(row: AtendimentoLite): number {
  return prioridadeSortWeight(row.classificacao_prioridade, row.prioridade);
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
  /** Quando false, ordenação “Ordem de Chegada” ignora campo de prioridade. */
  priorityLawEnabled?: boolean;
};

/**
 * Filtra finalizados e aplica ordenação da aba.
 * — Ordem: prioridade desc, depois created_at asc.
 * — Hora: horários marcados primeiro, ordenados pelo mais próximo do momento atual; sem hora vão ao fim.
 * — Encaixe: sem hora_marcada.
 * — Prioridade: só prioritários.
 * — Urgente: prioritários; “urgente” no texto da observação antes; depois horário marcado.
 */
export function filterAndSortQueue(
  rows: AtendimentoLite[],
  tab: QueueTabId,
  options?: QueueSortOptions
): AtendimentoLite[] {
  const law = options?.priorityLawEnabled !== false;
  const active =
    tab === "todos"
      ? rows.filter(isActiveQueueRow)
      : rows.filter(isActiveQueueRow).filter((r) => rowMatchesQueueTab(r, tab));
  switch (tab) {
    case "todos":
      return [...active].sort((a, b) => timeMs(a.created_at) - timeMs(b.created_at));
    case "ordem":
      return [...active].sort((a, b) => {
        if (law) {
          const pd = prioridadeOrdemRow(b) - prioridadeOrdemRow(a);
          if (pd !== 0) return pd;
        }
        return timeMs(a.created_at) - timeMs(b.created_at);
      });
    case "hora": {
      const withHora = active.filter((r) => r.hora_marcada);
      const noHora = active.filter((r) => !r.hora_marcada);
      const sortedHora = [...withHora].sort(
        (a, b) => distanceFromNowMs(a.hora_marcada) - distanceFromNowMs(b.hora_marcada)
      );
      const tail = [...noHora].sort((a, b) => timeMs(a.created_at) - timeMs(b.created_at));
      return [...sortedHora, ...tail];
    }
    case "encaixe":
      return [...active].sort((a, b) => timeMs(a.created_at) - timeMs(b.created_at));
    case "prioridade":
      return [...active].sort((a, b) => {
        const pd = prioridadeOrdemRow(b) - prioridadeOrdemRow(a);
        if (pd !== 0) return pd;
        return timeMs(a.created_at) - timeMs(b.created_at);
      });
    case "urgente":
      return [...active].sort((a, b) => {
        const ua = /\burg(ent)?e?\b/i.test(a.observacao ?? "") ? 1 : 0;
        const ub = /\burg(ent)?e?\b/i.test(b.observacao ?? "") ? 1 : 0;
        if (ub !== ua) return ub - ua;
        return horaComparable(a.hora_marcada) - horaComparable(b.hora_marcada);
      });
    case "outros":
      return [...active].sort((a, b) => {
        if (law) {
          const pd = prioridadeOrdemRow(b) - prioridadeOrdemRow(a);
          if (pd !== 0) return pd;
        }
        return timeMs(a.created_at) - timeMs(b.created_at);
      });
    default:
      return active;
  }
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
