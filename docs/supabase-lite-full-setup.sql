-- =============================================================================
-- ScreenFlow Lite — setup completo do banco ISOLADO (projeto novo / vazio)
--
-- ⚠️  EXECUTE SOMENTE no projeto Supabase Lite dedicado, por exemplo:
--     dwfbocsqtqxnuvmpynon  (URL: https://dwfbocsqtqxnuvmpynon.supabase.co)
--
--     NÃO execute no screenflow-prod (banco compartilhado com o SaaS Pro).
--
-- Pré-requisitos no app (.env.local / Vercel Lite):
--   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
--   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
--   NEXT_PUBLIC_DEFAULT_TENANT_ID=<uuid do tenant seed abaixo>
--   NEXT_PUBLIC_SUPABASE_SERVICES_TABLE=servicos
--
-- Idempotente: pode rodar mais de uma vez (IF NOT EXISTS / DROP POLICY IF EXISTS lite_*).
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) Extensões
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1) Tabelas base (cadastros)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profissionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  nome text NOT NULL,
  especialidade text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profissionais_tenant_nome
  ON public.profissionais (tenant_id, nome);

CREATE TABLE IF NOT EXISTS public.locais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_locais_tenant_nome
  ON public.locais (tenant_id, nome);

CREATE TABLE IF NOT EXISTS public.servicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_servicos_tenant_ordem
  ON public.servicos (tenant_id, ordem, nome);

CREATE TABLE IF NOT EXISTS public.pacientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pacientes_tenant_nome
  ON public.pacientes (tenant_id, nome);

-- ---------------------------------------------------------------------------
-- 2) Tenant + TV (necessários ao app Lite: configurações e painel de telas)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY,
  nome text,
  slug text,
  plano text DEFAULT 'lite',
  configuracoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tvs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tvs_tenant_nome
  ON public.tvs (tenant_id, nome);

-- ---------------------------------------------------------------------------
-- 3) Fila Lite
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.atendimentos_lite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  paciente_id uuid REFERENCES public.pacientes (id) ON DELETE SET NULL,
  profissional_id uuid REFERENCES public.profissionais (id) ON DELETE SET NULL,
  local_id uuid REFERENCES public.locais (id) ON DELETE SET NULL,
  especialidade_id uuid REFERENCES public.servicos (id) ON DELETE SET NULL,
  tv_id uuid REFERENCES public.tvs (id) ON DELETE SET NULL,
  hora_marcada timestamptz,
  status text DEFAULT 'Aguardando',
  prioridade boolean NOT NULL DEFAULT false,
  classificacao_prioridade text NOT NULL DEFAULT 'normal',
  observacao text,
  excluir_do_fechamento boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT atendimentos_lite_classificacao_prioridade_check
    CHECK (classificacao_prioridade IN ('normal', 'prioritario', 'emergencia'))
);

CREATE INDEX IF NOT EXISTS idx_atendimentos_lite_tenant_created
  ON public.atendimentos_lite (tenant_id, created_at);

CREATE INDEX IF NOT EXISTS idx_atendimentos_lite_tenant_status
  ON public.atendimentos_lite (tenant_id, status);

-- ---------------------------------------------------------------------------
-- 4) Trigger: mantém `prioridade` boolean alinhado com `classificacao_prioridade`
-- ---------------------------------------------------------------------------

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
-- 5) RLS simplificado (banco isolado Lite)
--    authenticated + tenant_id IS NOT NULL
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.lite_apply_simple_rls(p_table regclass, p_prefix text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  tbl_ident name := split_part(p_table::text, '.', 2);
BEGIN
  IF p_table IS NULL THEN
    RAISE NOTICE 'Tabela inexistente: %', p_table;
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', p_table);

  EXECUTE format('DROP POLICY IF EXISTS %I ON %s', p_prefix || '_select', p_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %s', p_prefix || '_insert', p_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %s', p_prefix || '_update', p_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %s', p_prefix || '_delete', p_table);

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

  RAISE NOTICE 'RLS Lite aplicado em public.%', tbl_ident;
END;
$$;

SELECT public.lite_apply_simple_rls('public.profissionais'::regclass,     'lite_profissionais');
SELECT public.lite_apply_simple_rls('public.locais'::regclass,             'lite_locais');
SELECT public.lite_apply_simple_rls('public.servicos'::regclass,           'lite_servicos');
SELECT public.lite_apply_simple_rls('public.pacientes'::regclass,          'lite_pacientes');
SELECT public.lite_apply_simple_rls('public.atendimentos_lite'::regclass, 'lite_atendimentos_lite');

-- tenants: app lê/atualiza configuracoes — política por id (tenant_id lógico)
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lite_tenants_select ON public.tenants;
DROP POLICY IF EXISTS lite_tenants_update ON public.tenants;
DROP POLICY IF EXISTS lite_tenants_insert ON public.tenants;

CREATE POLICY lite_tenants_select ON public.tenants
  FOR SELECT TO authenticated USING (true);

CREATE POLICY lite_tenants_insert ON public.tenants
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY lite_tenants_update ON public.tenants
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.tenants TO authenticated;

-- tvs: tenant_id opcional na UI; leitura ampla para authenticated
ALTER TABLE public.tvs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lite_tvs_select ON public.tvs;
DROP POLICY IF EXISTS lite_tvs_insert ON public.tvs;
DROP POLICY IF EXISTS lite_tvs_update ON public.tvs;
DROP POLICY IF EXISTS lite_tvs_delete ON public.tvs;

CREATE POLICY lite_tvs_select ON public.tvs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY lite_tvs_insert ON public.tvs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY lite_tvs_update ON public.tvs
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY lite_tvs_delete ON public.tvs
  FOR DELETE TO authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tvs TO authenticated;

-- ---------------------------------------------------------------------------
-- 6) Realtime (fila em tempo real no painel)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'atendimentos_lite'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.atendimentos_lite;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'Publication supabase_realtime não encontrada — ignore se projeto acabou de ser criado.';
END;
$$;

-- ---------------------------------------------------------------------------
-- 7) Seed opcional — tenant padrão (ajuste o UUID ao NEXT_PUBLIC_DEFAULT_TENANT_ID)
-- ---------------------------------------------------------------------------
INSERT INTO public.tenants (id, nome, slug, plano, configuracoes)
VALUES (
  '8679d833-2e33-4026-bff3-1d02d2ede226'::uuid,
  'Clínica Lite Demo',
  'lite-demo',
  'lite',
  '{}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------------
-- 8) Verificação rápida (somente leitura)
-- ---------------------------------------------------------------------------
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'profissionais', 'locais', 'servicos', 'pacientes',
    'atendimentos_lite', 'tenants', 'tvs'
  )
ORDER BY table_name;

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'profissionais', 'locais', 'servicos', 'pacientes',
    'atendimentos_lite', 'tenants', 'tvs'
  )
ORDER BY tablename, cmd;
