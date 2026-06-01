import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { finalizeSupabasePublicPair, resolveSupabaseEnvPairs } from "@/lib/supabase";

export async function createServerSupabaseClient(): Promise<SupabaseClient> {
  const { url, anonKey } = finalizeSupabasePublicPair(resolveSupabaseEnvPairs());
  if (!url || !anonKey) {
    throw new Error("Supabase URL/anon key ausentes.");
  }
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          /* RSC read-only */
        }
      },
    },
  });
}
