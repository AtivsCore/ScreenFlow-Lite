/** Perfis do motor MRO compartilhado (Aviação, Oficina Automotiva e Hardware/TI). */

export const AVIACAO_SEGMENT_ID = "aviacao_mro" as const;
export const AUTOMOTIVO_SEGMENT_ID = "automotivo_mro" as const;
export const HARDWARE_TI_SEGMENT_ID = "hardware_ti" as const;

export type MroSegmentId =
  | typeof AVIACAO_SEGMENT_ID
  | typeof AUTOMOTIVO_SEGMENT_ID
  | typeof HARDWARE_TI_SEGMENT_ID;

export const AVIACAO_QUEUE_TAB = {
  TRIAGEM: "triagem",
  EM_MANUTENCAO: "em_manutencao",
  AGUARDANDO_PECAS: "aguardando_pecas",
  INSPECAO_QC: "inspecao_qc",
  TESTE_VOO: "teste_voo",
  ESTETICA_LAVAGEM: "estetica_lavagem",
  LIBERADO: "liberado",
} as const;

export const AUTOMOTIVO_QUEUE_TAB = {
  TRIAGEM: "triagem",
  ORCAMENTO: "orcamento",
  AGUARDANDO_PECAS: "aguardando_pecas",
  EM_MANUTENCAO: "em_manutencao",
  LAVAGEM_ESTETICA: "lavagem_estetica",
  PRONTO_RETIRADA: "pronto_retirada",
} as const;

export type MroRegisterFormLabelKey =
  | "showClienteNome"
  | "showProfissional"
  | "showServico"
  | "showLocal"
  | "showHoraMarcada"
  | "showObservacao"
  | "showModelo"
  | "showUrgencia";

/** Campos extras do registro MRO (hobbs, combustível, serviços checkbox). */
export type MroRegistryExtras = {
  showHobbsCombustivel: boolean;
  requireHobbs: boolean;
  requireCombustivel: boolean;
  showServicosCheckboxes: boolean;
  requireServicosCheckboxes: boolean;
  requireHangar: boolean;
};

const MRO_REGISTRY_EXTRAS_DEFAULT: MroRegistryExtras = {
  showHobbsCombustivel: true,
  requireHobbs: true,
  requireCombustivel: true,
  showServicosCheckboxes: true,
  requireServicosCheckboxes: true,
  requireHangar: true,
};

const MRO_REGISTRY_EXTRAS_HARDWARE_TI: MroRegistryExtras = {
  showHobbsCombustivel: false,
  requireHobbs: false,
  requireCombustivel: false,
  showServicosCheckboxes: true,
  requireServicosCheckboxes: false,
  requireHangar: false,
};

export type MroSegmentProfile = {
  segmentId: MroSegmentId;
  pipelineOrder: readonly string[];
  stepLabels: Record<string, string>;
  legacyTabAliases: Record<string, string>;
  categoryDisplayLabels: Record<string, string>;
  hybridFieldCanonicalLabels: Record<string, readonly string[]>;
  registerFormLabels: Record<MroRegisterFormLabelKey, string>;
  hangarUnallocatedLabel: string;
  hangarQuickCrudTitle: string;
  baseQuickCrudTitle: string;
  /** Quando definido, substitui o seletor de base/unidade por opções fixas (ex.: tipo de dispositivo). */
  baseSelectorOptions?: readonly string[];
  liberadoTabId: string;
  emManutencaoTabId: string;
  headerChamarLabel: string;
  headerIniciarLabel: string;
  headerFinalizarLabel: string;
  headerFinalizarLiberadoLabel: string;
  validation: {
    prefixoRequired: string;
    hangarRequired: string;
    hobbsRequired: string;
    combustivelRequired: string;
    servicosRequired: string;
  };
  hobbsFieldLabel: string;
  combustivelFieldLabel: string;
  avariaSnippetPrefix: string;
  avariaPrompt: string;
  avariaTimelineAction: string;
  avariaButtonLabel: string;
  timelineBaseFallback: string;
  baseSelectorLabel: string;
  hangarQuickAddButtonLabel: string;
  hangarQuickAddButtonTitle: string;
  combustivelOptions: readonly string[];
  timelineSectionTitle: string;
  timelineLogPrefix: string;
  registerInteligenteHint: string;
  registryExtras: MroRegistryExtras;
  equipeQuickAddButtonLabel: string;
  equipeQuickAddButtonTitle: string;
};

const AVIACAO_PROFILE: MroSegmentProfile = {
  segmentId: AVIACAO_SEGMENT_ID,
  pipelineOrder: [
    AVIACAO_QUEUE_TAB.TRIAGEM,
    AVIACAO_QUEUE_TAB.EM_MANUTENCAO,
    AVIACAO_QUEUE_TAB.AGUARDANDO_PECAS,
    AVIACAO_QUEUE_TAB.INSPECAO_QC,
    AVIACAO_QUEUE_TAB.TESTE_VOO,
    AVIACAO_QUEUE_TAB.ESTETICA_LAVAGEM,
    AVIACAO_QUEUE_TAB.LIBERADO,
  ],
  stepLabels: {
    [AVIACAO_QUEUE_TAB.TRIAGEM]: "TRIAGEM / CHECK-IN",
    [AVIACAO_QUEUE_TAB.EM_MANUTENCAO]: "EM MANUTENÇÃO",
    [AVIACAO_QUEUE_TAB.AGUARDANDO_PECAS]: "AGUARDANDO PEÇAS",
    [AVIACAO_QUEUE_TAB.INSPECAO_QC]: "INSPEÇÃO / QC",
    [AVIACAO_QUEUE_TAB.TESTE_VOO]: "TESTE DE VOO",
    [AVIACAO_QUEUE_TAB.ESTETICA_LAVAGEM]: "ESTÉTICA / LAVAGEM",
    [AVIACAO_QUEUE_TAB.LIBERADO]: "LIBERADO / PRONTO",
  },
  legacyTabAliases: {
    "av-t1": AVIACAO_QUEUE_TAB.TRIAGEM,
    "av-t2": AVIACAO_QUEUE_TAB.EM_MANUTENCAO,
    "av-t3": AVIACAO_QUEUE_TAB.INSPECAO_QC,
    "av-t4": AVIACAO_QUEUE_TAB.TESTE_VOO,
    "av-t5": AVIACAO_QUEUE_TAB.LIBERADO,
    aguardando_peca: AVIACAO_QUEUE_TAB.EM_MANUTENCAO,
    em_execucao: AVIACAO_QUEUE_TAB.INSPECAO_QC,
  },
  categoryDisplayLabels: {
    "av-c1": "Responsável / Mecânico",
    "av-c2": "Vaga / Hangar / Box Alocado",
    "av-c3": "Prefixo da Aeronave",
    "av-c4": "Modelo da Aeronave",
    "av-c5": "Urgência da Peça",
  },
  hybridFieldCanonicalLabels: {
    "av-c1": ["Responsável / Mecânico"],
    "av-c3": ["Prefixo da Aeronave"],
    "av-c4": ["Modelo da Aeronave"],
  },
  registerFormLabels: {
    showClienteNome: "Nome do Cliente / Operador",
    showProfissional: "Responsável / Mecânico",
    showServico: "Serviços Solicitados",
    showLocal: "Vaga / Hangar / Box Alocado",
    showHoraMarcada: "ETA (Horário estimado de pouso)",
    showObservacao: "Observações",
    showModelo: "Modelo da Aeronave",
    showUrgencia: "Urgência da Peça",
  },
  hangarUnallocatedLabel: "NÃO ALOCADO",
  hangarQuickCrudTitle: "Vaga / Hangar / Box",
  baseQuickCrudTitle: "Nova base / aeroporto",
  liberadoTabId: AVIACAO_QUEUE_TAB.LIBERADO,
  emManutencaoTabId: AVIACAO_QUEUE_TAB.EM_MANUTENCAO,
  headerChamarLabel: "Chamar p/ Hangar",
  headerIniciarLabel: "Iniciar Operação",
  headerFinalizarLabel: "Liberar / Decolar",
  headerFinalizarLiberadoLabel: "Finalizar",
  validation: {
    prefixoRequired: "Prefixo da Aeronave é obrigatório.",
    hangarRequired: "Vaga / Hangar / Box é obrigatório.",
    hobbsRequired: "Horas de Voo (Hobbs) é obrigatório.",
    combustivelRequired: "Nível de Combustível é obrigatório.",
    servicosRequired: "Selecione ao menos um serviço solicitado.",
  },
  hobbsFieldLabel: "Horas de Voo (Hobbs)",
  combustivelFieldLabel: "Nível de Combustível",
  avariaSnippetPrefix: "Avaria registrada",
  avariaPrompt: "Descreva a avaria registrada:",
  avariaTimelineAction: "Avaria registrada",
  avariaButtonLabel: "Registrar Avaria",
  timelineBaseFallback: "Base",
  baseSelectorLabel: "Base / Aeroporto",
  hangarQuickAddButtonLabel: "+ Hangar",
  hangarQuickAddButtonTitle: "Cadastrar vaga / hangar / box",
  combustivelOptions: ["Vazio", "1/4", "1/2", "3/4", "Full"],
  timelineSectionTitle: "Linha do Tempo de Rampa",
  timelineLogPrefix: "Base",
  registerInteligenteHint:
    "No modo aviação MRO, responsável, serviços e hangar seguem os campos do registro de rampa.",
  registryExtras: MRO_REGISTRY_EXTRAS_DEFAULT,
  equipeQuickAddButtonLabel: "+ Equipe",
  equipeQuickAddButtonTitle: "Cadastrar responsável / mecânico",
};

const AUTOMOTIVO_PROFILE: MroSegmentProfile = {
  segmentId: AUTOMOTIVO_SEGMENT_ID,
  pipelineOrder: [
    AUTOMOTIVO_QUEUE_TAB.TRIAGEM,
    AUTOMOTIVO_QUEUE_TAB.ORCAMENTO,
    AUTOMOTIVO_QUEUE_TAB.AGUARDANDO_PECAS,
    AUTOMOTIVO_QUEUE_TAB.EM_MANUTENCAO,
    AUTOMOTIVO_QUEUE_TAB.LAVAGEM_ESTETICA,
    AUTOMOTIVO_QUEUE_TAB.PRONTO_RETIRADA,
  ],
  stepLabels: {
    [AUTOMOTIVO_QUEUE_TAB.TRIAGEM]: "TRIAGEM / CHECK-IN",
    [AUTOMOTIVO_QUEUE_TAB.ORCAMENTO]: "ORÇAMENTO",
    [AUTOMOTIVO_QUEUE_TAB.AGUARDANDO_PECAS]: "AGUARDANDO PEÇAS",
    [AUTOMOTIVO_QUEUE_TAB.EM_MANUTENCAO]: "EM MANUTENÇÃO",
    [AUTOMOTIVO_QUEUE_TAB.LAVAGEM_ESTETICA]: "LAVAGEM / ESTÉTICA",
    [AUTOMOTIVO_QUEUE_TAB.PRONTO_RETIRADA]: "PRONTO / RETIRADA",
  },
  legacyTabAliases: {
    "of-t1": AUTOMOTIVO_QUEUE_TAB.ORCAMENTO,
    "of-t2": AUTOMOTIVO_QUEUE_TAB.AGUARDANDO_PECAS,
    "of-t3": AUTOMOTIVO_QUEUE_TAB.EM_MANUTENCAO,
    "of-t4": AUTOMOTIVO_QUEUE_TAB.LAVAGEM_ESTETICA,
    "of-t5": AUTOMOTIVO_QUEUE_TAB.PRONTO_RETIRADA,
    inspecao_qc: AUTOMOTIVO_QUEUE_TAB.EM_MANUTENCAO,
    teste_voo: AUTOMOTIVO_QUEUE_TAB.EM_MANUTENCAO,
    estetica_lavagem: AUTOMOTIVO_QUEUE_TAB.LAVAGEM_ESTETICA,
    liberado: AUTOMOTIVO_QUEUE_TAB.PRONTO_RETIRADA,
  },
  categoryDisplayLabels: {
    "av-c1": "Mecânico / Detalhador",
    "av-c2": "Elevador / Box Ocupado",
    "av-c3": "Placa do Veículo",
    "av-c4": "Marca / Modelo do Carro",
    "av-c5": "Urgência da Peça",
  },
  hybridFieldCanonicalLabels: {
    "av-c1": ["Mecânico / Detalhador"],
    "av-c3": ["Placa do Veículo"],
    "av-c4": ["Marca / Modelo do Carro"],
  },
  registerFormLabels: {
    showClienteNome: "Nome do Proprietário",
    showProfissional: "Mecânico / Detalhador",
    showServico: "Serviços Solicitados",
    showLocal: "Elevador / Box Ocupado",
    showHoraMarcada: "Previsão de Retirada",
    showObservacao: "Observações",
    showModelo: "Marca / Modelo do Carro",
    showUrgencia: "Urgência da Peça",
  },
  hangarUnallocatedLabel: "SEM BOX",
  hangarQuickCrudTitle: "Elevador / Box",
  baseQuickCrudTitle: "Nova unidade / filial",
  liberadoTabId: AUTOMOTIVO_QUEUE_TAB.PRONTO_RETIRADA,
  emManutencaoTabId: AUTOMOTIVO_QUEUE_TAB.EM_MANUTENCAO,
  headerChamarLabel: "Chamar para o Box",
  headerIniciarLabel: "Iniciar Serviço",
  headerFinalizarLabel: "Liberar Veículo",
  headerFinalizarLiberadoLabel: "Finalizar",
  validation: {
    prefixoRequired: "Placa do Veículo é obrigatória.",
    hangarRequired: "Elevador / Box é obrigatório.",
    hobbsRequired: "Quilometragem é obrigatória.",
    combustivelRequired: "Nível de Combustível é obrigatório.",
    servicosRequired: "Selecione ao menos um serviço solicitado.",
  },
  hobbsFieldLabel: "Quilometragem (km)",
  combustivelFieldLabel: "Nível de Combustível",
  avariaSnippetPrefix: "Dano no veículo registrado",
  avariaPrompt: "Descreva os danos no veículo:",
  avariaTimelineAction: "Dano no veículo registrado",
  avariaButtonLabel: "Registrar Danos",
  timelineBaseFallback: "Unidade",
  baseSelectorLabel: "Auto",
  hangarQuickAddButtonLabel: "+ Box",
  hangarQuickAddButtonTitle: "Cadastrar elevador / box",
  combustivelOptions: ["Vazio", "1/4", "1/2", "3/4", "Cheio"],
  timelineSectionTitle: "Linha do Tempo do Box",
  timelineLogPrefix: "Auto",
  registerInteligenteHint:
    "No modo Oficina Mecânica, os campos de responsável, serviços e box seguem o padrão operacional de pátio.",
  registryExtras: MRO_REGISTRY_EXTRAS_DEFAULT,
  equipeQuickAddButtonLabel: "+ Equipe",
  equipeQuickAddButtonTitle: "Cadastrar mecânico / detalhador",
};

const HARDWARE_TI_PROFILE: MroSegmentProfile = {
  segmentId: HARDWARE_TI_SEGMENT_ID,
  pipelineOrder: [
    AUTOMOTIVO_QUEUE_TAB.TRIAGEM,
    AUTOMOTIVO_QUEUE_TAB.ORCAMENTO,
    AUTOMOTIVO_QUEUE_TAB.AGUARDANDO_PECAS,
    AUTOMOTIVO_QUEUE_TAB.EM_MANUTENCAO,
    AUTOMOTIVO_QUEUE_TAB.LAVAGEM_ESTETICA,
    AUTOMOTIVO_QUEUE_TAB.PRONTO_RETIRADA,
  ],
  stepLabels: {
    [AUTOMOTIVO_QUEUE_TAB.TRIAGEM]: "TRIAGEM / ENTRADA",
    [AUTOMOTIVO_QUEUE_TAB.ORCAMENTO]: "DIAGNÓSTICO / ORÇAMENTO",
    [AUTOMOTIVO_QUEUE_TAB.AGUARDANDO_PECAS]: "AGUARDANDO PEÇAS",
    [AUTOMOTIVO_QUEUE_TAB.EM_MANUTENCAO]: "EM REPARO",
    [AUTOMOTIVO_QUEUE_TAB.LAVAGEM_ESTETICA]: "HIGIENIZAÇÃO / TESTES",
    [AUTOMOTIVO_QUEUE_TAB.PRONTO_RETIRADA]: "PRONTO PARA RETIRADA",
  },
  legacyTabAliases: {
    ...AUTOMOTIVO_PROFILE.legacyTabAliases,
  },
  categoryDisplayLabels: {
    "av-c1": "Técnico Responsável",
    "av-c2": "Bancada de Trabalho",
    "av-c3": "Número de Série (S/N) / ID da OS",
    "av-c4": "Tipo de Defeito",
    "av-c5": "Peça Necessária",
  },
  hybridFieldCanonicalLabels: {
    "av-c1": ["Técnico Responsável"],
    "av-c3": ["Número de Série (S/N) / ID da OS"],
    "av-c4": ["Tipo de Defeito"],
    "av-c5": ["Peça Necessária"],
  },
  registerFormLabels: {
    showClienteNome: "Nome do Cliente",
    showProfissional: "Técnico Responsável",
    showServico: "Serviços Solicitados",
    showLocal: "Bancada de Trabalho",
    showHoraMarcada: "Previsão de Retirada",
    showObservacao: "Observações",
    showModelo: "Tipo de Defeito",
    showUrgencia: "Peça Necessária",
  },
  hangarUnallocatedLabel: "SEM BANCADA",
  hangarQuickCrudTitle: "Bancada de Trabalho",
  baseQuickCrudTitle: "Nova unidade / filial",
  baseSelectorOptions: ["Notebook", "Smartphone", "Desktop", "Console", "Servidor", "Outros"],
  liberadoTabId: AUTOMOTIVO_QUEUE_TAB.PRONTO_RETIRADA,
  emManutencaoTabId: AUTOMOTIVO_QUEUE_TAB.EM_MANUTENCAO,
  headerChamarLabel: "Chamar para Bancada",
  headerIniciarLabel: "Iniciar Reparo",
  headerFinalizarLabel: "Entregar Equipamento",
  headerFinalizarLiberadoLabel: "Finalizar",
  validation: {
    prefixoRequired: "Número de Série (S/N) / ID da OS é obrigatório.",
    hangarRequired: "Bancada de Trabalho é obrigatória.",
    hobbsRequired: "Capacidade / Armazenamento é obrigatório.",
    combustivelRequired: "Nível de Bateria é obrigatório.",
    servicosRequired: "Selecione ao menos um serviço solicitado.",
  },
  hobbsFieldLabel: "Capacidade / Armazenamento",
  combustivelFieldLabel: "Nível de Bateria",
  avariaSnippetPrefix: "Condição física registrada",
  avariaPrompt: "Descreva a condição física do equipamento:",
  avariaTimelineAction: "Condição física registrada",
  avariaButtonLabel: "Registrar Condição Física",
  timelineBaseFallback: "Unidade",
  baseSelectorLabel: "Tipo de Dispositivo",
  hangarQuickAddButtonLabel: "+ Bancada",
  hangarQuickAddButtonTitle: "Cadastrar bancada de trabalho",
  combustivelOptions: ["Crítico", "Baixo", "Médio", "Alto", "100%"],
  timelineSectionTitle: "Linha do Tempo do Reparo",
  timelineLogPrefix: "TI",
  registerInteligenteHint:
    "No modo Assistência de Hardware/TI, S/N, defeito e peça são digitados livremente; bancada e técnico podem ser alocados na triagem.",
  registryExtras: MRO_REGISTRY_EXTRAS_HARDWARE_TI,
  equipeQuickAddButtonLabel: "+ Equipe",
  equipeQuickAddButtonTitle: "Cadastrar técnico responsável",
};

const MRO_PROFILES: Record<MroSegmentId, MroSegmentProfile> = {
  [AVIACAO_SEGMENT_ID]: AVIACAO_PROFILE,
  [AUTOMOTIVO_SEGMENT_ID]: AUTOMOTIVO_PROFILE,
  [HARDWARE_TI_SEGMENT_ID]: HARDWARE_TI_PROFILE,
};

function normalizeMroSegmentKey(
  segmentoAplicado: string | null | undefined
): string | null {
  if (!segmentoAplicado?.trim()) return null;
  if (segmentoAplicado === "ti_reparo") return HARDWARE_TI_SEGMENT_ID;
  return segmentoAplicado;
}

export function isMroLogisticsSegment(
  segmentoAplicado: string | null | undefined
): segmentoAplicado is MroSegmentId {
  const key = normalizeMroSegmentKey(segmentoAplicado);
  return (
    key === AVIACAO_SEGMENT_ID ||
    key === AUTOMOTIVO_SEGMENT_ID ||
    key === HARDWARE_TI_SEGMENT_ID
  );
}

export function isAutomotivoSegment(
  segmentoAplicado: string | null | undefined
): segmentoAplicado is typeof AUTOMOTIVO_SEGMENT_ID {
  return segmentoAplicado === AUTOMOTIVO_SEGMENT_ID;
}

export function isHardwareTiSegment(
  segmentoAplicado: string | null | undefined
): segmentoAplicado is typeof HARDWARE_TI_SEGMENT_ID {
  return normalizeMroSegmentKey(segmentoAplicado) === HARDWARE_TI_SEGMENT_ID;
}

/** Segmentos MRO de pátio/bancada com linha compacta S/N + modelo + alocação. */
export function isMroPatioCompactSegment(
  segmentoAplicado: string | null | undefined
): boolean {
  return isAutomotivoSegment(segmentoAplicado) || isHardwareTiSegment(segmentoAplicado);
}

export function resolveMroProfile(
  segmentoAplicado: string | null | undefined
): MroSegmentProfile {
  const key = normalizeMroSegmentKey(segmentoAplicado);
  if (key === AUTOMOTIVO_SEGMENT_ID) return AUTOMOTIVO_PROFILE;
  if (key === HARDWARE_TI_SEGMENT_ID) return HARDWARE_TI_PROFILE;
  return AVIACAO_PROFILE;
}

export function resolveMroCombustivelOptions(
  segmentoAplicado: string | null | undefined
): readonly string[] {
  return resolveMroProfile(segmentoAplicado).combustivelOptions;
}

export function resolveMroRegistryExtras(
  segmentoAplicado: string | null | undefined
): MroRegistryExtras {
  return resolveMroProfile(segmentoAplicado).registryExtras;
}

export function buildMroCanonicalQueueTabs(
  segmentoAplicado: string | null | undefined
): Array<{ id: string; preset: "outros"; label: string; customTypeLabel: string }> {
  const profile = resolveMroProfile(segmentoAplicado);
  return profile.pipelineOrder.map((id) => {
    const label =
      profile.stepLabels[id]
        ?.split("/")
        .map((part) => part.trim())
        .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
        .join(" / ") ?? id;
    const isHardwareTi = profile.segmentId === HARDWARE_TI_SEGMENT_ID;
    const display =
      isHardwareTi && id === AUTOMOTIVO_QUEUE_TAB.TRIAGEM
        ? "Triagem / Entrada"
        : isHardwareTi && id === AUTOMOTIVO_QUEUE_TAB.ORCAMENTO
          ? "Diagnóstico / Orçamento"
          : isHardwareTi && id === AUTOMOTIVO_QUEUE_TAB.AGUARDANDO_PECAS
            ? "Aguardando Peças"
            : isHardwareTi && id === AUTOMOTIVO_QUEUE_TAB.EM_MANUTENCAO
              ? "Em Reparo"
              : isHardwareTi && id === AUTOMOTIVO_QUEUE_TAB.LAVAGEM_ESTETICA
                ? "Higienização / Testes"
                : isHardwareTi && id === AUTOMOTIVO_QUEUE_TAB.PRONTO_RETIRADA
                  ? "Pronto para Retirada"
                  : id === AUTOMOTIVO_QUEUE_TAB.TRIAGEM || id === AVIACAO_QUEUE_TAB.TRIAGEM
                    ? "Triagem / Check-in"
                    : id === AUTOMOTIVO_QUEUE_TAB.ORCAMENTO
                      ? "Orçamento"
                      : id === AUTOMOTIVO_QUEUE_TAB.AGUARDANDO_PECAS ||
                          id === AVIACAO_QUEUE_TAB.AGUARDANDO_PECAS
                        ? "Aguardando Peças"
                        : id === AUTOMOTIVO_QUEUE_TAB.EM_MANUTENCAO ||
                            id === AVIACAO_QUEUE_TAB.EM_MANUTENCAO
                          ? "Em Manutenção"
                          : id === AUTOMOTIVO_QUEUE_TAB.LAVAGEM_ESTETICA
                            ? "Lavagem / Estética"
                            : id === AUTOMOTIVO_QUEUE_TAB.PRONTO_RETIRADA
                              ? "Pronto / Retirada"
                              : id === AVIACAO_QUEUE_TAB.INSPECAO_QC
                                ? "Inspeção / QC"
                                : id === AVIACAO_QUEUE_TAB.TESTE_VOO
                                  ? "Teste de Voo"
                                  : id === AVIACAO_QUEUE_TAB.ESTETICA_LAVAGEM
                                    ? "Estética / Lavagem"
                                    : id === AVIACAO_QUEUE_TAB.LIBERADO
                                      ? "Liberado / Pronto"
                                      : label;
    return { id, preset: "outros" as const, label: display, customTypeLabel: display };
  });
}
