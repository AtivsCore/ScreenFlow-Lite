-- ScreenFlow Lite — schema admin (tenants + vínculo usuários)
-- Execute APÓS docs/supabase-lite-full-setup.sql no projeto dwfbocsqtqxnuvmpynon

BEGIN;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo';

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS licenca_key uuid;

UPDATE public.tenants
SET licenca_key = gen_random_uuid()
WHERE licenca_key IS NULL;

ALTER TABLE public.tenants
  ALTER COLUMN licenca_key SET DEFAULT gen_random_uuid();

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

ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lite_tenant_users_select ON public.tenant_users;
DROP POLICY IF EXISTS lite_tenant_users_insert ON public.tenant_users;
DROP POLICY IF EXISTS lite_tenant_users_delete ON public.tenant_users;

CREATE POLICY lite_tenant_users_select ON public.tenant_users
  FOR SELECT TO authenticated USING (true);

CREATE POLICY lite_tenant_users_insert ON public.tenant_users
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY lite_tenant_users_delete ON public.tenant_users
  FOR DELETE TO authenticated USING (true);

GRANT SELECT, INSERT, DELETE ON public.tenant_users TO authenticated;

COMMIT;
