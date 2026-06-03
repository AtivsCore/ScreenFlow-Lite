"use client";

import { ReportsSidebarIcon } from "@/components/screenflow/reports-modal";
import { Keyboard, LayoutGrid, LogOut, Settings } from "lucide-react";

type AppSidebarProps = {
  onOpenSegment: () => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
  onOpenReports: () => void;
  onSignOut?: () => void;
};

export function AppSidebar({
  onOpenSegment,
  onOpenSettings,
  onOpenShortcuts,
  onOpenReports,
  onSignOut,
}: AppSidebarProps) {
  return (
    <aside
      className="flex w-14 shrink-0 flex-col items-center border-r border-zinc-200 bg-zinc-200/80 py-2 dark:border-zinc-800 dark:bg-zinc-900"
      aria-label="Navegação principal"
    >
      <div className="flex flex-1 flex-col items-center gap-1">
        <button
          type="button"
          onClick={onOpenReports}
          className="flex w-full flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-zinc-700 transition hover:bg-zinc-300/80 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <ReportsSidebarIcon />
          <span className="text-[8px] font-semibold uppercase leading-none tracking-wide">Relatórios</span>
        </button>
      </div>

      <button
        type="button"
        onClick={onOpenShortcuts}
        className="mb-1 flex w-full flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-zinc-700 transition hover:bg-zinc-300/80 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <Keyboard className="size-5" strokeWidth={1.75} aria-hidden />
        <span className="text-[8px] font-semibold uppercase leading-none tracking-wide">Atalhos</span>
      </button>

      {onSignOut && (
        <button
          type="button"
          title="Sair"
          onClick={onSignOut}
          className="mb-1 flex size-10 items-center justify-center rounded-lg text-zinc-700 transition hover:bg-zinc-300/80 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
        >
          <LogOut className="size-5" strokeWidth={1.75} aria-hidden />
          <span className="sr-only">Sair</span>
        </button>
      )}

      <button
        type="button"
        title="Configuração de segmento"
        onClick={onOpenSegment}
        className="mb-1 flex size-10 items-center justify-center rounded-lg bg-zinc-900 text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        <LayoutGrid className="size-5" strokeWidth={1.75} aria-hidden />
        <span className="sr-only">Configuração de segmento</span>
      </button>

      <button
        type="button"
        title="Configurações"
        onClick={onOpenSettings}
        className="flex size-10 items-center justify-center rounded-lg text-zinc-700 transition hover:bg-zinc-300/80 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
      >
        <Settings className="size-5" strokeWidth={1.75} aria-hidden />
        <span className="sr-only">Configurações</span>
      </button>
    </aside>
  );
}
