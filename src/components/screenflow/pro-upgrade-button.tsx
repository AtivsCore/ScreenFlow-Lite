"use client";

import { WHATSAPP_PRO_UPGRADE_URL } from "@/lib/plan-tier";
import { MessageCircle } from "lucide-react";

type ProUpgradeButtonProps = {
  className?: string;
  label?: string;
};

export function ProUpgradeButton({
  className = "",
  label = "Ativar Plano PRO no WhatsApp",
}: ProUpgradeButtonProps) {
  return (
    <a
      href={WHATSAPP_PRO_UPGRADE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 ${className}`}
    >
      <MessageCircle className="size-4 shrink-0" strokeWidth={2} aria-hidden />
      {label}
    </a>
  );
}
