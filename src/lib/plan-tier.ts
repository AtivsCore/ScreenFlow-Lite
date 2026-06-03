export type PlanTier = "lifetime" | "pro";

/** Link comercial WhatsApp para ativação do Plano PRO. */
export const WHATSAPP_PRO_UPGRADE_URL =
  "https://api.whatsapp.com/send/?phone=5541995282939&text=Quero+ativar+o+Plano+PRO+no+ScreenFlow";

/** Plano comercial: histórico, métricas e integrações. Padrão = vitalício (sem retenção). */
export function resolvePlanTier(tenantPlan?: PlanTier | null): PlanTier {
  const env = process.env.NEXT_PUBLIC_SCREENFLOW_PLAN?.trim().toLowerCase();
  if (env === "pro") return "pro";
  if (tenantPlan === "pro") return "pro";
  return "lifetime";
}

export function isProPlan(tier: PlanTier): boolean {
  return tier === "pro";
}
