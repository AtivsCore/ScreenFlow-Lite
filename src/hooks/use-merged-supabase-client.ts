"use client";

import { useSupabasePublicEnv } from "@/components/supabase-env-provider";
import { finalizeSupabasePublicPair } from "@/lib/supabase";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

export function useMergedSupabaseClient(): {
  supabase: SupabaseClient | null;
  mergedEnv: { url: string; anonKey: string };
  envMissing: boolean;
  envChecking: boolean;
  apiProbeDone: boolean;
} {
  const serverPublicEnv = useSupabasePublicEnv();
  const hasServerCred = !!(serverPublicEnv?.url && serverPublicEnv?.anonKey);

  const [apiEnv, setApiEnv] = useState<{ url: string; anonKey: string } | null>(null);
  const [apiProbeDone, setApiProbeDone] = useState(hasServerCred);

  useEffect(() => {
    if (hasServerCred) return;

    let cancelled = false;

    async function probe() {
      try {
        const res = await fetch("/api/supabase-public", { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as { ok?: boolean; url?: string; anonKey?: string };
        if (cancelled || !j?.ok || typeof j.url !== "string" || typeof j.anonKey !== "string") return;
        setApiEnv(finalizeSupabasePublicPair({ url: j.url, anonKey: j.anonKey }));
      } catch {
        /* */
      } finally {
        if (!cancelled) setApiProbeDone(true);
      }
    }

    void probe();

    return () => {
      cancelled = true;
    };
  }, [hasServerCred]);

  const mergedEnv = useMemo(() => {
    if (serverPublicEnv?.url && serverPublicEnv.anonKey) {
      return finalizeSupabasePublicPair(serverPublicEnv);
    }
    if (apiEnv?.url && apiEnv.anonKey) {
      return finalizeSupabasePublicPair(apiEnv);
    }
    return { url: "", anonKey: "" };
  }, [serverPublicEnv, apiEnv]);

  const supabase = useMemo(() => {
    const m = mergedEnv;
    if (!m.url || !m.anonKey) return null;
    return createBrowserSupabaseClient(m.url, m.anonKey);
  }, [mergedEnv]);

  const envChecking = !apiProbeDone && !supabase;
  const envMissing = apiProbeDone && !supabase;

  return { supabase, mergedEnv, envMissing, envChecking, apiProbeDone };
}
