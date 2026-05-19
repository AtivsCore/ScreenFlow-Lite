-- ScreenFlow Lite — RLS para public.atendimentos_lite (fila)
--
-- Erro: "new row violates row-level security policy for table atendimentos_lite"
--
-- Banco compartilhado Pro + Lite: tenant_id é UUID lógico, sem checagem em public.tenants.
-- Mesmo modelo relaxado de docs/supabase-lite-rls-servicos-fix.sql
--
-- Execute no Supabase → SQL Editor (pode rodar quantas vezes precisar).

DO $fix_atendimentos$
DECLARE
  pol_prefix text := 'lite_atendimentos_lite';
BEGIN
  IF to_regclass('public.atendimentos_lite') IS NULL THEN
    RAISE EXCEPTION 'Tabela public.atendimentos_lite não existe.';
  END IF;

  EXECUTE 'ALTER TABLE public.atendimentos_lite ADD COLUMN IF NOT EXISTS tenant_id uuid';
  EXECUTE 'ALTER TABLE public.atendimentos_lite ENABLE ROW LEVEL SECURITY';

  EXECUTE format('DROP POLICY IF EXISTS %I ON public.atendimentos_lite', pol_prefix || '_select');
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.atendimentos_lite', pol_prefix || '_insert');
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.atendimentos_lite', pol_prefix || '_update');
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.atendimentos_lite', pol_prefix || '_delete');

  -- SELECT: fila em tempo real
  EXECUTE format(
    'CREATE POLICY %I ON public.atendimentos_lite FOR SELECT TO authenticated USING (tenant_id IS NOT NULL)',
    pol_prefix || '_select'
  );

  -- INSERT: novo registro na fila
  EXECUTE format(
    'CREATE POLICY %I ON public.atendimentos_lite FOR INSERT TO authenticated WITH CHECK (tenant_id IS NOT NULL)',
    pol_prefix || '_insert'
  );

  -- UPDATE: chamar, rechamar, finalizar, editar
  EXECUTE format(
    'CREATE POLICY %I ON public.atendimentos_lite FOR UPDATE TO authenticated
     USING (tenant_id IS NOT NULL)
     WITH CHECK (tenant_id IS NOT NULL)',
    pol_prefix || '_update'
  );

  -- DELETE: excluir da fila
  EXECUTE format(
    'CREATE POLICY %I ON public.atendimentos_lite FOR DELETE TO authenticated USING (tenant_id IS NOT NULL)',
    pol_prefix || '_delete'
  );

  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.atendimentos_lite TO authenticated';

  RAISE NOTICE 'RLS Lite aplicado em public.atendimentos_lite (policies %).', pol_prefix;
END
$fix_atendimentos$;

-- Opcional: remover FK tenant_id → tenants (se existir e bloquear INSERT)
ALTER TABLE public.atendimentos_lite
  DROP CONSTRAINT IF EXISTS atendimentos_lite_tenant_id_fkey;
