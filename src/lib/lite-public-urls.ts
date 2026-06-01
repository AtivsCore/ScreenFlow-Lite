/** URL pública padrão do ScreenFlow Lite (produção). */
export const SCREENFLOW_LITE_DEFAULT_BASE_URL = "https://screen-flow-lite.vercel.app";

/** URL pública do ScreenFlow Lite (painel + TV + login). */
export function getLitePublicBaseUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_SCREENFLOW_LITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim();

  if (fromEnv) {
    const u = fromEnv.replace(/\/+$/, "");
    return u.startsWith("http") ? u : `https://${u}`;
  }

  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }

  return SCREENFLOW_LITE_DEFAULT_BASE_URL;
}

export function getLiteLoginUrl(): string {
  return `${getLitePublicBaseUrl()}/login`;
}

export function getLiteDisplayUrl(tenantId: string): string {
  const base = getLitePublicBaseUrl();
  return `${base}/display?tenant_id=${encodeURIComponent(tenantId)}`;
}

/** Caminho público do instalador empacotado no kit (public/downloads). */
export function getLiteInstallerPublicPath(): string {
  return "/downloads/ScreenFlow_Setup.exe";
}
