import { Suspense } from "react";
import { SalaoMobileAtendimentoView } from "@/components/screenflow/salao-mobile-atendimento-view";

export const metadata = {
  title: "Controle Profissional — ScreenFlow Lite",
  description: "Controle remoto da fila de atendimentos pelo celular",
};

export default function SalaoMobileAtendimentoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-950 text-xs text-zinc-500">
          Carregando…
        </div>
      }
    >
      <SalaoMobileAtendimentoView />
    </Suspense>
  );
}
