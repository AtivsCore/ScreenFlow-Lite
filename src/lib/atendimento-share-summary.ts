import { formatCreatedAt, formatHoraMarcada, type AtendimentoLite } from "@/lib/atendimentos-lite";
import type { CadastroLookups } from "@/lib/cadastro-valores";
import {
  AVIACAO_FIELD_SERVICOS,
  AVIACAO_HANGAR_CATEGORY_ID,
  AVIACAO_MODELO_CATEGORY_ID,
  AVIACAO_PREFIXO_CATEGORY_ID,
  formatAviacaoObservacaoForDisplay,
  parseAviacaoCadastroFields,
  parseAviacaoServicosSolicitados,
  resolveAviacaoCategoryDisplay,
  resolveAviacaoTabIdFromObservacao,
  getAviacaoStepLabel,
} from "@/lib/aviacao-logistics";
import {
  isSalaoEsteticaSegment,
  parseSalaoCadastroFields,
  parseSalaoServicosSolicitados,
  resolveSalaoCategoryDisplay,
  resolveSalaoLocalLabel,
  resolveSalaoProfissionalLabel,
  resolveSalaoTabIdFromObservacao,
  getSalaoStepLabel,
  formatSalaoObservacaoForDisplay,
} from "@/lib/salao-estetica-logistics";
import type { CadastroCategoryEntry, QueueTabEntry } from "@/lib/tenant-config";

function resolveServicosSolicitadosLabel(
  row: AtendimentoLite,
  lookups: CadastroLookups
): string {
  const inline = parseAviacaoCadastroFields(row.observacao);
  const ids = parseAviacaoServicosSolicitados(inline[AVIACAO_FIELD_SERVICOS]);
  if (ids.length === 0) return "—";
  const names = ids.map((id) => lookups.servicos.get(id)?.trim() || id);
  return names.join(", ");
}

function resolveSalaoServicosLabel(
  row: AtendimentoLite,
  lookups: CadastroLookups,
  categories: CadastroCategoryEntry[]
): string {
  const inline = parseSalaoCadastroFields(row.observacao);
  const ids = parseSalaoServicosSolicitados(inline["sal-svc"]);
  if (ids.length > 0) {
    return ids.map((id) => lookups.servicos.get(id)?.trim() || id).join(", ");
  }
  const legacy = {
    profissional_id: row.profissional_id,
    local_id: row.local_id,
    especialidade_id: row.especialidade_id,
    profissionalNome: row.profissionalNome,
    localNome: row.localNome,
    servicoNome: row.servicoNome,
  };
  return (
    resolveSalaoCategoryDisplay(
      "sal-c3",
      row.observacao,
      row.cadastro_valores ?? {},
      lookups,
      categories,
      legacy
    ) ?? "—"
  );
}

function buildSalaoShareSummary(
  row: AtendimentoLite,
  options: {
    cadastroCategories: CadastroCategoryEntry[];
    cadastroLookups: CadastroLookups;
    queueTabIds?: Array<Pick<QueueTabEntry, "id">>;
    establishmentName?: string;
  }
): string {
  const categories = options.cadastroCategories.filter((c) => c.enabled);
  const estabelecimento = options.establishmentName?.trim() || "ScreenFlow Lite";
  const cliente = row.nome?.trim() || "—";
  const horarioData = row.hora_marcada
    ? formatHoraMarcada(row.hora_marcada)
    : formatCreatedAt(row.created_at);
  const servicos = resolveSalaoServicosLabel(row, options.cadastroLookups, categories);
  const profissional =
    resolveSalaoProfissionalLabel(row, categories, options.cadastroLookups) ?? "—";
  const local = resolveSalaoLocalLabel(row, categories, options.cadastroLookups) ?? "—";

  let etapa = "—";
  if (options.queueTabIds?.length) {
    const tabId = resolveSalaoTabIdFromObservacao(row.observacao, options.queueTabIds);
    if (tabId) {
      etapa = getSalaoStepLabel(tabId);
    }
  }

  const lines = [
    `${estabelecimento} - Confirmação de Atendimento`,
    "",
    `Cliente: ${cliente}`,
    `Horário/Data: ${horarioData}`,
    `Serviço(s): ${servicos}`,
    `Profissional: ${profissional}`,
    `Local: ${local}`,
    `Etapa: ${etapa}`,
  ];

  const observacoes = formatSalaoObservacaoForDisplay(row.observacao);
  if (observacoes) {
    lines.push(`Observações: ${observacoes}`);
  }

  return lines.join("\n");
}

function buildMroShareSummary(
  row: AtendimentoLite,
  options: {
    cadastroCategories: CadastroCategoryEntry[];
    cadastroLookups: CadastroLookups;
    segmentoAplicado?: string | null;
    queueTabIds?: Array<Pick<QueueTabEntry, "id">>;
  }
): string {
  const categories = options.cadastroCategories.filter((c) => c.enabled);
  const legacy = {
    profissional_id: row.profissional_id,
    local_id: row.local_id,
    especialidade_id: row.especialidade_id,
    profissionalNome: row.profissionalNome,
    localNome: row.localNome,
    servicoNome: row.servicoNome,
  };

  const cliente = row.nome?.trim() || "—";

  const sn =
    resolveAviacaoCategoryDisplay(
      AVIACAO_PREFIXO_CATEGORY_ID,
      row.observacao,
      row.cadastro_valores ?? {},
      options.cadastroLookups,
      categories,
      legacy
    ) ?? "—";

  const defeito =
    resolveAviacaoCategoryDisplay(
      AVIACAO_MODELO_CATEGORY_ID,
      row.observacao,
      row.cadastro_valores ?? {},
      options.cadastroLookups,
      categories,
      legacy
    ) ?? "—";

  const bancada =
    resolveAviacaoCategoryDisplay(
      AVIACAO_HANGAR_CATEGORY_ID,
      row.observacao,
      row.cadastro_valores ?? {},
      options.cadastroLookups,
      categories,
      legacy
    )?.trim() || null;

  const previsao = row.hora_marcada ? formatHoraMarcada(row.hora_marcada) : "—";
  const servicos = resolveServicosSolicitadosLabel(row, options.cadastroLookups);

  let etapa = "—";
  if (options.queueTabIds?.length) {
    const tabId = resolveAviacaoTabIdFromObservacao(row.observacao, options.queueTabIds);
    if (tabId) {
      etapa = getAviacaoStepLabel(tabId, undefined, options.segmentoAplicado);
    }
  }

  const observacoes = formatAviacaoObservacaoForDisplay(row.observacao) || "—";

  const lines = [
    "📋 *Ordem de Serviço — ScreenFlow Lite*",
    "",
    `*Cliente:* ${cliente}`,
    `*S/N / OS:* ${sn}`,
    `*Defeito:* ${defeito}`,
  ];

  if (bancada) lines.push(bancada);

  lines.push(
    `*Previsão de retirada:* ${previsao}`,
    `*Serviços Solicitados:* ${servicos}`,
    `*Etapa:* ${etapa}`,
    `*Observações:* ${observacoes}`
  );

  return lines.join("\n");
}

export function buildAtendimentoShareSummary(
  row: AtendimentoLite,
  options: {
    cadastroCategories: CadastroCategoryEntry[];
    cadastroLookups: CadastroLookups;
    segmentoAplicado?: string | null;
    queueTabIds?: Array<Pick<QueueTabEntry, "id">>;
    establishmentName?: string;
  }
): string {
  if (isSalaoEsteticaSegment(options.segmentoAplicado)) {
    return buildSalaoShareSummary(row, options);
  }
  return buildMroShareSummary(row, options);
}

export async function copyAtendimentoShareSummary(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
