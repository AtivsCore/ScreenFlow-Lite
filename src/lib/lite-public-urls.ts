/** URL pública do ScreenFlow Lite (painel + TV). */
export function getLitePublicBaseUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_SCREENFLOW_LITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim();

  if (fromEnv) {
    const u = fromEnv.replace(/\/+$/, "");
    return u.startsWith("http") ? u : `https://${u}`;
  }

  return "http://localhost:3000";
}

export function getLiteLoginUrl(): string {
  return `${getLitePublicBaseUrl()}/login`;
}

export function getLiteDisplayUrl(tenantId: string): string {
  const base = getLitePublicBaseUrl();
  return `${base}/display?tenant_id=${encodeURIComponent(tenantId)}`;
}
