import type { CadastroCategoryEntry, CadastroTableKey } from "@/lib/tenant-config";
import { formatProfissionalLabel, type ProfissionalRow } from "@/lib/profissionais-display";

/** Valores por categoria (chave = cadastroCategories[].id → UUID do item selecionado). */
export type CadastroValores = Record<string, string | null>;

export type CadastroLookups = {
  profissionais: Map<string, string>;
  locais: Map<string, string>;
  servicos: Map<string, string>;
};

/** Contexto legado da linha para fallback de exibição (joins e FKs). */
export type CadastroLegacyContext = {
  profissional_id?: string | null;
  local_id?: string | null;
  especialidade_id?: string | null;
  profissionalNome?: string | null;
  localNome?: string | null;
  servicoNome?: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function legacyIdForTableKey(key: CadastroTableKey, legacy?: CadastroLegacyContext): string | null {
  if (!legacy) return null;
  if (key === "profissionais") return legacy.profissional_id?.trim() || null;
  if (key === "locais") return legacy.local_id?.trim() || null;
  return legacy.especialidade_id?.trim() || null;
}

function legacyNomeForTableKey(key: CadastroTableKey, legacy?: CadastroLegacyContext): string | null {
  if (!legacy) return null;
  if (key === "profissionais") return legacy.profissionalNome?.trim() || null;
  if (key === "locais") return legacy.localNome?.trim() || null;
  return legacy.servicoNome?.trim() || null;
}

function resolveEntityLabel(
  tableKey: CadastroTableKey,
  entityId: string,
  lookups: CadastroLookups,
  profRows?: ProfissionalRow[]
): string | null {
  switch (tableKey) {
    case "profissionais": {
      const fromMap = lookups.profissionais.get(entityId);
      if (fromMap) return fromMap;
      const row = profRows?.find((p) => p.id === entityId);
      return row ? formatProfissionalLabel(row) : null;
    }
    case "locais":
      return lookups.locais.get(entityId) ?? null;
    case "servicos":
      return lookups.servicos.get(entityId) ?? null;
    default:
      return null;
  }
}

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
    if (cats.length === 1 && legacyId) {
      out[cats[0]!.id] = legacyId;
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
  profRows?: ProfissionalRow[],
  legacy?: CadastroLegacyContext
): string | null {
  const cat = categories.find((c) => c.id === categoryId);
  if (!cat) return null;

  let entityId = valores[categoryId]?.trim() || null;
  if (!entityId) {
    entityId = legacyIdForTableKey(cat.tableKey, legacy);
  }
  if (!entityId) return null;

  const fromLookup = resolveEntityLabel(cat.tableKey, entityId, lookups, profRows);
  if (fromLookup) return fromLookup;

  const legId = legacyIdForTableKey(cat.tableKey, legacy);
  const legNome = legacyNomeForTableKey(cat.tableKey, legacy);
  if (legId && legNome && entityId === legId) return legNome;
  if (legId && legNome) {
    const legLabel = resolveEntityLabel(cat.tableKey, legId, lookups, profRows);
    if (legLabel) return legLabel;
    return legNome;
  }

  if (UUID_RE.test(entityId)) return null;
  return entityId;
}

export function buildCadastroDisplayMap(
  valores: CadastroValores,
  categories: CadastroCategoryEntry[],
  lookups: CadastroLookups,
  profRows?: ProfissionalRow[],
  legacy?: CadastroLegacyContext
): Record<string, string | null> {
  const enabled = categories.filter((c) => c.enabled);
  const out: Record<string, string | null> = {};
  for (const cat of enabled) {
    out[cat.id] = resolveCategoryDisplayLabel(cat.id, valores, lookups, categories, profRows, legacy);
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
  for (const l of locais) locMap.set(l.id, l.nome?.trim() || "—");
  const servMap = new Map<string, string>();
  for (const s of servicos) servMap.set(s.id, s.nome?.trim() || "—");
  return { profissionais: profMap, locais: locMap, servicos: servMap };
}
