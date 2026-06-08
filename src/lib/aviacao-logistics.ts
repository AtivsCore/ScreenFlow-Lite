import {
  buildCadastroPayload,
  resolveCategoryDisplayLabel,
  type CadastroLegacyContext,
  type CadastroLookups,
  type CadastroValores,
} from "@/lib/cadastro-valores";
import {
  AVIACAO_SEGMENT_ID,
  AUTOMOTIVO_SEGMENT_ID,
  buildMroCanonicalQueueTabs,
  isAutomotivoSegment,
  isMroLogisticsSegment,
  resolveMroProfile,
  type MroSegmentProfile,
} from "@/lib/mro-segment-profile";
import {
  embedFilaPreset,
  formatObservacaoForDisplay,
  parseFilaTabId,
  parseFilaPreset,
} from "@/lib/fila-preset";
import { STATUS_UPDATE, type QueueTabId } from "@/lib/atendimentos-lite";
import { SERVICES_CRUD_TABLE } from "@/lib/db-tables";
import { formatProfissionalLabel, type ProfissionalRow } from "@/lib/profissionais-display";
import type {
  CadastroCategoryEntry,
  QueueTabEntry,
  RegisterFormConfig,
  ResolvedTenantConfig,
} from "@/lib/tenant-config";
import { TODOS_QUEUE_TAB } from "@/lib/tenant-config";
import type { AtendimentoLite } from "@/lib/atendimentos-lite";

export {
  AVIACAO_SEGMENT_ID,
  AUTOMOTIVO_SEGMENT_ID,
  AUTOMOTIVO_QUEUE_TAB,
  isAutomotivoSegment,
  isMroLogisticsSegment,
  resolveMroProfile,
} from "@/lib/mro-segment-profile";

export const AVIACAO_HANGAR_UNALLOCATED_LABEL = "NÃO ALOCADO";

/** IDs estáveis das 7 colunas do fluxo MRO (marcador `__sf_fila:tab:…__`). */
export const AVIACAO_QUEUE_TAB = {
  TRIAGEM: "triagem",
  EM_MANUTENCAO: "em_manutencao",
  AGUARDANDO_PECAS: "aguardando_pecas",
  INSPECAO_QC: "inspecao_qc",
  TESTE_VOO: "teste_voo",
  ESTETICA_LAVAGEM: "estetica_lavagem",
  LIBERADO: "liberado",
} as const;

export type AviacaoQueueTabId = (typeof AVIACAO_QUEUE_TAB)[keyof typeof AVIACAO_QUEUE_TAB];

export const AVIACAO_PIPELINE_ORDER: readonly AviacaoQueueTabId[] = [
  AVIACAO_QUEUE_TAB.TRIAGEM,
  AVIACAO_QUEUE_TAB.EM_MANUTENCAO,
  AVIACAO_QUEUE_TAB.AGUARDANDO_PECAS,
  AVIACAO_QUEUE_TAB.INSPECAO_QC,
  AVIACAO_QUEUE_TAB.TESTE_VOO,
  AVIACAO_QUEUE_TAB.ESTETICA_LAVAGEM,
  AVIACAO_QUEUE_TAB.LIBERADO,
];

export const AVIACAO_STEP_LABELS: Record<AviacaoQueueTabId, string> = {
  [AVIACAO_QUEUE_TAB.TRIAGEM]: "TRIAGEM / CHECK-IN",
  [AVIACAO_QUEUE_TAB.EM_MANUTENCAO]: "EM MANUTENÇÃO",
  [AVIACAO_QUEUE_TAB.AGUARDANDO_PECAS]: "AGUARDANDO PEÇAS",
  [AVIACAO_QUEUE_TAB.INSPECAO_QC]: "INSPEÇÃO / QC",
  [AVIACAO_QUEUE_TAB.TESTE_VOO]: "TESTE DE VOO",
  [AVIACAO_QUEUE_TAB.ESTETICA_LAVAGEM]: "ESTÉTICA / LAVAGEM",
  [AVIACAO_QUEUE_TAB.LIBERADO]: "LIBERADO / PRONTO",
};

/** Campos inline extras na tag `__sf_aviacao:` (MRO). */
export const AVIACAO_FIELD_HOBBS = "av-hobbs" as const;
export const AVIACAO_FIELD_COMBUSTIVEL = "av-comb" as const;
export const AVIACAO_FIELD_SERVICOS = "av-svc" as const;
export const AVIACAO_FIELD_ANEXOS = "av-anex" as const;
export const AVIACAO_FIELD_TIMELINE = "av-tml" as const;

export const AVIACAO_EXTENDED_INLINE_FIELD_IDS = [
  AVIACAO_FIELD_HOBBS,
  AVIACAO_FIELD_COMBUSTIVEL,
  AVIACAO_FIELD_SERVICOS,
  AVIACAO_FIELD_ANEXOS,
  AVIACAO_FIELD_TIMELINE,
] as const;

export const AVIACAO_COMBUSTIVEL_OPTIONS = ["Vazio", "1/4", "1/2", "3/4", "Full"] as const;
export type AviacaoCombustivelLevel = (typeof AVIACAO_COMBUSTIVEL_OPTIONS)[number];

export const AVIACAO_STORAGE_BUCKET = "aviacao-anexos" as const;

/** Limite de bases/aeroportos no plano gratuito (MRO). */
export const AVIACAO_FREE_BASE_LIMIT = 1;

export const AVIACAO_BASE_LIMIT_UPSELL_TITLE =
  "Limite do plano gratuito (1 Base)" as const;

export const AVIACAO_BASE_LIMIT_UPSELL_DESCRIPTION =
  "Você atingiu o limite do plano gratuito (1 Base). O gerenciamento de múltiplas bases, aeroportos e hangares centralizados está disponível apenas no Plano PRO. Assine o plano PRO ou fale com o suporte para expandir sua operação!" as const;

/**
 * Plano gratuito: permite cadastrar a primeira base (count 0).
 * A partir da segunda base (count ≥ 1 ao tentar criar nova), exige PRO.
 */
export function canCreateAviacaoBase(tenantCount: number, proActive = false): boolean {
  if (proActive) return true;
  return tenantCount < AVIACAO_FREE_BASE_LIMIT;
}

export const AVIACAO_HANGAR_TAG_WIDTH_CLASS = "w-[10.5rem]";

/** Responsável / mecânico — texto livre inline na tag `__sf_aviacao:`. */
export const AVIACAO_RESPONSAVEL_CATEGORY_ID = "av-c1" as const;

/** Campos com `<select>` fixo (UUID em `cadastro_valores`) — somente hangar/box. */
export const AVIACAO_RIGID_SELECT_FIELD_IDS = ["av-c2"] as const;

/** Prefixo da aeronave — texto livre (obrigatório no formulário MRO). */
export const AVIACAO_PREFIXO_CATEGORY_ID = "av-c3" as const;

/** Modelo da aeronave — texto livre opcional. */
export const AVIACAO_MODELO_CATEGORY_ID = "av-c4" as const;

/** Urgência da peça — texto livre opcional inline na tag `__sf_aviacao:`. */
export const AVIACAO_INLINE_OBSERVACAO_FIELD_ID = "av-c5" as const;

/** Campos de texto livre salvos inline (prefixo, modelo). */
export const AVIACAO_FREE_TEXT_FIELD_IDS = [
  AVIACAO_PREFIXO_CATEGORY_ID,
  AVIACAO_MODELO_CATEGORY_ID,
] as const;

/** Texto livre inline (sem datalist) — opcionais no formulário MRO. */
export const AVIACAO_INLINE_TEXT_FIELD_IDS = [
  AVIACAO_RESPONSAVEL_CATEGORY_ID,
  AVIACAO_INLINE_OBSERVACAO_FIELD_ID,
] as const;

/** Ordem no painel superior (Prefixo → Modelo → Hangar). */
export const AVIACAO_PANEL_FIELD_ORDER = ["av-c3", "av-c4", "av-c2"] as const;

export const AVIACAO_PREFIXO_DATALIST_ID = "sf-aviacao-prefixo-suggestions" as const;
export const AVIACAO_MODELO_DATALIST_ID = "sf-aviacao-modelo-suggestions" as const;
export const AVIACAO_PREFIXO_MODAL_DATALIST_ID = "sf-aviacao-prefixo-suggestions-modal" as const;
export const AVIACAO_MODELO_MODAL_DATALIST_ID = "sf-aviacao-modelo-suggestions-modal" as const;

const AVIACAO_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Gavetas virtuais isoladas por slot de formulário.
 * Categorias 3–5 compartilham a tabela física `servicos`, mas com buckets de `ordem` distintos.
 */
export type AviacaoDrawerKey =
  | "profissionais"
  | "locais"
  | "servicos_operacionais"
  | "servicos_prefixo"
  | "categoria_custom_4"
  | "categoria_custom_5";

/** Slot virtual para CRUD de serviços operacionais (Manutenção, Estética, CVA…). */
export const AVIACAO_SERVICOS_SOLICITADOS_CRUD_FIELD_ID = "av-svc-op" as const;

export const AVIACAO_FIELD_DRAWER_KEY: Record<string, AviacaoDrawerKey> = {
  "av-c1": "profissionais",
  "av-c2": "locais",
  "av-c3": "servicos_prefixo",
  "av-c4": "categoria_custom_4",
  "av-c5": "categoria_custom_5",
  [AVIACAO_SERVICOS_SOLICITADOS_CRUD_FIELD_ID]: "servicos_operacionais",
};

export const AVIACAO_DRAWER_SERVICOS_BUCKET: Partial<
  Record<AviacaoDrawerKey, { min: number; max: number }>
> = {
  servicos_operacionais: { min: 0, max: 99_999 },
  servicos_prefixo: { min: 100_000, max: 199_999 },
  categoria_custom_4: { min: 200_000, max: 299_999 },
  categoria_custom_5: { min: 300_000, max: 399_999 },
};

/** Hangar / box (select UUID em `locais`). */
export const AVIACAO_HANGAR_CATEGORY_ID = "av-c2";

/** Categorias ocultas no painel superior do cliente (aviacao_mro). */
export const AVIACAO_CLIENT_PANEL_HIDDEN_CATEGORY_IDS = ["av-c1", "av-c5"] as const;

/** Rótulos fixos no painel superior (independente de customização salva no tenant). */
export const AVIACAO_CATEGORY_DISPLAY_LABELS: Partial<Record<string, string>> = {
  "av-c1": "Responsável / Mecânico",
  "av-c2": "Vaga / Hangar / Box Alocado",
  "av-c3": "Prefixo da Aeronave",
  "av-c4": "Modelo da Aeronave",
  "av-c5": "Urgência da Peça",
};

export type AviacaoQuickCrudKind = "hangar" | "servicos" | "base";

export type AviacaoQuickCrudConfig = {
  title: string;
  table: string;
  categoryId?: string;
};

/** Configuração canônica dos atalhos de cadastro rápido ao lado da fila (MRO). */
export function resolveAviacaoQuickCrudConfig(
  kind: AviacaoQuickCrudKind,
  segmentoAplicado?: string | null
): AviacaoQuickCrudConfig {
  const profile = mroProfileFor(segmentoAplicado);
  switch (kind) {
    case "hangar":
      return {
        title: profile.hangarQuickCrudTitle,
        table: "locais",
        categoryId: AVIACAO_HANGAR_CATEGORY_ID,
      };
    case "servicos":
      return {
        title: "Serviços",
        table: SERVICES_CRUD_TABLE,
        categoryId: AVIACAO_SERVICOS_SOLICITADOS_CRUD_FIELD_ID,
      };
    case "base":
      return { title: profile.baseQuickCrudTitle, table: "tenants" };
  }
}

const AVIACAO_OBSERVACAO_CLINIC_RESIDUAL_RE =
  /\b(?:Medical\s+Dark\s+Mode|Acessibilidade(?:\s+Visual)?|Modo\s+Escuro\s+Médico)\b/gi;

/** Tags técnicas que não devem vazar no card (inclui ids com `_`, ex.: `aguardando_peca`). */
const AVIACAO_FILA_TAG_RE = /__sf_fila:[\s\S]*?__/gi;
const AVIACAO_RAW_TAG_LEAK_RE = /__sf_(?:fila|aviacao|docas):/i;

/** Campos estruturais obrigatórios no Novo Registro e na Edição (MRO). */
export const AVIACAO_REGISTRY_REQUIRED_FIELD_IDS = [
  AVIACAO_PREFIXO_CATEGORY_ID,
  AVIACAO_HANGAR_CATEGORY_ID,
  AVIACAO_FIELD_HOBBS,
  AVIACAO_FIELD_COMBUSTIVEL,
  AVIACAO_FIELD_SERVICOS,
] as const;

export const AVIACAO_REQUIRED_CATEGORY_IDS = ["av-c3", AVIACAO_FIELD_HOBBS, AVIACAO_FIELD_COMBUSTIVEL] as const;

export type AviacaoRegisterFieldVisibility = {
  showHangar: boolean;
  showServicos: boolean;
};

export function resolveAviacaoRegisterFieldVisibility(
  rf: RegisterFormConfig,
  categories: CadastroCategoryEntry[]
): {
  showClienteNome: boolean;
  showProfissional: boolean;
  showServicos: boolean;
  showHangar: boolean;
  showHoraMarcada: boolean;
  showObservacao: boolean;
  showModelo: boolean;
  showUrgencia: boolean;
} {
  const catEnabled = (id: string) => categories.some((c) => c.id === id && c.enabled);
  return {
    showClienteNome: rf.showClienteNome,
    showProfissional: rf.showProfissional,
    showServicos: rf.showServico,
    showHangar: rf.showLocal,
    showHoraMarcada: rf.showHoraMarcada,
    showObservacao: rf.showObservacao,
    showModelo: rf.showModelo ?? catEnabled(AVIACAO_MODELO_CATEGORY_ID),
    showUrgencia: rf.showUrgencia ?? catEnabled(AVIACAO_INLINE_OBSERVACAO_FIELD_ID),
  };
}

export function validateAviacaoRequiredFormValues(
  formValues: Record<string, string>,
  visibility: AviacaoRegisterFieldVisibility = { showHangar: true, showServicos: true },
  segmentoAplicado?: string | null
): string | null {
  const validation = mroProfileFor(segmentoAplicado).validation;
  if (!formValues[AVIACAO_PREFIXO_CATEGORY_ID]?.trim()) {
    return validation.prefixoRequired;
  }
  if (visibility.showHangar && !formValues[AVIACAO_HANGAR_CATEGORY_ID]?.trim()) {
    return validation.hangarRequired;
  }
  if (!formValues[AVIACAO_FIELD_HOBBS]?.trim()) {
    return validation.hobbsRequired;
  }
  if (!formValues[AVIACAO_FIELD_COMBUSTIVEL]?.trim()) {
    return validation.combustivelRequired;
  }
  if (
    visibility.showServicos &&
    parseAviacaoServicosSolicitados(formValues[AVIACAO_FIELD_SERVICOS]).length === 0
  ) {
    return validation.servicosRequired;
  }
  return null;
}

export const AVIACAO_DATA_TAG_RE = /__sf_aviacao:[\s\S]*?__/gi;

const AVIACAO_DATA_PARSE = /__sf_aviacao:([\s\S]*?)__/i;

/** Migração do fluxo legado de 5 colunas para o MRO de 7 colunas. */
const LEGACY_TAB_ALIASES: Record<string, AviacaoQueueTabId> = {
  "av-t1": AVIACAO_QUEUE_TAB.TRIAGEM,
  "av-t2": AVIACAO_QUEUE_TAB.EM_MANUTENCAO,
  "av-t3": AVIACAO_QUEUE_TAB.INSPECAO_QC,
  "av-t4": AVIACAO_QUEUE_TAB.TESTE_VOO,
  "av-t5": AVIACAO_QUEUE_TAB.LIBERADO,
  aguardando_peca: AVIACAO_QUEUE_TAB.EM_MANUTENCAO,
  em_execucao: AVIACAO_QUEUE_TAB.INSPECAO_QC,
};

export type AviacaoTimelineEntry = {
  ts: string;
  action: string;
  user: string;
  detail?: string;
};

export type AviacaoAnexo = {
  id: string;
  name: string;
  mime: string;
  uploadedAt: string;
  url: string;
};

/** Anexo gravado no bucket Supabase (URL pública), não preview local em data URL. */
export function isAviacaoAnexoStoredInBucket(anexo: AviacaoAnexo): boolean {
  return anexo.url.startsWith("http://") || anexo.url.startsWith("https://");
}

export function isSupabaseStorageRlsError(message: string | undefined | null): boolean {
  if (!message) return false;
  return /row-level security/i.test(message);
}

export type AviacaoQueueFilterOptions = {
  priorityOnly?: boolean;
  hideAguardandoPecas?: boolean;
  hangarIds?: string[];
};

export function isAviacaoSegment(segmentoAplicado: string | null | undefined): boolean {
  return segmentoAplicado === AVIACAO_SEGMENT_ID;
}

function mroProfileFor(segmentoAplicado?: string | null): MroSegmentProfile {
  return resolveMroProfile(segmentoAplicado ?? AVIACAO_SEGMENT_ID);
}

export function looksLikeAviacaoUuid(value: string | null | undefined): boolean {
  return !!value?.trim() && AVIACAO_UUID_RE.test(value.trim());
}

/** Select fixo por slot (sem texto livre). */
export function isAviacaoRigidSelectField(categoryId: string): boolean {
  return (AVIACAO_RIGID_SELECT_FIELD_IDS as readonly string[]).includes(categoryId);
}

/** Texto livre com datalist opcional (buckets 100k / 200k). */
export function isAviacaoFreeTextField(categoryId: string): boolean {
  return (AVIACAO_FREE_TEXT_FIELD_IDS as readonly string[]).includes(categoryId);
}

/** Texto livre inline na tag `__sf_aviacao:` (ex.: Responsável / Mecânico). */
export function isAviacaoInlineTextField(categoryId: string): boolean {
  return (AVIACAO_INLINE_TEXT_FIELD_IDS as readonly string[]).includes(categoryId);
}

/** @deprecated Use `isAviacaoFreeTextField`. */
export function isAviacaoPrefixoFreeTextField(categoryId: string): boolean {
  return isAviacaoFreeTextField(categoryId);
}

export function sortAviacaoPanelCategories(
  categories: CadastroCategoryEntry[]
): CadastroCategoryEntry[] {
  return [...categories].sort((a, b) => {
    const ia = (AVIACAO_PANEL_FIELD_ORDER as readonly string[]).indexOf(a.id);
    const ib = (AVIACAO_PANEL_FIELD_ORDER as readonly string[]).indexOf(b.id);
    const ra = ia >= 0 ? ia : AVIACAO_PANEL_FIELD_ORDER.length;
    const rb = ib >= 0 ? ib : AVIACAO_PANEL_FIELD_ORDER.length;
    if (ra !== rb) return ra - rb;
    return 0;
  });
}

/** Hangar / box: alias de select rígido. */
export function isAviacaoHangarSelectField(categoryId: string): boolean {
  return categoryId === AVIACAO_HANGAR_CATEGORY_ID;
}

/** MRO: urgência é sempre texto livre (sem select travado). */
export function isAviacaoUrgenciaSelectMode(_servicos?: AviacaoLookupRow[]): boolean {
  return false;
}

export function isAviacaoObservacaoInlineField(
  categoryId: string,
  _servicos?: AviacaoLookupRow[]
): boolean {
  if (isAviacaoFreeTextField(categoryId)) return true;
  if (isAviacaoInlineTextField(categoryId)) return true;
  return categoryId === AVIACAO_INLINE_OBSERVACAO_FIELD_ID;
}

/** @deprecated Use `isAviacaoObservacaoInlineField` / `isAviacaoRigidSelectField`. */
export function isAviacaoTextField(categoryId: string): boolean {
  return categoryId === AVIACAO_INLINE_OBSERVACAO_FIELD_ID;
}

/** Slots da aviação com partição por bucket em `servicos` no CRUD global. */
export function isAviacaoBucketManagedField(categoryId: string): boolean {
  const drawer = resolveAviacaoDrawerKey(categoryId);
  return !!drawer && isAviacaoDrawerServicosBacked(drawer);
}

export function resolveAviacaoDrawerKey(fieldId: string): AviacaoDrawerKey | null {
  return AVIACAO_FIELD_DRAWER_KEY[fieldId] ?? null;
}

export function isAviacaoDrawerServicosBacked(drawer: AviacaoDrawerKey): boolean {
  return drawer in AVIACAO_DRAWER_SERVICOS_BUCKET;
}

export function filterServicosForAviacaoDrawer(
  drawer: AviacaoDrawerKey,
  servicos: AviacaoLookupRow[]
): AviacaoLookupRow[] {
  const bucket = AVIACAO_DRAWER_SERVICOS_BUCKET[drawer];
  if (!bucket) {
    return servicos.filter((s) => (s.ordem ?? 0) < 100_000);
  }
  return servicos.filter((s) => {
    const ordem = s.ordem ?? 0;
    return ordem >= bucket.min && ordem <= bucket.max;
  });
}

export function resolveAviacaoCrudTable(fieldId: string): string {
  const drawer = resolveAviacaoDrawerKey(fieldId);
  if (drawer === "profissionais") return "profissionais";
  if (drawer === "locais") return "locais";
  if (drawer && isAviacaoDrawerServicosBacked(drawer)) return SERVICES_CRUD_TABLE;
  return SERVICES_CRUD_TABLE;
}

export function filterAviacaoCrudRowsByField(
  fieldId: string,
  table: string,
  rows: AviacaoLookupRow[]
): AviacaoLookupRow[] {
  const drawer = resolveAviacaoDrawerKey(fieldId);
  if (!drawer) return rows;

  if (table === "profissionais" || table === "profissionais_lite") {
    return drawer === "profissionais" ? rows : [];
  }
  if (table === "locais") {
    return drawer === "locais" ? rows : [];
  }
  if (table.includes("servico") || table === "servicos") {
    if (isAviacaoDrawerServicosBacked(drawer)) {
      return filterServicosForAviacaoDrawer(drawer, rows);
    }
    return drawer === "profissionais" || drawer === "locais" ? [] : rows;
  }
  return rows;
}

export function nextAviacaoDrawerServicosOrdem(
  fieldId: string,
  existingRows: AviacaoLookupRow[]
): number | null {
  const drawer = resolveAviacaoDrawerKey(fieldId);
  if (!drawer || !isAviacaoDrawerServicosBacked(drawer)) return null;
  const bucket = AVIACAO_DRAWER_SERVICOS_BUCKET[drawer];
  if (!bucket) return null;
  const inBucket = existingRows.filter((s) => {
    const ordem = s.ordem ?? 0;
    return ordem >= bucket.min && ordem <= bucket.max;
  });
  const maxOrdem = inBucket.reduce(
    (max, row) => Math.max(max, row.ordem ?? bucket.min - 1),
    bucket.min - 1
  );
  return Math.min(maxOrdem + 1, bucket.max);
}

export function resolveAviacaoCategoryLabel(
  cat: Pick<CadastroCategoryEntry, "id" | "label">,
  segmentoAplicado?: string | null
): string {
  const saved = cat.label?.trim();
  if (saved) return saved;
  const profile = mroProfileFor(segmentoAplicado);
  return profile.categoryDisplayLabels[cat.id] ?? AVIACAO_CATEGORY_DISPLAY_LABELS[cat.id] ?? cat.label;
}

export type AviacaoComboboxOption = { id: string; label: string };

export type AviacaoLookupRow = {
  id: string;
  nome: string | null;
  ordem?: number | null;
  especialidade?: string | null;
};

/** Rótulos canônicos dos campos híbridos — usados para resolver a categoria ativa no tenant. */
const AVIACAO_HYBRID_FIELD_CANONICAL_LABELS: Record<string, readonly string[]> = {
  "av-c1": ["Responsável / Mecânico"],
  "av-c3": ["Prefixo da Aeronave"],
  "av-c4": ["Modelo da Aeronave"],
};

function normalizeCategoryLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Resolve a categoria configurada no tenant para um slot fixo do formulário (ex.: `av-c3`). */
export function findAviacaoCategoryForField(
  fieldId: string,
  categories: CadastroCategoryEntry[],
  segmentoAplicado?: string | null
): CadastroCategoryEntry | undefined {
  const enabled = categories.filter((c) => c.enabled);
  const byId = enabled.find((c) => c.id === fieldId);
  if (byId) return byId;

  const profile = mroProfileFor(segmentoAplicado);
  const canonical =
    profile.hybridFieldCanonicalLabels[fieldId] ?? AVIACAO_HYBRID_FIELD_CANONICAL_LABELS[fieldId];
  if (!canonical) return undefined;

  const targets = new Set(canonical.map(normalizeCategoryLabel));
  return enabled.find((c) => {
    const labels = [c.label, resolveAviacaoCategoryLabel(c, segmentoAplicado)].map(
      normalizeCategoryLabel
    );
    return labels.some((l) => targets.has(l));
  });
}

/** Opções do `<select>` rígido pela gaveta virtual isolada do slot. */
export function resolveAviacaoSelectOptions(
  fieldId: string,
  lookups: {
    profissionais: AviacaoLookupRow[];
    locais: AviacaoLookupRow[];
    servicos: AviacaoLookupRow[];
  }
): Array<{ id: string; nome: string | null }> {
  const drawer = resolveAviacaoDrawerKey(fieldId);
  if (!drawer) return [];

  const toOptions = (
    rows: AviacaoLookupRow[],
    labelFor?: (row: AviacaoLookupRow) => string
  ): Array<{ id: string; nome: string | null }> => {
    const seen = new Set<string>();
    const out: Array<{ id: string; nome: string | null }> = [];
    for (const row of rows) {
      const nome = (labelFor?.(row) ?? row.nome ?? row.id).trim();
      if (!nome) continue;
      const key = nome.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ id: row.id, nome });
    }
    return out;
  };

  switch (drawer) {
    case "profissionais":
      return toOptions(lookups.profissionais, (row) =>
        formatProfissionalLabel(row as ProfissionalRow)
      );
    case "locais":
      return toOptions(lookups.locais);
    case "servicos_prefixo":
    case "categoria_custom_4":
    case "categoria_custom_5":
      return toOptions(filterServicosForAviacaoDrawer(drawer, lookups.servicos));
    default:
      return [];
  }
}

/** @deprecated Use `resolveAviacaoSelectOptions`. */
export function resolveAviacaoComboboxOptions(
  fieldId: string,
  _categories: CadastroCategoryEntry[],
  lookups: {
    profissionais: AviacaoLookupRow[];
    locais: AviacaoLookupRow[];
    servicos: AviacaoLookupRow[];
  }
): AviacaoComboboxOption[] {
  return resolveAviacaoSelectOptions(fieldId, lookups).map((o) => ({
    id: o.id,
    label: o.nome ?? o.id,
  }));
}

export function hydrateAviacaoFreeTextValue(
  categoryId: string,
  cadastroValores: CadastroValores,
  observacao: string | null | undefined,
  options: Array<{ id: string; nome: string | null }>
): string {
  const resolveLabel = (raw: string): string => {
    if (!looksLikeAviacaoUuid(raw)) return raw;
    const match = options.find((o) => o.id === raw);
    return match?.nome?.trim() ?? "";
  };

  const inline = parseAviacaoCadastroFields(observacao)[categoryId]?.trim();
  if (inline) return resolveLabel(inline);

  const stored = cadastroValores[categoryId]?.trim();
  if (!stored) return "";
  return resolveLabel(stored);
}

/** @deprecated Use `hydrateAviacaoFreeTextValue`. */
export function hydrateAviacaoPrefixoValue(
  cadastroValores: CadastroValores,
  observacao: string | null | undefined,
  options: Array<{ id: string; nome: string | null }>
): string {
  return hydrateAviacaoFreeTextValue(
    AVIACAO_PREFIXO_CATEGORY_ID,
    cadastroValores,
    observacao,
    options
  );
}

/** Hidrata o `<select>` de hangar considerando `local_id` legado e `cadastro_valores`. */
export function hydrateAviacaoHangarSelectValue(
  row: Pick<AtendimentoLite, "observacao" | "cadastro_valores" | "local_id">,
  options: Array<{ id: string; nome: string | null }>
): string {
  const fromRow = resolveAviacaoHangarIdFromRow(row);
  if (fromRow) return fromRow;
  return hydrateAviacaoFormValue(
    AVIACAO_HANGAR_CATEGORY_ID,
    row.cadastro_valores ?? {},
    row.observacao,
    options
  );
}

/** Hidrata o nome do mecânico/responsável (texto livre ou legado de profissional). */
export function hydrateAviacaoResponsavelValue(
  cadastroValores: CadastroValores,
  observacao: string | null | undefined,
  profissionalNome?: string | null
): string {
  const inline = parseAviacaoCadastroFields(observacao)[AVIACAO_RESPONSAVEL_CATEGORY_ID]?.trim();
  if (inline && !looksLikeAviacaoUuid(inline)) return inline;
  const stored = cadastroValores[AVIACAO_RESPONSAVEL_CATEGORY_ID]?.trim();
  if (stored && !looksLikeAviacaoUuid(stored)) return stored;
  return profissionalNome?.trim() ?? "";
}

export function hydrateAviacaoFormValue(
  categoryId: string,
  cadastroValores: CadastroValores,
  observacao: string | null | undefined,
  options: Array<{ id: string; nome: string | null }>,
  opts?: { allowFreeText?: boolean }
): string {
  const stored = cadastroValores[categoryId]?.trim();
  if (stored) return stored;

  const legacy = parseAviacaoCadastroFields(observacao)[categoryId]?.trim();
  if (!legacy) return "";

  if (looksLikeAviacaoUuid(legacy)) return legacy;

  const match = options.find(
    (o) => (o.nome ?? "").trim().toLowerCase() === legacy.toLowerCase()
  );
  if (match) return match.id;

  return opts?.allowFreeText ? legacy : "";
}

export function isAviacaoRequiredCategory(categoryId: string): boolean {
  return (AVIACAO_REQUIRED_CATEGORY_IDS as readonly string[]).includes(categoryId);
}

export function isAviacaoExtendedInlineField(fieldId: string): boolean {
  return (AVIACAO_EXTENDED_INLINE_FIELD_IDS as readonly string[]).includes(fieldId);
}

/** Serviços operacionais (Manutenção, Estética, CVA…) — gaveta `servicos_operacionais` (ordem 0–99.999). */
export function resolveAviacaoServicosSolicitadosOptions(
  servicos: AviacaoLookupRow[]
): Array<{ id: string; nome: string | null }> {
  return filterServicosForAviacaoDrawer("servicos_operacionais", servicos).map((s) => ({
    id: s.id,
    nome: s.nome,
  }));
}

export function parseAviacaoServicosSolicitados(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function serializeAviacaoServicosSolicitados(ids: string[]): string {
  return ids.filter(Boolean).join(",");
}

export function parseAviacaoTimeline(observacao: string | null | undefined): AviacaoTimelineEntry[] {
  const raw = parseAviacaoCadastroFields(observacao)[AVIACAO_FIELD_TIMELINE];
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e): e is AviacaoTimelineEntry => {
        if (!e || typeof e !== "object") return false;
        const o = e as Record<string, unknown>;
        return (
          typeof o.ts === "string" &&
          typeof o.action === "string" &&
          typeof o.user === "string"
        );
      })
      .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  } catch {
    return [];
  }
}

export function parseAviacaoAnexos(observacao: string | null | undefined): AviacaoAnexo[] {
  const raw = parseAviacaoCadastroFields(observacao)[AVIACAO_FIELD_ANEXOS];
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is AviacaoAnexo => {
      if (!e || typeof e !== "object") return false;
      const o = e as Record<string, unknown>;
      return (
        typeof o.id === "string" &&
        typeof o.name === "string" &&
        typeof o.mime === "string" &&
        typeof o.uploadedAt === "string" &&
        typeof o.url === "string"
      );
    });
  } catch {
    return [];
  }
}

export function appendAviacaoTimelineEntry(
  fields: AviacaoCadastroFields,
  entry: { action: string; user: string; detail?: string; ts?: string }
): AviacaoCadastroFields {
  const existing = parseAviacaoTimeline(
    embedAviacaoCadastroFields(null, fields)
  );
  const next: AviacaoTimelineEntry = {
    ts: entry.ts ?? new Date().toISOString(),
    action: entry.action,
    user: entry.user,
    ...(entry.detail?.trim() ? { detail: entry.detail.trim() } : {}),
  };
  return {
    ...fields,
    [AVIACAO_FIELD_TIMELINE]: JSON.stringify([...existing, next]),
  };
}

export function resolveAviacaoTimelineBaseLabel(
  tenantId: string | null | undefined,
  options: Array<{ id: string; nome: string | null }>,
  segmentoAplicado?: string | null
): string {
  const tid = tenantId?.trim();
  if (!tid) return mroProfileFor(segmentoAplicado).timelineBaseFallback;
  const match = options.find((o) => o.id === tid);
  return match?.nome?.trim() || tid;
}

/** Concatena texto de avaria/dano ao bloco visível de observações do card MRO. */
export function appendAviacaoAvariaToObservacaoText(
  observacao: string | null | undefined,
  avariaDetail: string,
  segmentoAplicado?: string | null
): string {
  const detail = avariaDetail.trim();
  if (!detail) return sanitizeObservacaoForAviacaoSave(observacao) ?? "";
  const existing = sanitizeObservacaoForAviacaoSave(observacao)?.trim() ?? "";
  const prefix = mroProfileFor(segmentoAplicado).avariaSnippetPrefix;
  const snippet = `${prefix}: ${detail}`;
  return existing ? `${existing} | ${snippet}` : snippet;
}

export function formatAviacaoTimelineLine(entry: AviacaoTimelineEntry): string {
  const when = new Date(entry.ts).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const detail = entry.detail ? ` — ${entry.detail}` : "";
  const baseName = entry.user?.trim() || "—";
  return `${when} | ${entry.action}${detail} | Base: ${baseName}`;
}

export function buildAviacaoCanonicalQueueTabs(
  segmentoAplicado?: string | null
): QueueTabEntry[] {
  return buildMroCanonicalQueueTabs(segmentoAplicado);
}

/** Resolve abas do fluxo MRO a partir da configuração salva do tenant (com fallback canônico). */
export function resolveAviacaoQueueTabs(config: ResolvedTenantConfig): QueueTabEntry[] {
  const stored = config.queueTabs.filter((t) => t.preset !== "todos");
  const flowTabs =
    stored.length > 0 ? stored : buildAviacaoCanonicalQueueTabs(config.segmentoAplicado);
  return config.showTodosTab ? [TODOS_QUEUE_TAB, ...flowTabs] : flowTabs;
}

/** MRO: movimentação livre — sem justificativa obrigatória. */
export function requiresAviacaoPecaJustification(_targetTabId: string): boolean {
  return false;
}

export function resolveAviacaoHangarIdFromRow(
  row: Pick<AtendimentoLite, "observacao" | "cadastro_valores" | "local_id">
): string | null {
  const fromCadastro = row.cadastro_valores?.[AVIACAO_HANGAR_CATEGORY_ID]?.trim();
  if (fromCadastro && looksLikeAviacaoUuid(fromCadastro)) return fromCadastro;
  const inline = parseAviacaoCadastroFields(row.observacao)[AVIACAO_HANGAR_CATEGORY_ID]?.trim();
  if (inline && looksLikeAviacaoUuid(inline)) return inline;
  const legacy = row.local_id?.trim();
  return legacy || null;
}

export function isAviacaoPriorityRow(
  row: Pick<AtendimentoLite, "prioridade" | "classificacao_prioridade">
): boolean {
  if (row.prioridade) return true;
  const c = row.classificacao_prioridade?.trim().toLowerCase();
  return c === "prioritario" || c === "emergencia";
}

export function filterAviacaoQueueRows(
  rows: AtendimentoLite[],
  options: AviacaoQueueFilterOptions
): AtendimentoLite[] {
  let out = rows;
  if (options.priorityOnly) {
    out = out.filter(isAviacaoPriorityRow);
  }
  if (options.hangarIds && options.hangarIds.length > 0) {
    const set = new Set(options.hangarIds);
    out = out.filter((r) => {
      const hangarId = resolveAviacaoHangarIdFromRow(r);
      return hangarId ? set.has(hangarId) : false;
    });
  }
  if (options.hideAguardandoPecas) {
    out = out.filter((r) => {
      const tabId = parseAviacaoFilaTabId(r.observacao);
      return normalizeAviacaoTabId(tabId) !== AVIACAO_QUEUE_TAB.AGUARDANDO_PECAS;
    });
  }
  return out;
}

export function isAviacaoQueueTabId(
  id: string | null | undefined,
  segmentoAplicado?: string | null
): id is AviacaoQueueTabId {
  const profile = mroProfileFor(segmentoAplicado);
  return !!id && (profile.pipelineOrder as readonly string[]).includes(id);
}

export function normalizeAviacaoTabId(
  tabId: string | null | undefined,
  segmentoAplicado?: string | null
): string {
  const profile = mroProfileFor(segmentoAplicado);
  if (!tabId) return profile.pipelineOrder[0] ?? AVIACAO_QUEUE_TAB.TRIAGEM;
  if ((profile.pipelineOrder as readonly string[]).includes(tabId)) return tabId;
  return profile.legacyTabAliases[tabId] ?? profile.pipelineOrder[0] ?? AVIACAO_QUEUE_TAB.TRIAGEM;
}

/** Seleção de aba na Lista MRO: "Todos" usa id próprio e não equivale a Triagem. */
export function isAviacaoQueueTabSelected(
  queueTabId: string,
  tabId: string,
  segmentoAplicado?: string | null
): boolean {
  if (tabId === TODOS_QUEUE_TAB.id || queueTabId === TODOS_QUEUE_TAB.id) {
    return queueTabId === tabId;
  }
  return (
    normalizeAviacaoTabId(queueTabId, segmentoAplicado) ===
    normalizeAviacaoTabId(tabId, segmentoAplicado)
  );
}

/** Valida se o `queueTabId` atual ainda existe nas abas visíveis (inclui legado `av-t*`). */
export function isAviacaoQueueTabIdInVisible(
  queueTabId: string,
  visibleTabIds: string[],
  segmentoAplicado?: string | null
): boolean {
  if (visibleTabIds.includes(queueTabId)) return true;
  if (queueTabId === TODOS_QUEUE_TAB.id) return false;
  return visibleTabIds.some(
    (id) =>
      id !== TODOS_QUEUE_TAB.id &&
      normalizeAviacaoTabId(id, segmentoAplicado) ===
        normalizeAviacaoTabId(queueTabId, segmentoAplicado)
  );
}

/** Id gravado ao clicar numa aba da Lista MRO (preserva `tab-todos`). */
export function resolveAviacaoQueueTabClickId(tabId: string): string {
  if (tabId === TODOS_QUEUE_TAB.id) return tabId;
  return normalizeAviacaoTabId(tabId);
}

export function resolveAviacaoStepFromObservacao(
  observacao: string | null | undefined,
  segmentoAplicado?: string | null
): string {
  return normalizeAviacaoTabId(parseFilaTabId(observacao), segmentoAplicado);
}

export function findAviacaoQueueTabByStep(
  queueTabs: Pick<QueueTabEntry, "id" | "label">[],
  step: string,
  segmentoAplicado?: string | null
): Pick<QueueTabEntry, "id" | "label"> | undefined {
  const direct = queueTabs.find((t) => t.id === step);
  if (direct) return direct;
  return queueTabs.find(
    (t) => normalizeAviacaoTabId(t.id, segmentoAplicado) === normalizeAviacaoTabId(step, segmentoAplicado)
  );
}

export function getAviacaoStepIndex(step: AviacaoQueueTabId): number {
  return AVIACAO_PIPELINE_ORDER.indexOf(step);
}

/** Colunas ativas do fluxo Kanban/lista (exclui aba virtual "Todos"). */
export function getAviacaoActiveColumns(
  queueTabs: Pick<QueueTabEntry, "id" | "preset">[]
): Pick<QueueTabEntry, "id" | "preset">[] {
  return queueTabs.filter((t) => t.preset !== "todos");
}

function findAviacaoActiveColumnIndex(
  tabId: string,
  activeColumns: Pick<QueueTabEntry, "id">[]
): number {
  const direct = activeColumns.findIndex((t) => t.id === tabId);
  if (direct >= 0) return direct;
  const normalized = normalizeAviacaoTabId(tabId);
  return activeColumns.findIndex((t) => normalizeAviacaoTabId(t.id) === normalized);
}

/** Índice dinâmico da coluna atual nas abas configuradas (0 … length-1). */
export function getAviacaoTabIndex(
  tabId: string,
  activeColumns: Pick<QueueTabEntry, "id">[]
): number {
  return findAviacaoActiveColumnIndex(tabId, activeColumns);
}

/** Lê a tag de coluna canônica (primeira linha — a mais recente gravada). */
export function parseAviacaoFilaTabId(observacao: string | null | undefined): string | null {
  if (!observacao) return null;
  const leading = observacao.trimStart().match(/^__sf_fila:tab:([a-z0-9_-]+)__/i);
  if (leading?.[1]) return leading[1];
  return parseFilaTabId(observacao);
}

/** Remove metadados técnicos antes de regravar (evita acúmulo de tags). */
export function sanitizeObservacaoForAviacaoSave(
  observacao: string | null | undefined
): string | null {
  if (!observacao) return null;
  const text = observacao
    .replace(AVIACAO_DATA_TAG_RE, "")
    .replace(AVIACAO_FILA_TAG_RE, "")
    .replace(/^[ \t]*\r?\n+/gm, "")
    .replace(/\r?\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}

/** Resolve o id da coluna gravada na observação (ou a primeira coluna ativa). */
export function resolveAviacaoTabIdFromObservacao(
  observacao: string | null | undefined,
  activeColumns: Pick<QueueTabEntry, "id">[]
): string | null {
  if (activeColumns.length === 0) return null;
  const raw = parseAviacaoFilaTabId(observacao);
  if (raw && findAviacaoActiveColumnIndex(raw, activeColumns) >= 0) return raw;
  return activeColumns[0]?.id ?? null;
}

/** Avança/retrocede entre colunas reais configuradas (suporta colunas extras além do preset). */
export function shiftAviacaoTab(
  tabId: string,
  delta: -1 | 1,
  activeColumns: Pick<QueueTabEntry, "id">[]
): string | null {
  const idx = getAviacaoTabIndex(tabId, activeColumns);
  if (idx < 0) return null;
  const next = idx + delta;
  if (next < 0 || next >= activeColumns.length) return null;
  return activeColumns[next]?.id ?? null;
}

export function canShiftAviacaoTab(
  tabId: string | null | undefined,
  delta: -1 | 1,
  activeColumns: Pick<QueueTabEntry, "id">[]
): boolean {
  if (!tabId || activeColumns.length === 0) return false;
  return shiftAviacaoTab(tabId, delta, activeColumns) !== null;
}

/** @deprecated MRO usa movimentação sequencial sem pulos — alias de `shiftAviacaoTab`. */
export function shiftAviacaoTabQuick(
  tabId: string,
  delta: -1 | 1,
  activeColumns: Pick<QueueTabEntry, "id">[]
): string | null {
  return shiftAviacaoTab(tabId, delta, activeColumns);
}

/** @deprecated MRO usa movimentação sequencial sem pulos — alias de `canShiftAviacaoTab`. */
export function canShiftAviacaoTabQuick(
  tabId: string | null | undefined,
  delta: -1 | 1,
  activeColumns: Pick<QueueTabEntry, "id">[]
): boolean {
  return canShiftAviacaoTab(tabId, delta, activeColumns);
}

/** @deprecated Prefer `shiftAviacaoTab` com `getAviacaoActiveColumns` para colunas dinâmicas. */
export function shiftAviacaoStep(step: AviacaoQueueTabId, delta: -1 | 1): AviacaoQueueTabId | null {
  const idx = getAviacaoStepIndex(step);
  if (idx < 0) return null;
  const next = idx + delta;
  if (next < 0 || next >= AVIACAO_PIPELINE_ORDER.length) return null;
  return AVIACAO_PIPELINE_ORDER[next] ?? null;
}

/** Localiza aba configurada pelo id bruto (preset estável, legado ou coluna customizada). */
export function findAviacaoQueueTabById(
  queueTabs: Pick<QueueTabEntry, "id" | "label" | "preset">[],
  tabId: string
): Pick<QueueTabEntry, "id" | "label" | "preset"> | undefined {
  const direct = queueTabs.find((t) => t.id === tabId);
  if (direct) return direct;
  const fallback = findAviacaoQueueTabByStep(queueTabs, normalizeAviacaoTabId(tabId));
  if (!fallback) return undefined;
  return queueTabs.find((t) => t.id === fallback.id) ?? { ...fallback, preset: "outros" as const };
}

export function getAviacaoStepLabel(
  step: string,
  queueTabs?: Pick<QueueTabEntry, "id" | "label">[],
  segmentoAplicado?: string | null
): string {
  const tab = queueTabs ? findAviacaoQueueTabByStep(queueTabs, step, segmentoAplicado) : undefined;
  const saved = tab?.label?.trim();
  if (saved) return saved.toUpperCase();
  const profile = mroProfileFor(segmentoAplicado);
  return profile.stepLabels[step] ?? AVIACAO_STEP_LABELS[step as AviacaoQueueTabId] ?? step;
}

/** Rótulo exibido no cabeçalho da coluna Kanban / abas da lista (prioriza configuração salva). */
export function resolveAviacaoKanbanColumnLabel(
  tab: Pick<QueueTabEntry, "id" | "label">,
  segmentoAplicado?: string | null
): string {
  const saved = tab.label?.trim();
  if (saved) return saved.toUpperCase();
  const step = normalizeAviacaoTabId(tab.id, segmentoAplicado);
  const profile = mroProfileFor(segmentoAplicado);
  return profile.stepLabels[step] ?? AVIACAO_STEP_LABELS[step as AviacaoQueueTabId] ?? tab.id;
}

/** Observação limpa para cards Aviação — sem resíduos de segmentos clínicos. */
export function formatAviacaoObservacaoForDisplay(
  observacao: string | null | undefined
): string {
  const clean = sanitizeObservacaoForAviacaoSave(observacao);
  if (!clean) return "";
  const text = clean
    .replace(AVIACAO_OBSERVACAO_CLINIC_RESIDUAL_RE, "")
    .replace(/[ \t]*\r?\n+/gm, "\n")
    .trim();
  if (!text || AVIACAO_RAW_TAG_LEAK_RE.test(text)) return "";
  return text;
}

/** Status de chamada na TV conforme a etapa (quando aplicável). */
export function aviacaoStepTvStatus(
  step: string,
  segmentoAplicado?: string | null
): string | undefined {
  const profile = mroProfileFor(segmentoAplicado);
  const normalized = normalizeAviacaoTabId(step, segmentoAplicado);
  if (normalized === profile.pipelineOrder[0]) return STATUS_UPDATE.chamar;
  if (normalized === profile.emManutencaoTabId) return STATUS_UPDATE.rechamar;
  return undefined;
}

export function resolveAviacaoTabActionLabel(
  fromTabId: string | null | undefined,
  toTabId: string,
  segmentoAplicado?: string | null
): string {
  const to = getAviacaoStepLabel(normalizeAviacaoTabId(toTabId, segmentoAplicado), undefined, segmentoAplicado);
  const from = fromTabId
    ? getAviacaoStepLabel(normalizeAviacaoTabId(fromTabId, segmentoAplicado), undefined, segmentoAplicado)
    : null;
  return from ? `Movido: ${from} → ${to}` : `Entrada: ${to}`;
}

export type AviacaoHeaderPrimaryAction = "chamar" | "iniciar" | "finalizar";

export type AviacaoHeaderActionState = {
  chamarLabel: string;
  iniciarLabel: string;
  finalizarLabel: string;
  primaryAction: AviacaoHeaderPrimaryAction;
};

/** Rótulos e ênfase dos botões do painel superior conforme o estágio atual do card MRO. */
export function resolveAviacaoHeaderActionState(
  tabId: string | null | undefined,
  segmentoAplicado?: string | null
): AviacaoHeaderActionState {
  const profile = mroProfileFor(segmentoAplicado);
  const step = normalizeAviacaoTabId(tabId ?? profile.pipelineOrder[0], segmentoAplicado);

  if (step === profile.liberadoTabId) {
    return {
      chamarLabel: profile.headerChamarLabel,
      iniciarLabel: profile.headerIniciarLabel,
      finalizarLabel: profile.headerFinalizarLiberadoLabel,
      primaryAction: "finalizar",
    };
  }

  if (step === profile.emManutencaoTabId) {
    return {
      chamarLabel: profile.headerChamarLabel,
      iniciarLabel: profile.headerIniciarLabel,
      finalizarLabel: profile.headerFinalizarLabel,
      primaryAction: "iniciar",
    };
  }

  return {
    chamarLabel: profile.headerChamarLabel,
    iniciarLabel: profile.headerIniciarLabel,
    finalizarLabel: profile.headerFinalizarLabel,
    primaryAction: "chamar",
  };
}

/** Labels dos checkboxes de registro inteligente no modo aviação MRO. */
export const AVIACAO_REGISTER_FORM_LABELS: Record<
  | "showClienteNome"
  | "showProfissional"
  | "showServico"
  | "showLocal"
  | "showHoraMarcada"
  | "showObservacao"
  | "showModelo"
  | "showUrgencia",
  string
> = {
  showClienteNome: "Nome do Cliente / Operador",
  showProfissional: "Responsável / Mecânico",
  showServico: "Serviços Solicitados",
  showLocal: "Vaga / Hangar / Box Alocado",
  showHoraMarcada: "ETA (Horário estimado de pouso)",
  showObservacao: "Observações",
  showModelo: "Modelo da Aeronave",
  showUrgencia: "Urgência da Peça",
};

export function resolveMroRegisterFormLabels(
  segmentoAplicado?: string | null
): typeof AVIACAO_REGISTER_FORM_LABELS {
  return mroProfileFor(segmentoAplicado).registerFormLabels;
}

export function resolveMroFieldLabels(segmentoAplicado?: string | null): {
  prefixo: string;
  modelo: string;
  hangar: string;
  responsavel: string;
  hobbs: string;
  combustivel: string;
  avariaButton: string;
  avariaPrompt: string;
  avariaTimelineAction: string;
} {
  const profile = mroProfileFor(segmentoAplicado);
  return {
    prefixo: profile.categoryDisplayLabels["av-c3"] ?? "Prefixo da Aeronave",
    modelo: profile.categoryDisplayLabels["av-c4"] ?? "Modelo da Aeronave",
    hangar: profile.categoryDisplayLabels["av-c2"] ?? "Vaga / Hangar / Box",
    responsavel: profile.categoryDisplayLabels["av-c1"] ?? "Responsável / Mecânico",
    hobbs: profile.hobbsFieldLabel,
    combustivel: profile.combustivelFieldLabel,
    avariaButton: profile.avariaButtonLabel,
    avariaPrompt: profile.avariaPrompt,
    avariaTimelineAction: profile.avariaTimelineAction,
  };
}

export type AviacaoCadastroFields = Partial<Record<string, string>>;

export function parseAviacaoCadastroFields(
  observacao: string | null | undefined
): AviacaoCadastroFields {
  if (!observacao) return {};
  const inline = AVIACAO_DATA_PARSE.exec(observacao);
  if (!inline?.[1]) return {};
  try {
    const parsed = JSON.parse(decodeURIComponent(inline[1])) as Record<string, unknown>;
    const out: AviacaoCadastroFields = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string" && v.trim()) out[k] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

export function embedAviacaoCadastroFields(
  observacao: string | null | undefined,
  fields: AviacaoCadastroFields
): string | null {
  const withoutTag = (observacao ?? "").replace(AVIACAO_DATA_TAG_RE, "").trim();
  const payload: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v?.trim()) payload[k] = v.trim();
  }
  if (Object.keys(payload).length === 0) return withoutTag || null;
  const marker = `__sf_aviacao:${encodeURIComponent(JSON.stringify(payload))}__`;
  if (!withoutTag) return marker;
  return `${marker}\n${withoutTag}`;
}

export function mergeAviacaoObservacao(params: {
  current?: string | null;
  tab?: Pick<QueueTabEntry, "id"> & { preset?: QueueTabEntry["preset"] } | null;
  aviacaoFields?: AviacaoCadastroFields | null;
  preserveTabWhenUnset?: boolean;
  userObservacaoText?: string | null;
}): string | null {
  const current = params.current ?? null;
  const aviacaoFields =
    params.aviacaoFields !== undefined && params.aviacaoFields !== null
      ? params.aviacaoFields
      : parseAviacaoCadastroFields(current);
  const userText =
    params.userObservacaoText !== undefined
      ? (params.userObservacaoText?.trim() || "")
      : (sanitizeObservacaoForAviacaoSave(current) ?? "");

  let withFila: string | null = userText || null;

  if (params.tab) {
    const rawPreset = params.tab.preset;
    const preset: QueueTabId =
      rawPreset === "todos" || !rawPreset ? "ordem" : (rawPreset as QueueTabId);
    withFila = embedFilaPreset(withFila, preset, params.tab.id);
  } else if (params.preserveTabWhenUnset !== false) {
    const tabId = parseAviacaoFilaTabId(current);
    if (tabId) {
      withFila = embedFilaPreset(withFila, "outros", tabId);
    } else {
      const preset = parseFilaPreset(current);
      if (preset) withFila = embedFilaPreset(withFila, preset);
    }
  }

  return embedAviacaoCadastroFields(withFila, aviacaoFields);
}

export function buildAviacaoRegistryObservacao(
  userObs: string | null,
  filaPreset: QueueTabId,
  tabId: string | undefined,
  aviacaoFields: AviacaoCadastroFields
): string | null {
  const preset: QueueTabId = filaPreset === "todos" ? "ordem" : filaPreset;
  const tab = tabId ? { id: tabId, preset } : null;
  return mergeAviacaoObservacao({
    current: userObs || null,
    tab,
    aviacaoFields,
    preserveTabWhenUnset: false,
  });
}

export function buildAviacaoSavePayload(
  formValues: Record<string, string>,
  categories: CadastroCategoryEntry[]
): {
  cadastroPayload: ReturnType<typeof buildCadastroPayload>;
  aviacaoFields: AviacaoCadastroFields;
} {
  const selectValues: Record<string, string> = {};
  const aviacaoFields: AviacaoCadastroFields = {};

  for (const cat of categories.filter((c) => c.enabled)) {
    const raw = formValues[cat.id]?.trim() ?? "";
    if (!raw) continue;
    if (isAviacaoRigidSelectField(cat.id)) {
      selectValues[cat.id] = raw;
    } else if (
      isAviacaoFreeTextField(cat.id) ||
      isAviacaoInlineTextField(cat.id) ||
      cat.id === AVIACAO_INLINE_OBSERVACAO_FIELD_ID
    ) {
      aviacaoFields[cat.id] = raw;
    } else {
      selectValues[cat.id] = raw;
    }
  }

  for (const fieldId of AVIACAO_EXTENDED_INLINE_FIELD_IDS) {
    const raw = formValues[fieldId]?.trim();
    if (raw) aviacaoFields[fieldId] = raw;
  }

  const cadastroPayload = buildCadastroPayload(
    {
      ...selectValues,
      [AVIACAO_PREFIXO_CATEGORY_ID]: "",
      [AVIACAO_MODELO_CATEGORY_ID]: "",
      [AVIACAO_RESPONSAVEL_CATEGORY_ID]: "",
    },
    categories
  );

  return {
    cadastroPayload,
    aviacaoFields,
  };
}

export function buildAviacaoCategoryPatch(
  categoryValues: Record<string, string>,
  categories: CadastroCategoryEntry[],
  currentObservacao: string | null
): ReturnType<typeof buildCadastroPayload> & { observacao: string | null } {
  const selectOnly: Record<string, string> = {};
  for (const cat of categories.filter((c) => c.enabled)) {
    const v = categoryValues[cat.id]?.trim();
    if (!v) continue;
    if (isAviacaoRigidSelectField(cat.id)) {
      selectOnly[cat.id] = v;
    }
  }
  const cadastroPayload = buildCadastroPayload(
    {
      ...selectOnly,
      [AVIACAO_PREFIXO_CATEGORY_ID]: "",
      [AVIACAO_MODELO_CATEGORY_ID]: "",
      [AVIACAO_RESPONSAVEL_CATEGORY_ID]: "",
    },
    categories
  );
  const aviacaoFields = parseAviacaoCadastroFields(currentObservacao);
  for (const id of AVIACAO_RIGID_SELECT_FIELD_IDS) {
    delete aviacaoFields[id];
  }
  for (const id of AVIACAO_FREE_TEXT_FIELD_IDS) {
    const value = categoryValues[id]?.trim();
    if (value) aviacaoFields[id] = value;
    else delete aviacaoFields[id];
  }
  for (const id of AVIACAO_INLINE_TEXT_FIELD_IDS) {
    const value = categoryValues[id]?.trim();
    if (value) aviacaoFields[id] = value;
    else delete aviacaoFields[id];
  }
  const urgencia = categoryValues[AVIACAO_INLINE_OBSERVACAO_FIELD_ID]?.trim();
  if (urgencia) aviacaoFields[AVIACAO_INLINE_OBSERVACAO_FIELD_ID] = urgencia;
  else delete aviacaoFields[AVIACAO_INLINE_OBSERVACAO_FIELD_ID];
  const observacao = mergeAviacaoObservacao({
    current: currentObservacao,
    aviacaoFields,
    preserveTabWhenUnset: true,
  });
  return { ...cadastroPayload, observacao };
}

export function resolveAviacaoCategoryDisplay(
  categoryId: string,
  observacao: string | null | undefined,
  valores: CadastroValores,
  lookups: CadastroLookups,
  categories: CadastroCategoryEntry[],
  legacy?: CadastroLegacyContext
): string | null {
  if (
    isAviacaoFreeTextField(categoryId) ||
    isAviacaoInlineTextField(categoryId) ||
    categoryId === AVIACAO_INLINE_OBSERVACAO_FIELD_ID
  ) {
    const inline = parseAviacaoCadastroFields(observacao)[categoryId];
    if (inline) return inline;
  }
  const fromCadastro = resolveCategoryDisplayLabel(
    categoryId,
    valores,
    lookups,
    categories,
    undefined,
    legacy
  );
  if (fromCadastro) return fromCadastro;
  if (
    isAviacaoRigidSelectField(categoryId) ||
    isAviacaoFreeTextField(categoryId) ||
    categoryId === AVIACAO_INLINE_OBSERVACAO_FIELD_ID
  ) {
    return parseAviacaoCadastroFields(observacao)[categoryId] ?? null;
  }
  return null;
}

/** Rótulo do hangar/box para a tag central do stepper. */
export function getAviacaoHangarLabel(
  row: {
    observacao: string | null;
    cadastro_valores?: CadastroValores | null;
    local_id?: string | null;
    localNome?: string | null;
  },
  categories: CadastroCategoryEntry[],
  lookups: CadastroLookups
): string {
  const legacyCtx: CadastroLegacyContext = {
    local_id: row.local_id,
    localNome: row.localNome,
  };
  const label =
    resolveAviacaoCategoryDisplay(
      AVIACAO_HANGAR_CATEGORY_ID,
      row.observacao,
      row.cadastro_valores ?? {},
      lookups,
      categories,
      legacyCtx
    )?.trim() || null;
  return label
    ? label.toUpperCase()
    : mroProfileFor(undefined).hangarUnallocatedLabel;
}

export function getAviacaoHangarUnallocatedLabel(segmentoAplicado?: string | null): string {
  return mroProfileFor(segmentoAplicado).hangarUnallocatedLabel;
}

export function resolveAviacaoKanbanMeta(
  row: {
    observacao: string | null;
    nome: string | null;
    cadastro_valores?: CadastroValores | null;
    profissional_id?: string | null;
    local_id?: string | null;
    especialidade_id?: string | null;
    profissionalNome?: string | null;
    localNome?: string | null;
    servicoNome?: string | null;
  },
  categories: CadastroCategoryEntry[],
  lookups: CadastroLookups
): {
  title: string;
  profissional: string | null;
  local: string | null;
  servico: string | null;
  hangarLabel: string | null;
} {
  const legacyCtx: CadastroLegacyContext = {
    profissional_id: row.profissional_id,
    local_id: row.local_id,
    especialidade_id: row.especialidade_id,
    profissionalNome: row.profissionalNome,
    localNome: row.localNome,
    servicoNome: row.servicoNome,
  };
  const prefixo =
    resolveAviacaoCategoryDisplay("av-c3", row.observacao, row.cadastro_valores ?? {}, lookups, categories, legacyCtx) ??
    null;
  const pilotoCliente = row.nome?.trim() || null;
  const modelo =
    resolveAviacaoCategoryDisplay("av-c4", row.observacao, row.cadastro_valores ?? {}, lookups, categories, legacyCtx) ??
    null;
  const hangar =
    resolveAviacaoCategoryDisplay(
      AVIACAO_HANGAR_CATEGORY_ID,
      row.observacao,
      row.cadastro_valores ?? {},
      lookups,
      categories,
      legacyCtx
    ) ?? null;

  return {
    title: prefixo ?? row.nome?.trim() ?? "—",
    profissional: pilotoCliente,
    local: null,
    servico: modelo,
    hangarLabel: hangar,
  };
}
