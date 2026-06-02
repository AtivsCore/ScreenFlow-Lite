-- =============================================================================
-- ScreenFlow Lite — SCHEMA COMPLETO CONSOLIDADO (greenfield)
--
-- Projeto alvo: Supabase Lite isolado (ex.: dwfbocsqtqxnuvmpynon)
-- ⚠️  NÃO execute no banco ScreenFlow Pro / screenflow-prod.
--
-- Origem da engenharia reversa:
--   • 23 migrations Pro em "copia arqv banco supa" (deltas sobre schema base Pro)
--   • Código TypeScript/API do app ScreenFlow Lite (src/)
--   • docs/supabase-lite-full-setup.sql + supabase-lite-admin-schema.sql
--
-- O que NÃO entra no Lite (exclusivo Pro — omitido de propósito):
--   pacientes como fila de etapas, fluxo_etapas, telas, telas_tv, dados_vivos,
--   emergencias, comunicacoes_internas, estatisticas_diarias,
--   metricas_historicas_etapas, resumo_operacao_dia(), pareamento TV Pro,
--   tenants.tema_tv | plano_atual | google_sheets_url | ultimas_chamadas_tv,
--   profissionais.papel | ordem | fluxo_etapa_padrao_id, locais.observacao | ativo | ordem
--
-- Tabelas Lite (8): tenants, tenant_users, profissionais, locais, servicos,
--                   pacientes, tvs, atendimentos_lite
--
-- RLS: isolamento real via tenant_users + auth_user_owns_tenant().
--       anon SELECT limitado (TV/display via API com filtro tenant_id=eq.).
--
-- Idempotente: IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) Extensões
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1) Função auxiliar RLS (padrão Pro — migration 20260502180000)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_user_owns_tenant(check_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
      AND tu.tenant_id = check_tenant_id
  );
$$;

REVOKE ALL ON FUNCTION public.auth_user_owns_tenant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_user_owns_tenant(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.auth_user_owns_tenant(uuid) IS
  'true se auth.uid() está vinculado ao tenant em tenant_users; base das políticas RLS Lite.';

-- ---------------------------------------------------------------------------
-- 2) tenants (base Pro inferida + Lite + admin)
--    Pro migrations: ultimas_chamadas_tv, tema_tv, plano_atual, google_sheets_url
--    Lite: configuracoes jsonb; admin: status, licenca_key
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY,
  nome text,
  slug text,
  plano text NOT NULL DEFAULT 'lite',
  status text NOT NULL DEFAULT 'ativo',
  licenca_key uuid NOT NULL DEFAULT gen_random_uuid(),
  configuracoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS nome text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS plano text NOT NULL DEFAULT 'lite';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS licenca_key uuid;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS configuracoes jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

UPDATE public.tenants SET licenca_key = gen_random_uuid() WHERE licenca_key IS NULL;
ALTER TABLE public.tenants ALTER COLUMN licenca_key SET DEFAULT gen_random_uuid();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_status_check'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_status_check
      CHECK (status IN ('ativo', 'bloqueado', 'trial'));
  END IF;
EXCEPTION
  WHEN check_violation THEN
    RAISE NOTICE 'tenants_status_check: ajuste valores inválidos em status antes de reaplicar.';
END;
$$;

COMMENT ON COLUMN public.tenants.plano IS 'Lite fixo na operação SaaS: lite';
COMMENT ON COLUMN public.tenants.configuracoes IS 'queueTabs, priorityLawEnabled, registerForm, tvDisplay (app)';
COMMENT ON COLUMN public.tenants.status IS 'ativo | bloqueado | trial — painel admin';
COMMENT ON COLUMN public.tenants.licenca_key IS 'Chave de licença / kit de entrega';

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants (slug);

-- ---------------------------------------------------------------------------
-- 3) tenant_users (admin + RLS)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON public.tenant_users (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user ON public.tenant_users (user_id);

-- ---------------------------------------------------------------------------
-- 4) Cadastros Lite (subconjunto Pro: locais + profissionais simplificados)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profissionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  nome text NOT NULL,
  especialidade text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profissionais ADD COLUMN IF NOT EXISTS especialidade text;
ALTER TABLE public.profissionais ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_profissionais_tenant_nome
  ON public.profissionais (tenant_id, nome);

CREATE TABLE IF NOT EXISTS public.locais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.locais ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.locais ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_locais_tenant_nome
  ON public.locais (tenant_id, nome);

CREATE TABLE IF NOT EXISTS public.servicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 0;
ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_servicos_tenant_ordem
  ON public.servicos (tenant_id, ordem, nome);

-- pacientes Lite = cadastro mínimo de nome (fila fica em atendimentos_lite)
CREATE TABLE IF NOT EXISTS public.pacientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_pacientes_tenant_nome
  ON public.pacientes (tenant_id, nome);

-- TVs Lite (substitui telas + telas_tv do Pro)
CREATE TABLE IF NOT EXISTS public.tvs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants (id) ON DELETE CASCADE,
  nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tvs ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.tvs ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_tvs_tenant_nome
  ON public.tvs (tenant_id, nome);

-- ---------------------------------------------------------------------------
-- 5) Fila Lite (substitui pacientes como fila + fluxo_etapas do Pro)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.atendimentos_lite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
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
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.atendimentos_lite ADD COLUMN IF NOT EXISTS classificacao_prioridade text NOT NULL DEFAULT 'normal';
ALTER TABLE public.atendimentos_lite ADD COLUMN IF NOT EXISTS excluir_do_fechamento boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'atendimentos_lite_classificacao_prioridade_check'
  ) THEN
    ALTER TABLE public.atendimentos_lite
      ADD CONSTRAINT atendimentos_lite_classificacao_prioridade_check
      CHECK (classificacao_prioridade IN ('normal', 'prioritario', 'emergencia'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_atendimentos_lite_tenant_created
  ON public.atendimentos_lite (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_atendimentos_lite_tenant_status
  ON public.atendimentos_lite (tenant_id, status);

-- FKs tenant_id → tenants (idempotente; ignora se houver órfãos)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profissionais_tenant_id_fkey') THEN
    ALTER TABLE public.profissionais
      ADD CONSTRAINT profissionais_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'locais_tenant_id_fkey') THEN
    ALTER TABLE public.locais
      ADD CONSTRAINT locais_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'servicos_tenant_id_fkey') THEN
    ALTER TABLE public.servicos
      ADD CONSTRAINT servicos_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pacientes_tenant_id_fkey') THEN
    ALTER TABLE public.pacientes
      ADD CONSTRAINT pacientes_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'atendimentos_lite_tenant_id_fkey') THEN
    ALTER TABLE public.atendimentos_lite
      ADD CONSTRAINT atendimentos_lite_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants (id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Algumas FKs não aplicadas (dados órfãos?): %', SQLERRM;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6) Trigger prioridade ↔ classificacao_prioridade
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
-- 7) Realtime (fila — painel authenticated)
-- ---------------------------------------------------------------------------
ALTER TABLE public.atendimentos_lite REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'atendimentos_lite'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.atendimentos_lite;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'Publication supabase_realtime ausente — ignore em projeto recém-criado.';
END;
$$;

-- ---------------------------------------------------------------------------
-- 8) RLS — helper para recriar políticas por tabela
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lite_drop_policies(p_table name)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = p_table
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, p_table);
  END LOOP;
END;
$$;

-- ── profissionais, locais, servicos, pacientes, atendimentos_lite ────────────
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'profissionais', 'locais', 'servicos', 'pacientes', 'atendimentos_lite'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    PERFORM public.lite_drop_policies(tbl);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
       USING (public.auth_user_owns_tenant(tenant_id))',
      tbl || '_select_own', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated
       WITH CHECK (public.auth_user_owns_tenant(tenant_id))',
      tbl || '_insert_own', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
       USING (public.auth_user_owns_tenant(tenant_id))
       WITH CHECK (public.auth_user_owns_tenant(tenant_id))',
      tbl || '_update_own', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated
       USING (public.auth_user_owns_tenant(tenant_id))',
      tbl || '_delete_own', tbl
    );

    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated',
      tbl
    );
  END LOOP;
END;
$$;

-- anon SELECT para /display e /api/atendimentos-queue (API DEVE filtrar tenant_id=eq.)
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['atendimentos_lite', 'servicos', 'pacientes', 'profissionais', 'locais']
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO anon
       USING (tenant_id IS NOT NULL)',
      tbl || '_select_anon_display', tbl
    );
    EXECUTE format('GRANT SELECT ON public.%I TO anon', tbl);
  END LOOP;
END;
$$;

-- ── tenants ────────────────────────────────────────────────────────────────
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
SELECT public.lite_drop_policies('tenants');

CREATE POLICY tenants_select_own ON public.tenants
  FOR SELECT TO authenticated
  USING (public.auth_user_owns_tenant(id));

CREATE POLICY tenants_update_own ON public.tenants
  FOR UPDATE TO authenticated
  USING (public.auth_user_owns_tenant(id))
  WITH CHECK (public.auth_user_owns_tenant(id));

CREATE POLICY tenants_select_anon_display ON public.tenants
  FOR SELECT TO anon
  USING (true);

GRANT SELECT, UPDATE ON public.tenants TO authenticated;
GRANT SELECT ON public.tenants TO anon;

-- INSERT em tenants: somente service_role (painel admin) — sem policy authenticated

-- ── tenant_users ───────────────────────────────────────────────────────────
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
SELECT public.lite_drop_policies('tenant_users');

CREATE POLICY tenant_users_select_own ON public.tenant_users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.auth_user_owns_tenant(tenant_id));

GRANT SELECT ON public.tenant_users TO authenticated;

-- INSERT/DELETE tenant_users: service_role (admin API) — sem policy authenticated

-- ── tvs ────────────────────────────────────────────────────────────────────
ALTER TABLE public.tvs ENABLE ROW LEVEL SECURITY;
SELECT public.lite_drop_policies('tvs');

CREATE POLICY tvs_select_own ON public.tvs
  FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR public.auth_user_owns_tenant(tenant_id));

CREATE POLICY tvs_insert_own ON public.tvs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IS NULL OR public.auth_user_owns_tenant(tenant_id));

CREATE POLICY tvs_update_own ON public.tvs
  FOR UPDATE TO authenticated
  USING (tenant_id IS NULL OR public.auth_user_owns_tenant(tenant_id))
  WITH CHECK (tenant_id IS NULL OR public.auth_user_owns_tenant(tenant_id));

CREATE POLICY tvs_delete_own ON public.tvs
  FOR DELETE TO authenticated
  USING (tenant_id IS NULL OR public.auth_user_owns_tenant(tenant_id));

CREATE POLICY tvs_select_anon_display ON public.tvs
  FOR SELECT TO anon
  USING (tenant_id IS NOT NULL);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tvs TO authenticated;
GRANT SELECT ON public.tvs TO anon;

-- ---------------------------------------------------------------------------
-- 9) Seed demo (alinhado a NEXT_PUBLIC_DEFAULT_TENANT_ID)
-- ---------------------------------------------------------------------------
INSERT INTO public.tenants (id, nome, slug, plano, status, configuracoes)
VALUES (
  '8679d833-2e33-4026-bff3-1d02d2ede226'::uuid,
  'Clínica Lite Demo',
  'lite-demo',
  'lite',
  'ativo',
  '{}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  slug = EXCLUDED.slug,
  plano = EXCLUDED.plano,
  status = EXCLUDED.status;

INSERT INTO public.profissionais (tenant_id, nome, especialidade)
SELECT '8679d833-2e33-4026-bff3-1d02d2ede226'::uuid, 'Dr. Demo', 'Clínico Geral'
WHERE NOT EXISTS (
  SELECT 1 FROM public.profissionais
  WHERE tenant_id = '8679d833-2e33-4026-bff3-1d02d2ede226'::uuid
);

INSERT INTO public.locais (tenant_id, nome)
SELECT '8679d833-2e33-4026-bff3-1d02d2ede226'::uuid, 'Sala 1'
WHERE NOT EXISTS (
  SELECT 1 FROM public.locais
  WHERE tenant_id = '8679d833-2e33-4026-bff3-1d02d2ede226'::uuid
);

INSERT INTO public.servicos (tenant_id, nome, ordem)
SELECT '8679d833-2e33-4026-bff3-1d02d2ede226'::uuid, v.nome, v.ordem
FROM (VALUES ('Consulta', 0), ('Retorno', 1)) AS v(nome, ordem)
WHERE NOT EXISTS (
  SELECT 1 FROM public.servicos
  WHERE tenant_id = '8679d833-2e33-4026-bff3-1d02d2ede226'::uuid
);

INSERT INTO public.tvs (tenant_id, nome)
SELECT '8679d833-2e33-4026-bff3-1d02d2ede226'::uuid, 'TV Recepção'
WHERE NOT EXISTS (
  SELECT 1 FROM public.tvs
  WHERE tenant_id = '8679d833-2e33-4026-bff3-1d02d2ede226'::uuid
);

COMMIT;

-- ---------------------------------------------------------------------------
-- 10) Verificação (somente leitura)
-- ---------------------------------------------------------------------------
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'tenants', 'tenant_users', 'profissionais', 'locais', 'servicos',
    'pacientes', 'tvs', 'atendimentos_lite'
  )
ORDER BY table_name;

SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'tenants', 'tenant_users', 'profissionais', 'locais', 'servicos',
    'pacientes', 'tvs', 'atendimentos_lite'
  )
ORDER BY tablename, cmd, policyname;

-- ---------------------------------------------------------------------------
-- APÊNDICE — Schema Pro reconstruído (referência; NÃO criado no Lite)
-- ---------------------------------------------------------------------------
-- tenants (Pro completo inferido):
--   id, nome, slug, plano, plano_atual, status, licenca_key, tema_tv,
--   ultimas_chamadas_tv jsonb, google_sheets_url, configuracoes jsonb, created_at
--
-- pacientes (Pro — fila principal, ~20 colunas):
--   id, tenant_id, nome, documento, status, etapa_atual_id → fluxo_etapas,
--   atendimento_tipo, hora_agendada, fila_ordem, prioridade, sub_status,
--   desfecho, etapa_entrada_em, profissional_id, local_id, observacao_clinica,
--   atendimento_observacao, etiqueta_tv, data_agendada, created_at, updated_at
--
-- fluxo_etapas, telas, telas_tv, dados_vivos, emergencias,
-- comunicacoes_internas, estatisticas_diarias, metricas_historicas_etapas
-- → ver migrations 20250427 … 20260529120000 na pasta "copia arqv banco supa"
--
-- Pós-deploy obrigatório:
--   1) Vincular usuário Auth ao tenant via painel admin (tenant_users)
--   2) Sem tenant_users, authenticated não vê cadastros (RLS correto)
--   3) Admin master usa SUPABASE_SERVICE_ROLE_KEY (bypass RLS)
--   4) TV/display: filtre tenant_id nas rotas API (melhoria futura no app)
