import { AVIACAO_QUEUE_TAB } from "@/lib/aviacao-logistics";
import { DOCAS_QUEUE_TAB } from "@/lib/docas-logistics";
import {
  DEFAULT_CADASTRO_CATEGORIES,
  DEFAULT_QUEUE_TABS,
  DEFAULT_REGISTER_FORM,
  restoreDefaultCadastroCategories,
  restoreDefaultQueueTabs,
  syncRegisterFormFromCategories,
  type CadastroCategoryEntry,
  type CadastroTableKey,
  type QueueTabEntry,
  type RegisterFormConfig,
  type ResolvedTenantConfig,
} from "@/lib/tenant-config";

export type SegmentPresetId =
  | "clinicas_consultorios"
  | "ambulancias"
  | "cozinhas"
  | "ti_reparo"
  | "docas"
  | "aviacao_mro"
  | "oficinas_auto"
  | "advocacia"
  | "saloes_beleza"
  | "cartorios"
  | "coworkings"
  | "blank";

export type SegmentPresetMeta = {
  id: SegmentPresetId;
  emoji: string;
  name: string;
  fieldsSummary: string;
  tabsSummary: string;
  cadastroCategories: CadastroCategoryEntry[];
  queueTabs: QueueTabEntry[];
  registerForm: RegisterFormConfig;
};

function cat(id: string, label: string, tableKey: CadastroTableKey): CadastroCategoryEntry {
  return { id, label, enabled: true, tableKey };
}

function flowTab(id: string, label: string): QueueTabEntry {
  return { id, preset: "outros", label, customTypeLabel: label };
}

function docasTab(id: string, label: string): QueueTabEntry {
  return { id, preset: "outros", label, customTypeLabel: label };
}

function aviacaoTab(id: string, label: string): QueueTabEntry {
  return { id, preset: "outros", label, customTypeLabel: label };
}

function makePreset(
  id: SegmentPresetId,
  emoji: string,
  name: string,
  fieldsSummary: string,
  tabsSummary: string,
  cadastroCategories: CadastroCategoryEntry[],
  queueTabs: QueueTabEntry[],
  registerOverrides: Partial<RegisterFormConfig> = {}
): SegmentPresetMeta {
  return {
    id,
    emoji,
    name,
    fieldsSummary,
    tabsSummary,
    cadastroCategories,
    queueTabs,
    registerForm: syncRegisterFormFromCategories(cadastroCategories, {
      ...DEFAULT_REGISTER_FORM,
      showObservacao: true,
      ...registerOverrides,
    }),
  };
}

const CLINICAS = makePreset(
  "clinicas_consultorios",
  "🏥",
  "Clínicas e Consultórios",
  "Equipe, Locais, Serviços (padrão recepção clínica)",
  "Ordem de Chegada, Hora Marcada, Encaixe, Prioridade, Urgente",
  restoreDefaultCadastroCategories(),
  restoreDefaultQueueTabs()
);

const AMBULANCIAS = makePreset(
  "ambulancias",
  "🏥",
  "Central de Ambulâncias e Remoções",
  "Código da Ambulância, Equipe Médica, Hospital Destino, Tipo de Ocorrência, Gravidade",
  "Disponível em Base → Em Deslocamento → No Local → Retornando → Em Higienização",
  [
    cat("amb-c1", "Código da Ambulância", "locais"),
    cat("amb-c2", "Equipe Médica", "profissionais"),
    cat("amb-c3", "Hospital Destino", "locais"),
    cat("amb-c4", "Tipo de Ocorrência", "servicos"),
    cat("amb-c5", "Gravidade", "servicos"),
  ],
  [
    flowTab("amb-t1", "Disponível em Base"),
    flowTab("amb-t2", "Em Deslocamento"),
    flowTab("amb-t3", "No Local (Atendimento)"),
    flowTab("amb-t4", "Retornando"),
    flowTab("amb-t5", "Em Higienização"),
  ]
);

const COZINHAS = makePreset(
  "cozinhas",
  "🍳",
  "Cozinhas Industriais e Catering",
  "Número do Pedido, Canal (iFood/Balcão), Chef Responsável, Mesa/Linha de Montagem, Observações Alérgicas",
  "Recebido → Em Preparo → Montagem/Embalagem → Aguardando Motoboy → Despachado",
  [
    cat("coz-c1", "Número do Pedido", "servicos"),
    cat("coz-c2", "Canal (iFood/Balcão)", "locais"),
    cat("coz-c3", "Chef Responsável", "profissionais"),
    cat("coz-c4", "Mesa/Linha de Montagem", "locais"),
    cat("coz-c5", "Observações Alérgicas", "servicos"),
  ],
  [
    flowTab("coz-t1", "Recebido"),
    flowTab("coz-t2", "Em Preparo"),
    flowTab("coz-t3", "Montagem/Embalagem"),
    flowTab("coz-t4", "Aguardando Motoboy"),
    flowTab("coz-t5", "Despachado"),
  ]
);

const TI_REPARO = makePreset(
  "ti_reparo",
  "💻",
  "Centros de Reparo de Hardware e TI",
  "Cliente, Equipamento (Nº Série), Técnico Alocado, Tipo de Defeito, Peça Necessária",
  "Entrada (Triagem) → Em Orçamento → Aguardando Aprovação → Em Manutenção → Pronto / Retirada",
  [
    cat("ti-c1", "Equipamento (Nº Série)", "locais"),
    cat("ti-c2", "Técnico Alocado", "profissionais"),
    cat("ti-c3", "Tipo de Defeito", "servicos"),
    cat("ti-c4", "Peça Necessária", "servicos"),
  ],
  [
    flowTab("ti-t1", "Entrada (Triagem)"),
    flowTab("ti-t2", "Em Orçamento"),
    flowTab("ti-t3", "Aguardando Aprovação"),
    flowTab("ti-t4", "Em Manutenção"),
    flowTab("ti-t5", "Pronto / Retirada"),
  ],
  { showClienteNome: true }
);

const DOCAS = makePreset(
  "docas",
  "🚛",
  "Carga e Descarga (Gestão de Docas)",
  "Placa, Motorista, Tipo de Carga, Doca Alocada, Conferente Responsável",
  "NO PÁTIO → CHAMADO → DESCARREGANDO → CONFERÊNCIA → LIBERADO",
  [
    cat("doc-c1", "Placa", "profissionais"),
    cat("doc-c2", "Motorista", "profissionais"),
    cat("doc-c3", "Tipo de Carga", "servicos"),
    cat("doc-c4", "Doca Alocada", "locais"),
    cat("doc-c5", "Conferente Responsável", "servicos"),
  ],
  [
    docasTab(DOCAS_QUEUE_TAB.NO_PATIO, "NO PÁTIO (ESPERA)"),
    docasTab(DOCAS_QUEUE_TAB.CHAMADO, "CHAMADO P/ DOCA"),
    docasTab(DOCAS_QUEUE_TAB.DESCARREGANDO, "DESCARREGANDO"),
    docasTab(DOCAS_QUEUE_TAB.EM_CONFERENCIA, "EM CONFERÊNCIA"),
    docasTab(DOCAS_QUEUE_TAB.LIBERADO, "LIBERADO"),
  ],
  { showClienteNome: false, showHoraMarcada: false, showObservacao: true }
);

const AVIACAO = makePreset(
  "aviacao_mro",
  "✈️",
  "Aviação e Logística de Manutenção (MRO)",
  "Piloto / Responsável, Vaga / Hangar, Prefixo da Aeronave, Modelo, Urgência da Peça",
  "Triagem → Aguardando Peça → Em Execução → Teste de Voo → Liberado",
  [
    cat("av-c1", "Piloto / Responsável", "profissionais"),
    cat("av-c2", "Vaga / Hangar / Box Alocado", "locais"),
    cat("av-c3", "Prefixo da Aeronave", "profissionais"),
    cat("av-c4", "Modelo da Aeronave", "servicos"),
    cat("av-c5", "Urgência da Peça", "servicos"),
  ],
  [
    aviacaoTab(AVIACAO_QUEUE_TAB.TRIAGEM, "Triagem"),
    aviacaoTab(AVIACAO_QUEUE_TAB.AGUARDANDO_PECA, "Aguardando Peça"),
    aviacaoTab(AVIACAO_QUEUE_TAB.EM_EXECUCAO, "Em Execução"),
    aviacaoTab(AVIACAO_QUEUE_TAB.TESTE_VOO, "Teste de Voo"),
    aviacaoTab(AVIACAO_QUEUE_TAB.LIBERADO, "Liberado"),
  ],
  { showClienteNome: false, showHoraMarcada: false, showObservacao: true }
);

const OFICINAS = makePreset(
  "oficinas_auto",
  "🚗",
  "Oficinas Mecânicas e Estética Automotiva",
  "Cliente/Veículo, Mecânico/Detalhador, Elevador/Box, Tipo de Serviço, Seguradora/Particular",
  "Orçamento → Aguardando Peça → Na Valeta → Lavagem → Pronto para Entrega",
  [
    cat("of-c1", "Cliente/Veículo", "locais"),
    cat("of-c2", "Mecânico/Detalhador", "profissionais"),
    cat("of-c3", "Elevador/Box", "locais"),
    cat("of-c4", "Tipo de Serviço", "servicos"),
    cat("of-c5", "Seguradora/Particular", "servicos"),
  ],
  [
    flowTab("of-t1", "Orçamento"),
    flowTab("of-t2", "Aguardando Peça"),
    flowTab("of-t3", "Na Valeta"),
    flowTab("of-t4", "Lavagem"),
    flowTab("of-t5", "Pronto para Entrega"),
  ]
);

const ADVOCACIA = makePreset(
  "advocacia",
  "⚖️",
  "Escritórios de Advocacia e Consultorias",
  "Cliente, Advogado Responsável, Sala de Reunião, Tipo de Processo/Ação, Urgência de Prazo",
  "Triagem → Consulta Inicial → Elaboração de Peça → Audiência → Concluído",
  [
    cat("adv-c1", "Advogado Responsável", "profissionais"),
    cat("adv-c2", "Sala de Reunião", "locais"),
    cat("adv-c3", "Tipo de Processo/Ação", "servicos"),
    cat("adv-c4", "Urgência de Prazo", "servicos"),
  ],
  [
    flowTab("adv-t1", "Triagem"),
    flowTab("adv-t2", "Consulta Inicial"),
    flowTab("adv-t3", "Elaboração de Peça"),
    flowTab("adv-t4", "Audiência"),
    flowTab("adv-t5", "Concluído"),
  ],
  { showClienteNome: true }
);

const SALOES = makePreset(
  "saloes_beleza",
  "💅",
  "Salões de Beleza, Spas e Estética",
  "Cliente, Profissional, Cadeira/Mesa/Sala, Procedimento, Linha de Produtos",
  "Check-in → Em Atendimento → Processamento (Química) → Lavatório → Checkout",
  [
    cat("sal-c1", "Profissional", "profissionais"),
    cat("sal-c2", "Cadeira/Mesa/Sala", "locais"),
    cat("sal-c3", "Procedimento", "servicos"),
    cat("sal-c4", "Linha de Produtos", "servicos"),
  ],
  [
    flowTab("sal-t1", "Check-in"),
    flowTab("sal-t2", "Em Atendimento"),
    flowTab("sal-t3", "Processamento (Química)"),
    flowTab("sal-t4", "Lavatório"),
    flowTab("sal-t5", "Checkout"),
  ],
  { showClienteNome: true }
);

const CARTORIOS = makePreset(
  "cartorios",
  "🏛️",
  "Cartórios e Órgãos Públicos",
  "Cidadão, Atendente/Escrevente, Guichê, Tipo de Documento, Tipo de Protocolo",
  "Triagem Geral → Em Análise → Emissão → Conferência → Entrega",
  [
    cat("car-c1", "Atendente/Escrevente", "profissionais"),
    cat("car-c2", "Guichê", "locais"),
    cat("car-c3", "Tipo de Documento", "servicos"),
    cat("car-c4", "Tipo de Protocolo", "servicos"),
  ],
  [
    flowTab("car-t1", "Triagem Geral"),
    flowTab("car-t2", "Em Análise"),
    flowTab("car-t3", "Emissão"),
    flowTab("car-t4", "Conferência"),
    flowTab("car-t5", "Entrega"),
  ],
  { showClienteNome: true }
);

const COWORKINGS = makePreset(
  "coworkings",
  "🏢",
  "Coworkings e Centros Corporativos",
  "Visitante, Empresa Destino, Sala de Reunião/Estação, Colaborador Anfitrião, Tipo de Acesso",
  "Portaria → Aguardando Liberação → Em Reunião → Saída",
  [
    cat("cow-c1", "Empresa Destino", "locais"),
    cat("cow-c2", "Sala de Reunião/Estação", "locais"),
    cat("cow-c3", "Colaborador Anfitrião", "profissionais"),
    cat("cow-c4", "Tipo de Acesso", "servicos"),
  ],
  [
    flowTab("cow-t1", "Portaria"),
    flowTab("cow-t2", "Aguardando Liberação"),
    flowTab("cow-t3", "Em Reunião"),
    flowTab("cow-t4", "Saída"),
  ],
  { showClienteNome: true }
);

const BLANK = makePreset(
  "blank",
  "📋",
  "Tema em Branco / Customizado",
  "Nenhum campo pré-configurado — crie categorias em Cadastros base",
  "Uma aba inicial — personalize em Fluxo de abas",
  [],
  [flowTab("blank-t1", "Entrada")],
  {
    showClienteNome: true,
    showProfissional: false,
    showServico: false,
    showLocal: false,
    showHoraMarcada: false,
    showObservacao: true,
  }
);

export const SEGMENT_PRESETS: SegmentPresetMeta[] = [
  CLINICAS,
  AMBULANCIAS,
  COZINHAS,
  TI_REPARO,
  DOCAS,
  AVIACAO,
  OFICINAS,
  ADVOCACIA,
  SALOES,
  CARTORIOS,
  COWORKINGS,
  BLANK,
];

export const SEGMENT_PRESET_MAP: Record<SegmentPresetId, SegmentPresetMeta> = Object.fromEntries(
  SEGMENT_PRESETS.map((p) => [p.id, p])
) as Record<SegmentPresetId, SegmentPresetMeta>;

const ALIAS_TO_ID: Record<string, SegmentPresetId> = {
  clinicas_consultorios: "clinicas_consultorios",
  "clinicas e consultorios": "clinicas_consultorios",
  "clínicas e consultórios": "clinicas_consultorios",
  ambulancias: "ambulancias",
  ambulancia: "ambulancias",
  cozinhas: "cozinhas",
  ti_reparo: "ti_reparo",
  docas: "docas",
  aviacao_mro: "aviacao_mro",
  oficinas_auto: "oficinas_auto",
  oficinas: "oficinas_auto",
  advocacia: "advocacia",
  saloes_beleza: "saloes_beleza",
  cartorios: "cartorios",
  coworkings: "coworkings",
  blank: "blank",
};

function categoriesMatchFactory(a: CadastroCategoryEntry[], b: CadastroCategoryEntry[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, i) => {
    const other = b[i];
    return (
      other &&
      item.id === other.id &&
      item.label === other.label &&
      item.tableKey === other.tableKey &&
      item.enabled === other.enabled
    );
  });
}

function queueTabsMatchFactory(a: QueueTabEntry[], b: QueueTabEntry[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, i) => {
    const other = b[i];
    return other && item.id === other.id && item.preset === other.preset && item.label === other.label;
  });
}

/** Config ainda no padrão de fábrica (clínica), sem segmento aplicado. */
export function isConfigAtFactoryDefault(config: ResolvedTenantConfig): boolean {
  if (config.segmentoAplicado) return false;
  return (
    categoriesMatchFactory(config.cadastroCategories, DEFAULT_CADASTRO_CATEGORIES) &&
    queueTabsMatchFactory(config.queueTabs, DEFAULT_QUEUE_TABS)
  );
}

/** Cadastros ou abas vazias, ou ainda no default inicial. */
export function isConfigEmptyOrDefault(config: ResolvedTenantConfig): boolean {
  if (config.segmentoAplicado) return false;
  if (config.cadastroCategories.length === 0) return true;
  if (config.queueTabs.length === 0) return true;
  return isConfigAtFactoryDefault(config);
}

/** Normaliza valor vindo do painel Master (`segmento_definido`). */
export function normalizeSegmentPresetId(raw: string | null | undefined): SegmentPresetId {
  if (!raw?.trim()) return "clinicas_consultorios";
  const key = raw.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const alias = ALIAS_TO_ID[key] ?? ALIAS_TO_ID[raw.trim().toLowerCase()];
  if (alias && SEGMENT_PRESET_MAP[alias]) return alias;
  if (raw in SEGMENT_PRESET_MAP) return raw as SegmentPresetId;
  return "clinicas_consultorios";
}

export function isSegmentLicensed(
  presetId: SegmentPresetId,
  segmentoDefinido: string | null | undefined
): boolean {
  if (presetId === "blank") return true;
  const licensed = normalizeSegmentPresetId(segmentoDefinido);
  return presetId === licensed;
}

export function applySegmentPreset(presetId: SegmentPresetId): Pick<
  ResolvedTenantConfig,
  "queueTabs" | "cadastroCategories" | "registerForm"
> & { segmentoAplicado: SegmentPresetId } {
  const preset = SEGMENT_PRESETS.find((p) => p.id === presetId) ?? CLINICAS;
  const cadastroCategories = preset.cadastroCategories.map((c) => ({ ...c }));
  const queueTabs = preset.queueTabs.map((t) => ({ ...t }));
  return {
    cadastroCategories,
    queueTabs,
    registerForm: { ...preset.registerForm },
    segmentoAplicado: preset.id,
  };
}

/** Auto-aplica preset licenciado pelo Master quando o tenant ainda está no default. */
export function shouldAutoApplySegmentPreset(
  config: ResolvedTenantConfig,
  segmentoDefinido: string | null | undefined
): SegmentPresetId | null {
  if (!segmentoDefinido?.trim()) return null;
  const presetId = normalizeSegmentPresetId(segmentoDefinido);
  if (presetId === "blank") return null;
  if (config.segmentoAplicado === presetId) return null;
  if (!isConfigEmptyOrDefault(config)) return null;
  return presetId;
}

/** Preset clínica (retrocompatível com defaults). */
export { DEFAULT_CADASTRO_CATEGORIES, DEFAULT_QUEUE_TABS };
