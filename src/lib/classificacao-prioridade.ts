export type ClassificacaoPrioridade = "normal" | "prioritario" | "emergencia";

export const CLASSIFICACAO_PRIORIDADE_VALUES: ClassificacaoPrioridade[] = [
  "normal",
  "prioritario",
  "emergencia",
];

export const CLASSIFICACAO_PRIORIDADE_LABELS: Record<ClassificacaoPrioridade, string> = {
  normal: "Normal",
  prioritario: "Prioritário",
  emergencia: "Emergência",
};

export function isClassificacaoPrioridade(v: unknown): v is ClassificacaoPrioridade {
  return typeof v === "string" && CLASSIFICACAO_PRIORIDADE_VALUES.includes(v as ClassificacaoPrioridade);
}

export function resolveClassificacaoPrioridade(
  classificacao: string | null | undefined,
  prioridade: boolean | null | undefined
): ClassificacaoPrioridade {
  if (isClassificacaoPrioridade(classificacao)) return classificacao;
  return prioridade === true ? "prioritario" : "normal";
}

export function prioridadeBooleanFromClassificacao(c: ClassificacaoPrioridade): boolean {
  return c !== "normal";
}

/** Peso para ordenação na fila (maior = mais urgente). */
export function prioridadeSortWeight(
  classificacao: string | null | undefined,
  prioridade: boolean | null | undefined
): number {
  const c = classificacao ?? resolveClassificacaoPrioridade(null, prioridade);
  if (c === "emergencia") return 3;
  if (c === "prioritario") return 2;
  return prioridade === true ? 2 : 0;
}

export type ClassificacaoBadgeStyle = {
  label: string;
  badge: string;
  rowAccent: string;
};

export function classificacaoBadgeStyle(
  classificacao: string | null | undefined,
  prioridade: boolean | null | undefined
): ClassificacaoBadgeStyle {
  const c = resolveClassificacaoPrioridade(classificacao ?? null, prioridade);
  switch (c) {
    case "emergencia":
      return {
        label: CLASSIFICACAO_PRIORIDADE_LABELS.emergencia,
        badge:
          "rounded bg-red-600 px-1.5 py-0.5 font-semibold text-white dark:bg-red-700 dark:text-red-50",
        rowAccent: "border-l-4 border-l-red-500",
      };
    case "prioritario":
      return {
        label: CLASSIFICACAO_PRIORIDADE_LABELS.prioritario,
        badge:
          "rounded bg-amber-300 px-1.5 py-0.5 font-semibold text-amber-950 dark:bg-amber-500/90 dark:text-amber-950",
        rowAccent: "border-l-4 border-l-amber-400",
      };
    default:
      return {
        label: CLASSIFICACAO_PRIORIDADE_LABELS.normal,
        badge:
          "rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200",
        rowAccent: "border-l-4 border-l-emerald-400/70",
      };
  }
}

export const CLASSIFICACAO_SELECTOR_OPTIONS: {
  value: ClassificacaoPrioridade;
  label: string;
  activeClass: string;
  idleClass: string;
}[] = [
  {
    value: "normal",
    label: "Normal",
    activeClass: "bg-emerald-600 text-white ring-2 ring-emerald-400/60",
    idleClass:
      "border border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100",
  },
  {
    value: "prioritario",
    label: "Prioritário",
    activeClass: "bg-amber-400 text-amber-950 ring-2 ring-amber-300/70",
    idleClass:
      "border border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
  },
  {
    value: "emergencia",
    label: "Emergência",
    activeClass: "bg-red-600 text-white ring-2 ring-red-400/60",
    idleClass:
      "border border-red-300 bg-red-50 text-red-900 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100",
  },
];
