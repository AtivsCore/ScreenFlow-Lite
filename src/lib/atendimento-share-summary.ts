import { formatHoraMarcada, normalizeQueueStatusLabel, type AtendimentoLite } from "@/lib/atendimentos-lite";
import type { CadastroLookups } from "@/lib/cadastro-valores";
import {
  AVIACAO_HANGAR_CATEGORY_ID,
  AVIACAO_MODELO_CATEGORY_ID,
  AVIACAO_PREFIXO_CATEGORY_ID,
  resolveAviacaoCategoryDisplay,
  resolveAviacaoTabIdFromObservacao,
  getAviacaoStepLabel,
} from "@/lib/aviacao-logistics";
import type { CadastroCategoryEntry, QueueTabEntry } from "@/lib/tenant-config";

export function buildAtendimentoShareSummary(
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

  const sn =
    resolveAviacaoCategoryDisplay(
      AVIACAO_PREFIXO_CATEGORY_ID,
      row.observacao,
      row.cadastro_valores ?? {},
      options.cadastroLookups,
      categories,
      legacy
    ) ?? row.nome?.trim() ?? "—";

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
    ) ?? "—";

  const cliente = row.nome?.trim() || "—";
  const previsao = row.hora_marcada ? formatHoraMarcada(row.hora_marcada) : "—";
  const status = normalizeQueueStatusLabel(row.status);

  let etapa = "—";
  if (options.queueTabIds?.length) {
    const tabId = resolveAviacaoTabIdFromObservacao(row.observacao, options.queueTabIds);
    if (tabId) {
      etapa = getAviacaoStepLabel(tabId, undefined, options.segmentoAplicado);
    }
  }

  return [
    "📋 *Ordem de Serviço — ScreenFlow Lite*",
    "",
    `*Cliente:* ${cliente}`,
    `*S/N / OS:* ${sn}`,
    `*Defeito:* ${defeito}`,
    `*Bancada:* ${bancada}`,
    `*Previsão de retirada:* ${previsao}`,
    `*Status:* ${status}`,
    `*Etapa:* ${etapa}`,
  ].join("\n");
}

export async function copyAtendimentoShareSummary(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
