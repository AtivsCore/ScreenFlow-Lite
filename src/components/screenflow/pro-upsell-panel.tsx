"use client";

import { ProUpgradeButton } from "@/components/screenflow/pro-upgrade-button";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";

type ProUpsellPanelProps = {
  title?: string;
  description?: string;
  children?: ReactNode;
};

export function ProUpsellPanel({
  title = "Recurso exclusivo do Plano PRO",
  description = "Desbloqueie relatórios diários, histórico de atendimentos, integração com Google Planilhas e métricas de desempenho da sua operação.",
  children,
}: ProUpsellPanelProps) {
  return (
    <div className="flex flex-col items-center text-center">
      {children ? <div className="relative mb-4 w-full">{children}</div> : null}
      <div className="flex size-12 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800">
        <Lock className="size-6 text-zinc-500 dark:text-zinc-400" strokeWidth={1.75} aria-hidden />
      </div>
      <h3 className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
      <p className="mt-2 max-w-sm text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{description}</p>
      <div className="mt-5 w-full max-w-xs">
        <ProUpgradeButton />
      </div>
    </div>
  );
}
