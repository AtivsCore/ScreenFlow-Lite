-- ScreenFlow Lite — remove FK de tenant_id em public.servicos
--
-- Erro: insert or update on table "servicos" violates foreign key constraint
--       "servicos_tenant_id_fkey"
--       Key (tenant_id)=(...) is not present in table "tenants".
--
-- Banco compartilhado com o Pro: a clínica pode estar em outra tabela (clinicas, etc.).
-- O Lite grava tenant_id como UUID lógico, sem validar FK em public.tenants.
--
-- Execute no Supabase → SQL Editor.

ALTER TABLE public.servicos
  DROP CONSTRAINT IF EXISTS servicos_tenant_id_fkey;

-- Garante coluna sem REFERENCES (caso recrie a tabela no futuro, use create-servicos.sql atualizado)
ALTER TABLE public.servicos
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

COMMENT ON COLUMN public.servicos.tenant_id IS
  'UUID lógico do inquilino/clínica (Lite). Sem FK — banco compartilhado com Pro.';
