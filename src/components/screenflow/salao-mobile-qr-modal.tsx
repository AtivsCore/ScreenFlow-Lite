"use client";

import { Modal } from "@/components/ui/modal";
import { useEffect, useMemo, useState } from "react";

type SalaoMobileQrModalProps = {
  open: boolean;
  onClose: () => void;
  tenantId: string;
};

export function SalaoMobileQrModal({ open, onClose, tenantId }: SalaoMobileQrModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const mobileUrl = useMemo(() => {
    if (typeof window === "undefined" || !tenantId) return "";
    const params = new URLSearchParams();
    params.set("tenantId", tenantId);
    return `${window.location.origin}/atendimento/mobile?${params.toString()}`;
  }, [tenantId]);

  useEffect(() => {
    if (!open || !mobileUrl) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    void import("qrcode").then((QR) => {
      QR.default.toDataURL(mobileUrl, { margin: 1, width: 220 }, (_err, url) => {
        if (!cancelled && url) setQrDataUrl(url);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [open, mobileUrl]);

  return (
    <Modal open={open} title="Controle pelo Celular" onClose={onClose} widthClassName="max-w-xs">
      <div className="flex flex-col items-center px-1 pb-1 text-center">
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrDataUrl}
            alt="QR Code para controle mobile"
            className="size-[220px] rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700"
          />
        ) : (
          <div className="flex size-[220px] items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-xs text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800/50">
            Gerando QR Code…
          </div>
        )}
        <p className="mt-4 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          Escaneie para controlar sua fila pelo celular
        </p>
        {mobileUrl ? (
          <p className="mt-2 max-w-full break-all font-mono text-[10px] text-zinc-400">{mobileUrl}</p>
        ) : null}
      </div>
    </Modal>
  );
}
