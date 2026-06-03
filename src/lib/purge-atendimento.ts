import type { AtendimentoLite } from "@/lib/atendimentos-lite";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Remove o registro da fila permanentemente (modo vitalício / LGPD). */
export async function purgeAtendimentoRecord(
  supabase: SupabaseClient,
  row: Pick<AtendimentoLite, "id">
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from("atendimentos_lite").delete().eq("id", row.id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
