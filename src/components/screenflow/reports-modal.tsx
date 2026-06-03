"use client";

import { ProUpsellPanel } from "@/components/screenflow/pro-upsell-panel";
import { Modal } from "@/components/ui/modal";
import { ArrowDownLeft, ArrowUpRight, BarChart3, Clock, UserMinus } from "lucide-react";

const METRICS = [
  { label: "Entradas", icon: ArrowDownLeft },
  { label: "Saídas", icon: ArrowUpRight },
  { label: "Desistências", icon: UserMinus },
  { label: "Tempo médio de permanência", icon: Clock },
] as const;

type ReportsModalProps = {
  open: boolean;
  onClose: () => void;
  proActive: boolean;
};

function MetricsPreview({ blurred = false }: { blurred?: boolean }) {
  return (
    <div
      className={`grid grid-cols-2 gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/60 ${
        blurred ? "pointer-events-none select-none opacity-40 blur-[2px]" : ""
      }`}
      aria-hidden={blurred}
    >
      {METRICS.map(({ label, icon: Icon }) => (
        <div key={label} className="rounded-lg border border-zinc-200/80 bg-white px-3 py-2.5 dark:border-zinc-600 dark:bg-zinc-950">
          <div className="flex items-center gap-2">
            <Icon className="size-4 text-zinc-400" strokeWidth={1.75} aria-hidden />
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
          </div>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-zinc-800 dark:text-zinc-100">—</p>
        </div>
      ))}
    </div>
  );
}

export function ReportsModal({ open, onClose, proActive }: ReportsModalProps) {
  return (
    <Modal open={open} title="Relatórios e métricas" onClose={onClose} widthClassName="max-w-md">
      {proActive ? (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Indicadores de performance do dia — atualização em tempo real conforme a fila.
          </p>
          <MetricsPreview />
          <p className="text-center text-[10px] text-zinc-400 dark:text-zinc-500">
            Dados consolidados disponíveis com histórico ativo no Plano PRO.
          </p>
        </div>
      ) : (
        <ProUpsellPanel
          title="Relatórios disponíveis no Plano PRO"
          description="Acompanhe entradas, saídas, desistências e tempo médio de permanência com gráficos e exportação. O modo vitalício opera só em tempo real, sem retenção histórica."
        >
          <MetricsPreview blurred />
        </ProUpsellPanel>
      )}
    </Modal>
  );
}

export function ReportsSidebarIcon() {
  return <BarChart3 className="size-5" strokeWidth={1.75} aria-hidden />;
}
