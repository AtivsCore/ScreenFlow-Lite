-- ScreenFlow Lite — correção RLS + colunas (projeto Supabase LITE apenas)
--
-- ⚠️  EXECUTE SOMENTE no painel do projeto Supabase do ScreenFlow Lite.
--     NÃO rode no banco do ScreenFlow Pro/SaaS completo.
--
-- Filosofia: tenant_id UUID lógico na linha, SEM FK para tabelas globais do Pro.
-- Policies: authenticated + tenant_id IS NOT NULL.
--
-- Pré-requisitos no app (.env.local / Vercel Lite):
--   NEXT_PUBLIC_SUPABASE_URL          → URL do projeto Lite
--   NEXT_PUBLIC_SUPABASE_ANON_KEY     → anon key do Lite
--   NEXT_PUBLIC_DEFAULT_TENANT_ID     → UUID da clínica neste banco Lite
--   NEXT_PUBLIC_SUPABASE_SERVICES_TABLE=servicos

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Colunas novas
-- ---------------------------------------------------------------------------

ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS especialidade text;

COMMENT ON COLUMN public.profissionais.especialidade IS
  'Especialidade exibida no Lite: "Nome - Especialidade".';

ALTER TABLE public.locais
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

DO $ordem_servicos$
DECLARE
  tbl name;
  tables name[] := ARRAY['servicos'];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN
      RAISE NOTICE 'Ignorando public.% (tabela não existe — rode docs/supabase-lite-create-servicos.sql).', tbl;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 0', tbl);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%I_tenant_ordem ON public.%I (tenant_id, ordem, nome)',
      tbl, tbl
    );

    RAISE NOTICE 'Coluna ordem aplicada em public.%.', tbl;
  END LOOP;
END
$ordem_servicos$;

ALTER TABLE public.atendimentos_lite
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

ALTER TABLE public.atendimentos_lite
  ADD COLUMN IF NOT EXISTS classificacao_prioridade text NOT NULL DEFAULT 'normal';

ALTER TABLE public.atendimentos_lite
  DROP CONSTRAINT IF EXISTS atendimentos_lite_classificacao_prioridade_check;

ALTER TABLE public.atendimentos_lite
  ADD CONSTRAINT atendimentos_lite_classificacao_prioridade_check
  CHECK (classificacao_prioridade IN ('normal', 'prioritario', 'emergencia'));

COMMENT ON COLUMN public.atendimentos_lite.classificacao_prioridade IS
  'Lei de prioridade Lite: normal | prioritario | emergencia';

UPDATE public.atendimentos_lite
SET classificacao_prioridade = 'prioritario'
WHERE prioridade IS TRUE
  AND classificacao_prioridade = 'normal';

-- Mantém coluna boolean legada alinhada (compatibilidade com código antigo)
CREATE OR REPLACE FUNCTION public.lite_sync_prioridade_from_classificacao()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.prioridade := NEW.classificacao_prioridade IN ('prioritario', 'emergencia');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lite_sync_prioridade_classificacao ON public.atendimentos_lite;

CREATE TRIGGER trg_lite_sync_prioridade_classificacao
  BEFORE INSERT OR UPDATE OF classificacao_prioridade
  ON public.atendimentos_lite
  FOR EACH ROW
  EXECUTE FUNCTION public.lite_sync_prioridade_from_classificacao();

-- ---------------------------------------------------------------------------
-- 2) Remove FKs tenant_id → tenants (herança Pro — não usar no Lite)
-- ---------------------------------------------------------------------------

ALTER TABLE public.profissionais DROP CONSTRAINT IF EXISTS profissionais_tenant_id_fkey;
ALTER TABLE public.locais       DROP CONSTRAINT IF EXISTS locais_tenant_id_fkey;
ALTER TABLE public.servicos     DROP CONSTRAINT IF EXISTS servicos_tenant_id_fkey;
ALTER TABLE public.pacientes    DROP CONSTRAINT IF EXISTS pacientes_tenant_id_fkey;

-- ---------------------------------------------------------------------------
-- 3) RLS enxuto — remove policies antigas e recria padrão Lite
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.lite_reset_rls(p_table regclass, p_prefix text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  pol record;
  tbl text := p_table::text;
  tbl_ident name := split_part(tbl, '.', 2);
BEGIN
  IF p_table IS NULL THEN
    RAISE NOTICE 'Tabela % não existe.', tbl;
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE %s ADD COLUMN IF NOT EXISTS tenant_id uuid', p_table);
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', p_table);

  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = tbl_ident
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %s', pol.policyname, p_table);
  END LOOP;

  EXECUTE format(
    'CREATE POLICY %I ON %s FOR SELECT TO authenticated USING (tenant_id IS NOT NULL)',
    p_prefix || '_select', p_table
  );
  EXECUTE format(
    'CREATE POLICY %I ON %s FOR INSERT TO authenticated WITH CHECK (tenant_id IS NOT NULL)',
    p_prefix || '_insert', p_table
  );
  EXECUTE format(
    'CREATE POLICY %I ON %s FOR UPDATE TO authenticated
     USING (tenant_id IS NOT NULL) WITH CHECK (tenant_id IS NOT NULL)',
    p_prefix || '_update', p_table
  );
  EXECUTE format(
    'CREATE POLICY %I ON %s FOR DELETE TO authenticated USING (tenant_id IS NOT NULL)',
    p_prefix || '_delete', p_table
  );

  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %s TO authenticated', p_table);

  RAISE NOTICE 'RLS Lite aplicado em %.', p_table;
END;
$$;

SELECT public.lite_reset_rls('public.profissionais'::regclass,     'lite_profissionais');
SELECT public.lite_reset_rls('public.locais'::regclass,             'lite_locais');
SELECT public.lite_reset_rls('public.servicos'::regclass,           'lite_servicos');
SELECT public.lite_reset_rls('public.atendimentos_lite'::regclass,  'lite_atendimentos_lite');
SELECT public.lite_reset_rls('public.pacientes'::regclass,          'lite_pacientes');

COMMIT;

-- Verificação rápida
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profissionais', 'locais', 'servicos', 'atendimentos_lite', 'pacientes')
ORDER BY tablename, cmd;
