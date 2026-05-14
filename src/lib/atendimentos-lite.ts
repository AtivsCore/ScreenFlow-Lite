/** Linha de `public.atendimentos_lite` (formato plano usado na UI) */
export type AtendimentoLite = {
  id: string;
  tenant_id: string | null;
  paciente_id: string | null;
  profissional_id: string | null;
  hora_marcada: string | null;
  status: string | null;
  prioridade: boolean | null;
  observacao: string | null;
  created_at: string | null;
  nome: string | null;
  medicoNome: string | null;
};

/** Resposta do `.select()` com FKs embutidas */
export type AtendimentoLiteNested = {
  id: string;
  tenant_id: string | null;
  paciente_id: string | null;
  profissional_id: string | null;
  hora_marcada: string | null;
  status: string | null;
  prioridade: boolean | null;
  observacao: string | null;
  created_at: string | null;
  pacientes?: { nome: string | null } | { nome: string | null }[] | null;
  profissionais?: { id: string; nome: string | null } | { id: string; nome: string | null }[] | null;
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
    | { id: string; nome: string | null }
    | { id: string; nome: string | null }[]
    | null
    | undefined
): { id: string | null; nome: string | null } {
  if (rel == null) return { id: null, nome: null };
  const one = Array.isArray(rel) ? rel[0] : rel;
  return { id: one?.id ?? null, nome: one?.nome ?? null };
}

/** Converte o retorno do join embutido para o modelo plano da tabela */
export function mapAtendimentoNestedToFlat(row: AtendimentoLiteNested): AtendimentoLite {
  const prof = profissionalRel(row.profissionais);
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    paciente_id: row.paciente_id,
    profissional_id: row.profissional_id ?? prof.id,
    hora_marcada: row.hora_marcada,
    status: row.status,
    prioridade: row.prioridade,
    observacao: row.observacao,
    created_at: row.created_at,
    nome: nomeRelacionamento(row.pacientes),
    medicoNome: prof.nome,
  };
}

/** Valores escritos nos botões de ação da recepção */
export const STATUS_UPDATE = {
  chamar: "Chamado",
  rechamar: "Rechamando",
  finalizar: "Finalizado",
} as const;

export type QueueTabId = "ordem" | "hora" | "encaixe" | "prioridade" | "urgente";

export const QUEUE_TAB_LABELS: Record<QueueTabId, string> = {
  ordem: "Ordem de Chegada",
  hora: "Hora Marcada",
  encaixe: "Encaixe",
  prioridade: "Prioridade",
  urgente: "Urgente",
};

function prioridadeOrdem(p: boolean | null): number {
  return p === true ? 1 : 0;
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

/**
 * Filtra finalizados e aplica ordenação da aba.
 * — Ordem: prioridade desc, depois created_at asc.
 * — Hora: horários marcados primeiro, ordenados pelo mais próximo do momento atual; sem hora vão ao fim.
 * — Encaixe: sem hora_marcada.
 * — Prioridade: só prioritários.
 * — Urgente: prioritários; “urgente” no texto da observação antes; depois horário marcado.
 */
export function filterAndSortQueue(rows: AtendimentoLite[], tab: QueueTabId): AtendimentoLite[] {
  const active = rows.filter(isActiveQueueRow);
  switch (tab) {
    case "ordem":
      return [...active].sort((a, b) => {
        const pd = prioridadeOrdem(b.prioridade) - prioridadeOrdem(a.prioridade);
        if (pd !== 0) return pd;
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
      return [...active]
        .filter((r) => !r.hora_marcada)
        .sort((a, b) => timeMs(a.created_at) - timeMs(b.created_at));
    case "prioridade":
      return [...active]
        .filter((r) => r.prioridade === true)
        .sort((a, b) => timeMs(a.created_at) - timeMs(b.created_at));
    case "urgente":
      return [...active]
        .filter((r) => r.prioridade === true)
        .sort((a, b) => {
          const ua = /\burg(ent)?e?\b/i.test(a.observacao ?? "") ? 1 : 0;
          const ub = /\burg(ent)?e?\b/i.test(b.observacao ?? "") ? 1 : 0;
          if (ub !== ua) return ub - ua;
          return horaComparable(a.hora_marcada) - horaComparable(b.hora_marcada);
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
