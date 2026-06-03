"use client";

import { KEYBOARD_SHORTCUTS } from "@/lib/keyboard-shortcuts";
import { Modal } from "@/components/ui/modal";

type KeyboardShortcutsModalProps = {
  open: boolean;
  onClose: () => void;
};

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  const groups = [...new Set(KEYBOARD_SHORTCUTS.map((s) => s.group))];

  return (
    <Modal open={open} title="Atalhos de teclado" onClose={onClose} widthClassName="max-w-md">
      <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
        Use <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1 font-mono text-[10px] dark:border-zinc-600 dark:bg-zinc-800">Alt</kbd>{" "}
        (ou <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1 font-mono text-[10px] dark:border-zinc-600 dark:bg-zinc-800">Option</kbd> no Mac).
        Atalhos não funcionam enquanto você digita em um campo de texto.
      </p>
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group}>
            <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {group}
            </h3>
            <table className="w-full border-collapse text-left text-[11px]">
              <tbody>
                {KEYBOARD_SHORTCUTS.filter((s) => s.group === group).map((s) => (
                  <tr key={s.keys} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                    <td className="w-[7rem] py-1.5 pr-2 font-mono text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">
                      {s.keys}
                    </td>
                    <td className="py-1.5 text-zinc-600 dark:text-zinc-400">{s.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </Modal>
  );
}
