export type PlanTier = "lifetime" | "pro";

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

export const LIFETIME_STORAGE_NOTICE =
  "Modo Vitalício Ativo: O sistema opera em tempo real e não armazena histórico no banco após a finalização. Para acompanhar relatórios, estatísticas diárias e integrar com o Google Planilhas, assine o Plano PRO.";
