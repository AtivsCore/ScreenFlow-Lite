"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ScreenFlow] Erro na árvore da página:", error);
  }, [error]);

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 bg-zinc-100 p-8 text-center text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div>
        <h1 className="text-lg font-semibold">Algo deu errado ao carregar a tela</h1>
        <p className="mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
          {error.message ||
            "Erro desconhecido. Abra o console do navegador (F12) ou os Logs da função na Vercel para detalhes."}
        </p>
      </div>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Tentar novamente
      </button>
    </div>
  );
}
