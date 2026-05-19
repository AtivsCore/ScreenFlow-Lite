-- ScreenFlow Lite — cria tabela canônica de serviços (se ainda não existir)
--
-- Sintoma no app: "Could not find the table 'public.servicos' in the schema cache"
-- (nem especialidades / servico / especialidade existem ainda).
--
-- Execute ANTES ou DEPOIS de docs/supabase-lite-rls-cadastros.sql

CREATE TABLE IF NOT EXISTS public.servicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_servicos_tenant_nome ON public.servicos (tenant_id, nome);

-- App Next.js / Vercel:
--   NEXT_PUBLIC_SUPABASE_SERVICES_TABLE=servicos
