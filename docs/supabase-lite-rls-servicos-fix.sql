-- ScreenFlow Lite — correção RLS para public.servicos
--
-- Sintoma: "Cadastro bloqueado por RLS" no modal Serviços (Lite).
-- Causa comum: tabela criada DEPOIS do script geral de RLS → RLS ativo sem policy de INSERT.
--
-- Execute no Supabase → SQL Editor (pode rodar quantas vezes precisar).

DO $fix_servicos$
DECLARE
  tbl name := 'servicos';
  pol_prefix text := 'lite_servicos';
BEGIN
  IF to_regclass('public.servicos') IS NULL THEN
    RAISE EXCEPTION 'Tabela public.servicos não existe. Rode docs/supabase-lite-create-servicos.sql primeiro.';
  END IF;

  EXECUTE 'ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS tenant_id uuid';
  EXECUTE 'ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY';

  EXECUTE format('DROP POLICY IF EXISTS %I ON public.servicos', pol_prefix || '_select');
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.servicos', pol_prefix || '_insert');
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.servicos', pol_prefix || '_delete');
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.servicos', pol_prefix || '_update');

  -- SELECT: usuários autenticados veem linhas com tenant_id
  EXECUTE format(
    'CREATE POLICY %I ON public.servicos FOR SELECT TO authenticated USING (tenant_id IS NOT NULL)',
    pol_prefix || '_select'
  );

  -- INSERT: tenant_id válido em public.tenants (mesma regra de profissionais/locais)
  EXECUTE format(
    'CREATE POLICY %I ON public.servicos FOR INSERT TO authenticated WITH CHECK (
       tenant_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id)
     )',
    pol_prefix || '_insert'
  );

  -- UPDATE (Postgres exige SELECT policy para updates via PostgREST em alguns fluxos)
  EXECUTE format(
    'CREATE POLICY %I ON public.servicos FOR UPDATE TO authenticated
     USING (tenant_id IS NOT NULL)
     WITH CHECK (tenant_id IS NOT NULL)',
    pol_prefix || '_update'
  );

  EXECUTE format(
    'CREATE POLICY %I ON public.servicos FOR DELETE TO authenticated USING (tenant_id IS NOT NULL)',
    pol_prefix || '_delete'
  );

  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.servicos TO authenticated';

  RAISE NOTICE 'RLS Lite aplicado em public.servicos (policies %).', pol_prefix;
END
$fix_servicos$;
