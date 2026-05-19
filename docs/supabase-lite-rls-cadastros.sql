-- ScreenFlow Lite — RLS para cadastros rápidos (profissionais, locais, serviços)
--
-- Execute no Supabase → SQL Editor se o app retornar:
--   "new row violates row-level security policy"
--
-- IMPORTANTE: se criou public.servicos depois, rode também:
--   docs/supabase-lite-rls-servicos-fix.sql
--
-- Vercel: NEXT_PUBLIC_DEFAULT_TENANT_ID = UUID de public.tenants
-- App:    NEXT_PUBLIC_SUPABASE_SERVICES_TABLE=servicos

DO $lite_rls$
DECLARE
  tbl name;
  pol_prefix text;
  tables name[] := ARRAY['profissionais', 'locais', 'servicos', 'especialidades', 'servico', 'especialidade'];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN
      RAISE NOTICE 'Ignorando public.% (tabela não existe).', tbl;
      CONTINUE;
    END IF;

    pol_prefix := 'lite_' || tbl;

    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid', tbl);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_prefix || '_select', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_prefix || '_insert', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_prefix || '_delete', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_prefix || '_update', tbl);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (tenant_id IS NOT NULL)',
      pol_prefix || '_select',
      tbl
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (tenant_id IS NOT NULL)',
      pol_prefix || '_insert',
      tbl
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
       USING (tenant_id IS NOT NULL)
       WITH CHECK (tenant_id IS NOT NULL)',
      pol_prefix || '_update',
      tbl
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (tenant_id IS NOT NULL)',
      pol_prefix || '_delete',
      tbl
    );

    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl);

    RAISE NOTICE 'RLS aplicado em public.%.', tbl;
  END LOOP;
END
$lite_rls$;
