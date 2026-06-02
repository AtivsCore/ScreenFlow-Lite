import type { CadastroCategoryEntry, CadastroTableKey } from "@/lib/tenant-config";
import { formatProfissionalLabel, type ProfissionalRow } from "@/lib/profissionais-display";

/** Valores por categoria (chave = cadastroCategories[].id → UUID do item selecionado). */
export type CadastroValores = Record<string, string | null>;

export type CadastroLookups = {
  profissionais: Map<string, string>;
  locais: Map<string, string>;
  servicos: Map<string, string>;
};

export function emptyCadastroValores(): CadastroValores {
  return {};
}

export function parseCadastroValores(raw: unknown): CadastroValores {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: CadastroValores = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
    else if (v === null) out[k] = null;
  }
  return out;
}

/** Mescla JSONB com colunas legadas (primeira categoria ativa de cada tipo). */
export function hydrateCadastroValores(
  jsonb: unknown,
  categories: CadastroCategoryEntry[],
  legacy: {
    profissional_id?: string | null;
    local_id?: string | null;
    especialidade_id?: string | null;
  }
): CadastroValores {
  const base = parseCadastroValores(jsonb);
  const enabled = categories.filter((c) => c.enabled);
  const out: CadastroValores = { ...base };

  for (const key of ["profissionais", "locais", "servicos"] as CadastroTableKey[]) {
    const legacyId =
      key === "profissionais"
        ? legacy.profissional_id
        : key === "locais"
          ? legacy.local_id
          : legacy.especialidade_id;
    if (!legacyId) continue;
    const cats = enabled.filter((c) => c.tableKey === key);
    for (const cat of cats) {
      if (!out[cat.id]) out[cat.id] = legacyId;
    }
  }
  return out;
}

/** Sincroniza colunas FK legadas a partir do JSONB (primeiro valor por tipo). */
export function syncLegacyColumnsFromValores(
  valores: CadastroValores,
  categories: CadastroCategoryEntry[]
): {
  profissional_id: string | null;
  local_id: string | null;
  especialidade_id: string | null;
} {
  const enabled = categories.filter((c) => c.enabled);
  const first = (key: CadastroTableKey) => {
    const cat = enabled.find((c) => c.tableKey === key);
    if (!cat) return null;
    const v = valores[cat.id];
    return v && v.trim() ? v.trim() : null;
  };
  return {
    profissional_id: first("profissionais"),
    local_id: first("locais"),
    especialidade_id: first("servicos"),
  };
}

export function buildCadastroPayload(
  valores: CadastroValores,
  categories: CadastroCategoryEntry[]
): {
  cadastro_valores: CadastroValores;
  profissional_id: string | null;
  local_id: string | null;
  especialidade_id: string | null;
} {
  const cleaned: CadastroValores = {};
  const enabledIds = new Set(categories.filter((c) => c.enabled).map((c) => c.id));
  for (const [k, v] of Object.entries(valores)) {
    if (!enabledIds.has(k)) continue;
    cleaned[k] = v && v.trim() ? v.trim() : null;
  }
  const legacy = syncLegacyColumnsFromValores(cleaned, categories);
  return { cadastro_valores: cleaned, ...legacy };
}

export function resolveCategoryDisplayLabel(
  categoryId: string,
  valores: CadastroValores,
  lookups: CadastroLookups,
  categories: CadastroCategoryEntry[],
  profRows?: ProfissionalRow[]
): string | null {
  const id = valores[categoryId];
  if (!id) return null;
  const cat = categories.find((c) => c.id === categoryId);
  if (!cat) return null;
  switch (cat.tableKey) {
    case "profissionais": {
      const fromMap = lookups.profissionais.get(id);
      if (fromMap) return fromMap;
      const row = profRows?.find((p) => p.id === id);
      return row ? formatProfissionalLabel(row) : id;
    }
    case "locais":
      return lookups.locais.get(id) ?? id;
    case "servicos":
      return lookups.servicos.get(id) ?? id;
    default:
      return id;
  }
}

export function buildCadastroDisplayMap(
  valores: CadastroValores,
  categories: CadastroCategoryEntry[],
  lookups: CadastroLookups,
  profRows?: ProfissionalRow[]
): Record<string, string | null> {
  const enabled = categories.filter((c) => c.enabled);
  const out: Record<string, string | null> = {};
  for (const cat of enabled) {
    out[cat.id] = resolveCategoryDisplayLabel(cat.id, valores, lookups, categories, profRows);
  }
  return out;
}

export function buildCadastroLookups(
  profissionais: ProfissionalRow[],
  locais: { id: string; nome: string | null }[],
  servicos: { id: string; nome: string | null }[]
): CadastroLookups {
  const profMap = new Map<string, string>();
  for (const p of profissionais) profMap.set(p.id, formatProfissionalLabel(p));
  const locMap = new Map<string, string>();
  for (const l of locais) if (l.nome) locMap.set(l.id, l.nome);
  const servMap = new Map<string, string>();
  for (const s of servicos) if (s.nome) servMap.set(s.id, s.nome);
  return { profissionais: profMap, locais: locMap, servicos: servMap };
}
