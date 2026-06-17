"use client";

import { ProUpgradeButton } from "@/components/screenflow/pro-upgrade-button";
import { Modal } from "@/components/ui/modal";
import { Crown } from "lucide-react";

export type SalaoProUpsellContext = "daily" | "monthly";

const SALAO_PRO_UPSELL_COPY: Record<
  SalaoProUpsellContext,
  { title: string; description: string; cta: string }
> = {
  daily: {
    title: "Desbloqueie o Saldo Diário 🚀",
    description:
      "Para visualizar o faturamento diário detalhado e a quantidade exata de atendimentos por profissional, mude para o Plano PRO e tenha o controle total do seu caixa.",
    cta: "Atualizar para o Plano PRO",
  },
  monthly: {
    title: "Previsão Mensal de Faturamento 📊",
    description:
      "Planeje o crescimento do seu negócio. Para visualizar a estimativa de recebimentos mensais deste profissional, ative o Plano PRO agora mesmo.",
    cta: "Quero ser PRO",
  },
};

type SalaoProUpsellModalProps = {
  open: boolean;
  onClose: () => void;
  context: SalaoProUpsellContext;
};

export function SalaoProUpsellModal({ open, onClose, context }: SalaoProUpsellModalProps) {
  const copy = SALAO_PRO_UPSELL_COPY[context];

  return (
    <Modal open={open} title="Plano PRO" onClose={onClose} widthClassName="max-w-sm">
      <div className="flex flex-col items-center px-1 pb-1 text-center">
        <div className="flex size-14 items-center justify-center rounded-full border border-amber-200/80 bg-gradient-to-b from-amber-50 to-orange-50 shadow-sm dark:border-amber-900/50 dark:from-amber-950/40 dark:to-orange-950/30">
          <Crown
            className="size-7 text-amber-600 dark:text-amber-400"
            strokeWidth={1.75}
            aria-hidden
          />
        </div>
        <h3 className="mt-4 text-base font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
          {copy.title}
        </h3>
        <p className="mt-2 max-w-[18rem] text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          {copy.description}
        </p>
        <div className="mt-6 w-full max-w-xs">
          <ProUpgradeButton label={copy.cta} />
        </div>
      </div>
    </Modal>
  );
}
