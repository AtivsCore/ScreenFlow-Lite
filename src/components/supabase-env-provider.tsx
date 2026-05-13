"use client";

import { createContext, useContext, type ReactNode } from "react";

/** Configuração pública injetada pelo servidor (runtime na Vercel). */
export type SupabasePublicConfig = {
  url: string;
  anonKey: string;
};

const SupabasePublicEnvContext = createContext<SupabasePublicConfig | null>(null);

export function SupabaseEnvProvider({
  value,
  children,
}: {
  value: SupabasePublicConfig;
  children: ReactNode;
}) {
  return (
    <SupabasePublicEnvContext.Provider value={value}>{children}</SupabasePublicEnvContext.Provider>
  );
}

export function useSupabasePublicEnv(): SupabasePublicConfig | null {
  return useContext(SupabasePublicEnvContext);
}
