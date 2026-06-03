"use client";

import type { AtendimentoLite } from "@/lib/atendimentos-lite";
import { Lock } from "lucide-react";
import { Modal } from "@/components/ui/modal";

type FinalizeConfirmModalProps = {
  open: boolean;
  onClose: () => void;
  selected: AtendimentoLite | null;
  pending?: boolean;
  onConfirmFinalize: () => void;
  onRequestReturnUpgrade: () => void;
};

export function FinalizeConfirmModal({
  open,
  onClose,
  selected,
  pending = false,
  onConfirmFinalize,
  onRequestReturnUpgrade,
}: FinalizeConfirmModalProps) {
  const clientName = selected?.nome?.trim() || "—";

  return (
    <Modal open={open} title="Confirmar finalização de atendimento" onClose={onClose} widthClassName="max-w-md">
      <div className="space-y-4">
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Deseja encerrar o atendimento de <span className="font-semibold text-zinc-900 dark:text-zinc-50">{clientName}</span>?
        </p>
        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Ao confirmar, o registro será finalizado. No modo vitalício, os dados são removidos do banco sem retenção de
          histórico.
        </p>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onConfirmFinalize}
            className="w-full rounded-lg border border-emerald-600 bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {pending ? "Finalizando…" : "Confirmar finalização"}
          </button>

          <button
            type="button"
            onClick={onRequestReturnUpgrade}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50/80 py-2.5 text-sm font-medium text-zinc-400 transition hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-500 dark:hover:bg-zinc-800"
          >
            <Lock className="size-4 shrink-0 opacity-70" strokeWidth={1.75} aria-hidden />
            Agendar retorno (Plano PRO)
          </button>
        </div>
      </div>
    </Modal>
  );
}
