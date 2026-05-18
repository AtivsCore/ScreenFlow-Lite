-- ScreenFlow Lite — SaaS genérico (JSONB + colunas opcionais na fila)
--
-- Este script NÃO usa REFERENCES nas novas colunas, para não falhar se alguma
-- tabela auxiliar ainda não existir ou tiver outro nome (ex.: servicos vs especialidades).
--
-- No app Next.js, defina o nome da tabela de serviços se não for `especialidades`:
--   NEXT_PUBLIC_SUPABASE_SERVICES_TABLE=servicos

-- Configurações dinâmicas por tenant (abas, regras, TV, formulário)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS configuracoes jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Vínculos na fila + exclusão do fechamento diário (Planilhas)
ALTER TABLE public.atendimentos_lite
  ADD COLUMN IF NOT EXISTS local_id uuid;

ALTER TABLE public.atendimentos_lite
  ADD COLUMN IF NOT EXISTS especialidade_id uuid;

ALTER TABLE public.atendimentos_lite
  ADD COLUMN IF NOT EXISTS tv_id uuid;

ALTER TABLE public.atendimentos_lite
  ADD COLUMN IF NOT EXISTS excluir_do_fechamento boolean NOT NULL DEFAULT false;

-- Índices leves para relatório / cron
CREATE INDEX IF NOT EXISTS idx_atendimentos_lite_tenant_created
  ON public.atendimentos_lite (tenant_id, created_at);

-- ---------------------------------------------------------------------------
-- Opcional: depois que as tabelas existirem, adicione FKs no Editor do Supabase
-- (Database → atendimentos_lite → Foreign keys) ou via SQL, por exemplo:
--
-- ALTER TABLE public.atendimentos_lite
--   ADD CONSTRAINT atendimentos_lite_local_id_fkey
--   FOREIGN KEY (local_id) REFERENCES public.locais (id);
--
-- ALTER TABLE public.atendimentos_lite
--   ADD CONSTRAINT atendimentos_lite_servico_id_fkey
--   FOREIGN KEY (especialidade_id) REFERENCES public.servicos (id);
--   -- ou REFERENCES public.especialidades (id)
--
-- ALTER TABLE public.atendimentos_lite
--   ADD CONSTRAINT atendimentos_lite_tv_id_fkey
--   FOREIGN KEY (tv_id) REFERENCES public.tvs (id);
