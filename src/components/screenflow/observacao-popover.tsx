"use client";

import { formatObservacaoForDisplay } from "@/lib/fila-preset";
import { Eye, EyeOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  const text = formatObservacaoForDisplay(observacao);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setCoords(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      close();
    };
    const onScroll = () => close();
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, close]);

  if (!text) return null;

  if (inlineVisible) {
    return (
      <span className={inlineClassName} title={text}>
        {text}
      </span>
    );
  }

  function toggleOpen(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (open) {
      close();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({ top: rect.bottom + 6, left: rect.left });
    setOpen(true);
  }

  const popover =
    open && coords && typeof document !== "undefined"
      ? createPortal(
          <div
            role="tooltip"
            style={{ position: "fixed", top: coords.top, left: coords.left, zIndex: 9999 }}
            className="pointer-events-auto max-w-[min(16rem,calc(100vw-1rem))] rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-[10px] leading-snug text-zinc-800 shadow-xl dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {text}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title={open ? "Ocultar observação" : "Ver observação"}
        aria-label={open ? "Ocultar observação" : "Ver observação"}
        onClick={toggleOpen}
        className={`inline-flex rounded p-0.5 text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 ${className}`}
      >
        {open ? (
          <EyeOff className={iconClassName} strokeWidth={1.75} />
        ) : (
          <Eye className={iconClassName} strokeWidth={1.75} />
        )}
      </button>
      {popover}
    </>
  );
}
