"use client";

import { ProUpsellPanel } from "@/components/screenflow/pro-upsell-panel";
import { Modal } from "@/components/ui/modal";

type ProUpgradeModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
};

export function ProUpgradeModal({
  open,
  onClose,
  title = "Recurso exclusivo do Plano PRO",
  description = "Desbloqueie relatórios diários, histórico de atendimentos, integração com Google Planilhas e métricas de desempenho da sua operação.",
}: ProUpgradeModalProps) {
  return (
    <Modal open={open} title="Plano PRO" onClose={onClose} widthClassName="max-w-sm">
      <ProUpsellPanel title={title} description={description} />
    </Modal>
  );
}
