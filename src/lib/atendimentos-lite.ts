/** Linha de `public.atendimentos_lite` (formato plano usado na UI) */
export type AtendimentoLite = {
  id: string;
  nome: string | null;
  documento: string | null;
  prioridade: boolean | null;
  hora_marcada: string | null;
  status: string | null;
  medico: string | null;
  local: string | null;
};

/** Resposta do `.select()` com FKs embutidas */
export type AtendimentoLiteNested = {
  id: string;
  status: string | null;
  prioridade: boolean | null;
  hora_marcada: string | null;
  pacientes?: { nome: string | null } | { nome: string | null }[] | null;
  profissionais?: { nome: string | null } | { nome: string | null }[] | null;
  locais?: { nome: string | null } | { nome: string | null }[] | null;
};

function nomeRelacionamento(
  rel: { nome: string | null } | { nome: string | null }[] | null | undefined
): string | null {
  if (rel == null) return null;
  if (Array.isArray(rel)) return rel[0]?.nome ?? null;
  return rel.nome ?? null;
}

/** Converte o retorno do join embutido para o modelo plano da tabela */
export function mapAtendimentoNestedToFlat(row: AtendimentoLiteNested): AtendimentoLite {
  return {
    id: row.id,
    nome: nomeRelacionamento(row.pacientes),
    documento: null,
    prioridade: row.prioridade,
    hora_marcada: row.hora_marcada,
    status: row.status,
    medico: nomeRelacionamento(row.profissionais),
    local: nomeRelacionamento(row.locais),
  };
}

/** Valores escritos nos botões de ação da recepção */
export const STATUS_UPDATE = {
  chamar: "Chamado",
  rechamar: "Rechamando",
  finalizar: "Finalizado",
} as const;

function prioridadeOrdem(p: boolean | null): number {
  return p === true ? 1 : 0;
}

function horaComparable(raw: string | null): number {
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

/** prioridade === true primeiro; em seguida hora_marcada crescente */
export function sortAtendimentosLite(rows: AtendimentoLite[]): AtendimentoLite[] {
  return [...rows].sort((a, b) => {
    const pd = prioridadeOrdem(b.prioridade) - prioridadeOrdem(a.prioridade);
    if (pd !== 0) return pd;
    return horaComparable(a.hora_marcada) - horaComparable(b.hora_marcada);
  });
}

export function formatHoraMarcada(value: string | null): string {
  if (!value) return "—";
  const ms = Date.parse(value);
  if (!Number.isNaN(ms)) {
    return new Date(ms).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return value;
}
