"use client";

import { stripFilaPreset } from "@/lib/fila-preset";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ObservacaoPopoverProps = {
  observacao: string | null | undefined;
  className?: string;
  iconClassName?: string;
  inlineVisible?: boolean;
  inlineClassName?: string;
};

export function ObservacaoPopover({
  observacao,
  className = "",
  iconClassName = "size-3.5",
  inlineVisible = false,
  inlineClassName = "max-w-[10rem] truncate text-[10px] text-zinc-500 dark:text-zinc-400",
}: ObservacaoPopoverProps) {
  const text = stripFilaPreset(observacao).trim();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!text) return null;

  if (inlineVisible) {
    return (
      <span className={inlineClassName} title={text}>
        {text}
      </span>
    );
  }

  return (
    <div ref={rootRef} className={`relative inline-flex ${className}`} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        title={open ? "Ocultar observação" : "Ver observação"}
        aria-label={open ? "Ocultar observação" : "Ver observação"}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex rounded p-0.5 text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
      >
        {open ? (
          <EyeOff className={iconClassName} strokeWidth={1.75} />
        ) : (
          <Eye className={iconClassName} strokeWidth={1.75} />
        )}
      </button>
      {open ? (
        <div
          role="tooltip"
          className="absolute left-0 top-full z-20 mt-1 max-w-[16rem] rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-[10px] leading-snug text-zinc-800 shadow-lg dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
        >
          {text}
        </div>
      ) : null}
    </div>
  );
}
