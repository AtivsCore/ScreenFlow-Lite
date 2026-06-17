"use client";

import { Tooltip } from "@/components/ui/tooltip";
import { Wallet } from "lucide-react";

type SalaoProWalletButtonProps = {
  tooltip: string;
  onClick: () => void;
  className?: string;
  iconClassName?: string;
};

export function SalaoProWalletButton({
  tooltip,
  onClick,
  className = "",
  iconClassName = "size-3",
}: SalaoProWalletButtonProps) {
  return (
    <Tooltip content={tooltip} side="top" align="center">
      <button
        type="button"
        title={tooltip}
        aria-label={tooltip}
        className={`inline-flex shrink-0 items-center justify-center rounded p-0.5 text-zinc-400 transition hover:bg-zinc-200/80 hover:text-amber-700 dark:hover:bg-zinc-700 dark:hover:text-amber-400 ${className}`}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onClick();
        }}
      >
        <Wallet className={iconClassName} strokeWidth={2} aria-hidden />
      </button>
    </Tooltip>
  );
}
