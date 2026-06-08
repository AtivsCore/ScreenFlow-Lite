import type { AtendimentoLite } from "@/lib/atendimentos-lite";
import type { CadastroLookups } from "@/lib/cadastro-valores";
import { resolveCategoryDisplayLabel } from "@/lib/cadastro-valores";
import {
  AVIACAO_FIELD_COMBUSTIVEL,
  AVIACAO_FIELD_HOBBS,
  AVIACAO_FIELD_SERVICOS,
  AVIACAO_PREFIXO_CATEGORY_ID,
  AVIACAO_MODELO_CATEGORY_ID,
  AVIACAO_RESPONSAVEL_CATEGORY_ID,
  AVIACAO_HANGAR_CATEGORY_ID,
  formatAviacaoObservacaoForDisplay,
  formatAviacaoTimelineLine,
  isMroLogisticsSegment,
  parseAviacaoCadastroFields,
  parseAviacaoServicosSolicitados,
  parseAviacaoTimeline,
  resolveAviacaoCategoryDisplay,
  resolveMroFieldLabels,
  resolveMroRegisterFormLabels,
  resolveMroTimelineSectionTitle,
} from "@/lib/aviacao-logistics";
import { formatObservacaoForDisplay } from "@/lib/fila-preset";
import type { ResolvedTenantConfig } from "@/lib/tenant-config";

export type PrintAtendimentoContext = {
  row: AtendimentoLite;
  tenantConfig: ResolvedTenantConfig;
  cadastroLookups: CadastroLookups;
  baseOptions?: Array<{ id: string; nome: string | null }>;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatHoraMarcada(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resolveServicosLabel(
  raw: string | undefined,
  lookups: CadastroLookups
): string {
  const ids = parseAviacaoServicosSolicitados(raw);
  if (ids.length === 0) return "—";
  const names = ids.map((id) => lookups.servicos.get(id)?.trim() || id);
  return names.join(", ");
}

function buildMroPrintFields(
  ctx: PrintAtendimentoContext
): Array<{ label: string; value: string }> {
  const { row, tenantConfig, cadastroLookups } = ctx;
  const segmento = tenantConfig.segmentoAplicado;
  const labels = resolveMroFieldLabels(segmento);
  const inline = parseAviacaoCadastroFields(row.observacao);
  const categories = tenantConfig.cadastroCategories.filter((c) => c.enabled);
  const legacy = {
    profissional_id: row.profissional_id,
    local_id: row.local_id,
    especialidade_id: row.especialidade_id,
    profissionalNome: row.profissionalNome,
    localNome: row.localNome,
    servicoNome: row.servicoNome,
  };

  const display = (categoryId: string, fallbackLabel: string) => {
    const value =
      resolveAviacaoCategoryDisplay(
        categoryId,
        row.observacao,
        row.cadastro_valores ?? {},
        cadastroLookups,
        categories,
        legacy
      ) ?? inline[categoryId];
    return { label: fallbackLabel, value: value?.trim() || "—" };
  };

  const registerLabels = resolveMroRegisterFormLabels(segmento);

  const fields: Array<{ label: string; value: string }> = [
    display(AVIACAO_PREFIXO_CATEGORY_ID, labels.prefixo),
    display(AVIACAO_MODELO_CATEGORY_ID, labels.modelo),
    { label: registerLabels.showClienteNome, value: row.nome?.trim() || "—" },
    display(AVIACAO_RESPONSAVEL_CATEGORY_ID, labels.responsavel),
    display(AVIACAO_HANGAR_CATEGORY_ID, labels.hangar),
    { label: labels.hobbs, value: inline[AVIACAO_FIELD_HOBBS]?.trim() || "—" },
    { label: labels.combustivel, value: inline[AVIACAO_FIELD_COMBUSTIVEL]?.trim() || "—" },
    {
      label: registerLabels.showServico,
      value: resolveServicosLabel(inline[AVIACAO_FIELD_SERVICOS], cadastroLookups),
    },
  ];

  const hora = formatHoraMarcada(row.hora_marcada);
  if (hora !== "—" && tenantConfig.registerForm.showHoraMarcada) {
    fields.push({ label: registerLabels.showHoraMarcada, value: hora });
  }

  const obs = formatAviacaoObservacaoForDisplay(row.observacao);
  if (obs) fields.push({ label: registerLabels.showObservacao, value: obs });

  return fields;
}

function buildGenericPrintFields(
  ctx: PrintAtendimentoContext
): Array<{ label: string; value: string }> {
  const { row, tenantConfig, cadastroLookups } = ctx;
  const categories = tenantConfig.cadastroCategories.filter((c) => c.enabled);
  const legacy = {
    profissional_id: row.profissional_id,
    local_id: row.local_id,
    especialidade_id: row.especialidade_id,
    profissionalNome: row.profissionalNome,
    localNome: row.localNome,
    servicoNome: row.servicoNome,
  };

  const fields: Array<{ label: string; value: string }> = [];
  if (row.nome?.trim()) fields.push({ label: "Nome", value: row.nome.trim() });

  for (const cat of categories) {
    const value =
      resolveCategoryDisplayLabel(
        cat.id,
        row.cadastro_valores ?? {},
        cadastroLookups,
        categories,
        undefined,
        legacy
      ) ?? "—";
    fields.push({ label: cat.label, value });
  }

  fields.push({ label: "Status", value: row.status?.trim() || "—" });
  const obs = formatObservacaoForDisplay(row.observacao);
  if (obs) fields.push({ label: "Observações", value: obs });

  return fields;
}

export function buildAtendimentoPrintHtml(ctx: PrintAtendimentoContext): string {
  const { row, tenantConfig } = ctx;
  const segmento = tenantConfig.segmentoAplicado;
  const mroMode = isMroLogisticsSegment(segmento);
  const fields = mroMode ? buildMroPrintFields(ctx) : buildGenericPrintFields(ctx);
  const timeline = mroMode ? parseAviacaoTimeline(row.observacao) : [];
  const timelineTitle = mroMode ? resolveMroTimelineSectionTitle(segmento) : "Histórico";
  const title = mroMode
    ? fields.find((f) => f.label.includes("Placa") || f.label.includes("Prefixo"))?.value ?? "Ficha"
    : row.nome?.trim() || "Registro";

  const fieldRows = fields
    .map(
      (f) =>
        `<tr><th>${escapeHtml(f.label)}</th><td>${escapeHtml(f.value)}</td></tr>`
    )
    .join("");

  const timelineItems =
    timeline.length > 0
      ? [...timeline]
          .reverse()
          .map(
            (entry) =>
              `<li>${escapeHtml(formatAviacaoTimelineLine(entry, segmento))}</li>`
          )
          .join("")
      : "<li>Nenhuma movimentação registrada.</li>";

  const printedAt = new Date().toLocaleString("pt-BR");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Ficha — ${escapeHtml(String(title))}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", system-ui, sans-serif;
      color: #111;
      margin: 0;
      padding: 24px;
      background: #fff;
    }
    h1 { font-size: 1.25rem; margin: 0 0 4px; }
    .meta { font-size: 0.75rem; color: #555; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.85rem; }
    th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { width: 34%; background: #f4f4f5; font-weight: 600; }
    h2 { font-size: 0.95rem; margin: 0 0 8px; }
    ul { margin: 0; padding-left: 1.1rem; font-size: 0.8rem; line-height: 1.5; }
    li { margin-bottom: 4px; }
    @media print {
      body { padding: 12mm; }
      @page { size: A4; margin: 12mm; }
    }
  </style>
</head>
<body>
  <h1>ScreenFlow Lite — Ficha do Registro</h1>
  <p class="meta">Impresso em ${escapeHtml(printedAt)} · ID ${escapeHtml(row.id)}</p>
  <table>
    <tbody>${fieldRows}</tbody>
  </table>
  ${
    mroMode
      ? `<h2>${escapeHtml(timelineTitle)}</h2><ul>${timelineItems}</ul>`
      : ""
  }
</body>
</html>`;
}

export function printAtendimentoCard(ctx: PrintAtendimentoContext): void {
  const html = buildAtendimentoPrintHtml(ctx);
  const win = window.open("", "_blank", "noopener,noreferrer,width=820,height=900");
  if (!win) {
    window.alert("Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  const trigger = () => {
    win.print();
    win.onafterprint = () => win.close();
  };
  if (win.document.readyState === "complete") trigger();
  else win.onload = trigger;
}
