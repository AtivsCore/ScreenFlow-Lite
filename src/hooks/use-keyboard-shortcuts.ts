"use client";

import { useEffect } from "react";

export type KeyboardShortcutHandlers = {
  onChamar?: () => void;
  onRechamar?: () => void;
  onFinalizar?: () => void;
  onLimpar?: () => void;
  onNovoRegistro?: () => void;
  onToggleView?: () => void;
  onOpenSettings?: () => void;
  onCrudProfissionais?: () => void;
  onCrudLocais?: () => void;
  onCrudServicos?: () => void;
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const map: Record<string, keyof KeyboardShortcutHandlers> = {
      c: "onChamar",
      r: "onRechamar",
      f: "onFinalizar",
      x: "onLimpar",
      n: "onNovoRegistro",
      v: "onToggleView",
      k: "onOpenSettings",
      "1": "onCrudProfissionais",
      "2": "onCrudLocais",
      "3": "onCrudServicos",
    };

    function onKeyDown(e: KeyboardEvent) {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      if (isTypingTarget(e.target)) return;

      const key = e.key.length === 1 ? e.key.toLowerCase() : "";
      const handlerKey = map[key];
      if (!handlerKey) return;

      const fn = handlers[handlerKey];
      if (!fn) return;

      e.preventDefault();
      e.stopPropagation();
      fn();
    }

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [enabled, handlers]);
}
