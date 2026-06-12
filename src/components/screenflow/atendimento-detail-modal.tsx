"use client";

import type { AtendimentoLite } from "@/lib/atendimentos-lite";
import { formatHoraMarcada, normalizeQueueStatusLabel } from "@/lib/atendimentos-lite";
import type { CadastroLookups } from "@/lib/cadastro-valores";
import {
  AVIACAO_FIELD_DEVICE_TYPE,
  AVIACAO_FIELD_SERVICOS,
  AVIACAO_HANGAR_CATEGORY_ID,
  AVIACAO_MODELO_CATEGORY_ID,
  AVIACAO_PREFIXO_CATEGORY_ID,
  AVIACAO_RESPONSAVEL_CATEGORY_ID,
  formatAviacaoObservacaoForDisplay,
  getAviacaoStepLabel,
  parseAviacaoCadastroFields,
  parseAviacaoServicosSolicitados,
  resolveAviacaoCategoryDisplay,
  resolveAviacaoTabIdFromObservacao,
} from "@/lib/aviacao-logistics";
import {
  buildAtendimentoShareSummary,
  copyAtendimentoShareSummary,
} from "@/lib/atendimento-share-summary";
import {
  SALAO_FIELD_SERVICOS,
  SALAO_LOCAL_CATEGORY_ID,
  SALAO_PROFISSIONAL_CATEGORY_ID,
  SALAO_REGISTER_FORM_LABELS,
  formatSalaoObservacaoForDisplay,
  normalizeSalaoStatusLabel,
  resolveSalaoQueueTabLabel,
  isSalaoEsteticaSegment,
  parseSalaoCadastroFields,
  parseSalaoServicosSolicitados,
  resolveSalaoCategoryDisplay,
  resolveSalaoTabIdFromObservacao,
} from "@/lib/salao-estetica-logistics";
import type { CadastroCategoryEntry, QueueTabEntry } from "@/lib/tenant-config";
import { Modal } from "@/components/ui/modal";
import { Copy, Pencil } from "lucide-react";
import { useMemo, useState } from "react";

type AtendimentoDetailModalProps = {
  open: boolean;
  row: AtendimentoLite | null;
  onClose: () => void;
  cadastroCategories: CadastroCategoryEntry[];
  cadastroLookups: CadastroLookups;
  segmentoAplicado?: string | null;
  queueTabs: QueueTabEntry[];
  onEdit?: (row: AtendimentoLite) => void;
  onSelect?: (id: string) => void;
};

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">{value || "—"}</dd>
    </div>
  );
}

export function AtendimentoDetailModal({
  open,
  row,
  onClose,
  cadastroCategories,
  cadastroLookups,
  segmentoAplicado,
  queueTabs,
  onEdit,
  onSelect,
}: AtendimentoDetailModalProps) {
  const [copyOk, setCopyOk] = useState(false);
  const salaoMode = isSalaoEsteticaSegment(segmentoAplicado);
  const flowTabs = useMemo(() => queueTabs.filter((t) => t.preset !== "todos"), [queueTabs]);

  const fields = useMemo(() => {
    if (!row) return null;
    const categories = cadastroCategories.filter((c) => c.enabled);
    const legacy = {
      profissional_id: row.profissional_id,
      local_id: row.local_id,
      especialidade_id: row.especialidade_id,
      profissionalNome: row.profissionalNome,
      localNome: row.localNome,
      servicoNome: row.servicoNome,
    };

    if (salaoMode) {
      const inline = parseSalaoCadastroFields(row.observacao);
      const servicosFromTag = parseSalaoServicosSolicitados(inline[SALAO_FIELD_SERVICOS]);
      const servicos =
        servicosFromTag.length > 0
          ? servicosFromTag
              .map((id) => cadastroLookups.servicos.get(id)?.trim())
              .filter((label): label is string => Boolean(label?.trim()))
              .join(", ")
          : resolveSalaoCategoryDisplay(
              "sal-c3",
              row.observacao,
              row.cadastro_valores ?? {},
              cadastroLookups,
              categories,
              legacy
            ) ?? "—";

      const tabId = resolveSalaoTabIdFromObservacao(row.observacao, flowTabs);

      return {
        kind: "salao" as const,
        cliente: row.nome?.trim() || "—",
        profissional:
          resolveSalaoCategoryDisplay(
            SALAO_PROFISSIONAL_CATEGORY_ID,
            row.observacao,
            row.cadastro_valores ?? {},
            cadastroLookups,
            categories,
            legacy
          ) ?? "—",
        local:
          resolveSalaoCategoryDisplay(
            SALAO_LOCAL_CATEGORY_ID,
            row.observacao,
            row.cadastro_valores ?? {},
            cadastroLookups,
            categories,
            legacy
          ) ?? "—",
        servicos: servicos || "—",
        horario: row.hora_marcada ? formatHoraMarcada(row.hora_marcada) : "—",
        etapa: tabId ? resolveSalaoQueueTabLabel(tabId, queueTabs) : "—",
        status: normalizeSalaoStatusLabel(row.status),
        observacoes: formatSalaoObservacaoForDisplay(row.observacao) || "—",
      };
    }

    const inline = parseAviacaoCadastroFields(row.observacao);
    const servicoIds = parseAviacaoServicosSolicitados(inline[AVIACAO_FIELD_SERVICOS]);
    const servicos =
      servicoIds.length > 0
        ? servicoIds.map((id) => cadastroLookups.servicos.get(id)?.trim() || id).join(", ")
        : "—";

    const tabId = resolveAviacaoTabIdFromObservacao(row.observacao, flowTabs);

    return {
      kind: "mro" as const,
      cliente: row.nome?.trim() || "—",
      sn:
        resolveAviacaoCategoryDisplay(
          AVIACAO_PREFIXO_CATEGORY_ID,
          row.observacao,
          row.cadastro_valores ?? {},
          cadastroLookups,
          categories,
          legacy
        ) ?? "—",
      defeito:
        resolveAviacaoCategoryDisplay(
          AVIACAO_MODELO_CATEGORY_ID,
          row.observacao,
          row.cadastro_valores ?? {},
          cadastroLookups,
          categories,
          legacy
        ) ?? "—",
      dispositivo: inline[AVIACAO_FIELD_DEVICE_TYPE]?.trim() || "—",
      bancada:
        resolveAviacaoCategoryDisplay(
          AVIACAO_HANGAR_CATEGORY_ID,
          row.observacao,
          row.cadastro_valores ?? {},
          cadastroLookups,
          categories,
          legacy
        ) ?? "—",
      tecnico:
        resolveAviacaoCategoryDisplay(
          AVIACAO_RESPONSAVEL_CATEGORY_ID,
          row.observacao,
          row.cadastro_valores ?? {},
          cadastroLookups,
          categories,
          legacy
        ) ?? "—",
      previsao: row.hora_marcada ? formatHoraMarcada(row.hora_marcada) : "—",
      servicos,
      etapa: tabId ? getAviacaoStepLabel(tabId, undefined, segmentoAplicado) : "—",
      status: normalizeQueueStatusLabel(row.status),
      observacoes: formatAviacaoObservacaoForDisplay(row.observacao) || "—",
    };
  }, [row, cadastroCategories, cadastroLookups, segmentoAplicado, queueTabs, salaoMode, flowTabs]);

  async function handleCopy() {
    if (!row) return;
    const text = buildAtendimentoShareSummary(row, {
      cadastroCategories,
      cadastroLookups,
      segmentoAplicado,
      queueTabIds: queueTabs,
    });
    const ok = await copyAtendimentoShareSummary(text);
    setCopyOk(ok);
    window.setTimeout(() => setCopyOk(false), 1800);
  }

  const title =
    fields?.kind === "salao"
      ? fields.cliente !== "—"
        ? fields.cliente
        : "Detalhes do atendimento"
      : fields?.sn && fields.sn !== "—"
        ? `OS ${fields.sn}`
        : "Ordem de Serviço";

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      widthClassName="max-w-md"
      headerAction={
        <div className="flex items-center gap-1">
          {copyOk ? (
            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Copiado!</span>
          ) : null}
          <button
            type="button"
            title="Copiar resumo"
            onClick={() => void handleCopy()}
            className="inline-flex rounded-md p-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <Copy className="size-3.5" strokeWidth={1.75} aria-hidden />
          </button>
          {row && onEdit ? (
            <button
              type="button"
              title="Editar"
              onClick={() => {
                onEdit(row);
                onClose();
              }}
              className="inline-flex rounded-md p-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <Pencil className="size-3.5" strokeWidth={1.75} aria-hidden />
            </button>
          ) : null}
        </div>
      }
    >
      {row && fields ? (
        fields.kind === "salao" ? (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DetailField label="Cliente" value={fields.cliente} />
            <DetailField label={SALAO_REGISTER_FORM_LABELS.showProfissional} value={fields.profissional} />
            <DetailField label={SALAO_REGISTER_FORM_LABELS.showLocal} value={fields.local} />
            <DetailField label={SALAO_REGISTER_FORM_LABELS.showServico} value={fields.servicos} />
            <DetailField label={SALAO_REGISTER_FORM_LABELS.showHoraMarcada} value={fields.horario} />
            <DetailField label="Etapa" value={fields.etapa} />
            <DetailField label="Status" value={fields.status} />
            <div className="sm:col-span-2">
              <DetailField label={SALAO_REGISTER_FORM_LABELS.showObservacao} value={fields.observacoes} />
            </div>
          </dl>
        ) : (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DetailField label="Cliente" value={fields.cliente} />
            <DetailField label="S/N / OS" value={fields.sn} />
            <DetailField label="Tipo de Defeito" value={fields.defeito} />
            <DetailField label="Tipo de Dispositivo" value={fields.dispositivo} />
            <DetailField label="Bancada" value={fields.bancada} />
            <DetailField label="Técnico" value={fields.tecnico} />
            <DetailField label="Previsão de retirada" value={fields.previsao} />
            <DetailField label="Serviços solicitados" value={fields.servicos} />
            <DetailField label="Etapa" value={fields.etapa} />
            <DetailField label="Status" value={fields.status} />
            <div className="sm:col-span-2">
              <DetailField label="Observações" value={fields.observacoes} />
            </div>
          </dl>
        )
      ) : null}
      {row && onSelect ? (
        <button
          type="button"
          onClick={() => {
            onSelect(row.id);
            onClose();
          }}
          className="mt-4 w-full rounded-lg border border-zinc-300 bg-white py-2 text-xs font-semibold text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
        >
          Selecionar na fila
        </button>
      ) : null}
    </Modal>
  );
}
