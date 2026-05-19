/**
 * Nome da tabela PostgREST para “serviços” no seu projeto.
 * Ex.: se no Supabase a tabela se chama `servicos`, defina no `.env.local`:
 * `NEXT_PUBLIC_SUPABASE_SERVICES_TABLE=servicos`
 */
export const SERVICES_TABLE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SUPABASE_SERVICES_TABLE?.trim()) ||
  "especialidades";
