"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseClientSafe } from "@/lib/supabase";

/** Cliente browser com cookies (@supabase/ssr) — visível também no servidor (RSC/layout admin). */
export function createBrowserSupabaseClient(url: string, anonKey: string): SupabaseClient | null {
  if (!url || !anonKey) return null;
  try {
    return createBrowserClient(url, anonKey);
  } catch {
    return createSupabaseClientSafe(url, anonKey);
  }
}
