-- ScreenFlow Lite — cria tabela canônica de serviços (se ainda não existir)
--
-- Sintoma no app: "Could not find the table 'public.servicos' in the schema cache"
--
-- Banco compartilhado Pro + Lite: tenant_id é UUID lógico, SEM foreign key em public.tenants.
-- Se a tabela já existir com FK, rode: docs/supabase-lite-drop-servicos-fk.sql
--
-- Depois: docs/supabase-lite-rls-servicos-fix.sql

CREATE TABLE IF NOT EXISTS public.servicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  valor numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tenants existentes: adiciona coluna de preço unitário (preset salão).
ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS valor numeric(10,2);

CREATE INDEX IF NOT EXISTS idx_servicos_tenant_nome ON public.servicos (tenant_id, nome);
CREATE INDEX IF NOT EXISTS idx_servicos_tenant_ordem ON public.servicos (tenant_id, ordem, nome);

-- App Next.js / Vercel:
--   NEXT_PUBLIC_SUPABASE_SERVICES_TABLE=servicos
--   NEXT_PUBLIC_DEFAULT_TENANT_ID=<uuid-da-clinica-no-pro>
