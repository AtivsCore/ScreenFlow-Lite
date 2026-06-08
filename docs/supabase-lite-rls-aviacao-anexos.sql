-- ScreenFlow Lite — bucket Storage `aviacao-anexos` (anexos MRO)
--
-- Erro típico no upload: "new row violates row-level security policy"
-- (política em storage.objects, não na tabela atendimentos_lite)
--
-- Execute no Supabase → SQL Editor (pode rodar quantas vezes precisar).
-- Requer usuário autenticado no painel Lite (role authenticated).

DO $fix_aviacao_anexos$
DECLARE
  bucket_id text := 'aviacao-anexos';
  pol_prefix text := 'lite_aviacao_anexos';
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    bucket_id,
    bucket_id,
    true,
    52428800,
    ARRAY[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf'
    ]::text[]
  )
  ON CONFLICT (id) DO UPDATE
  SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

  EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol_prefix || '_select_auth');
  EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol_prefix || '_select_public');
  EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol_prefix || '_insert');
  EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol_prefix || '_update');
  EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol_prefix || '_delete');

  -- Leitura: usuários logados
  EXECUTE format(
    'CREATE POLICY %I ON storage.objects FOR SELECT TO authenticated
     USING (bucket_id = %L)',
    pol_prefix || '_select_auth',
    bucket_id
  );

  -- Leitura pública (bucket marcado como public — URLs getPublicUrl)
  EXECUTE format(
    'CREATE POLICY %I ON storage.objects FOR SELECT TO anon
     USING (bucket_id = %L)',
    pol_prefix || '_select_public',
    bucket_id
  );

  -- Upload de PDFs/imagens no Novo Registro e Edição
  EXECUTE format(
    'CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated
     WITH CHECK (bucket_id = %L)',
    pol_prefix || '_insert',
    bucket_id
  );

  -- Substituir arquivo (upsert futuro / reenvio)
  EXECUTE format(
    'CREATE POLICY %I ON storage.objects FOR UPDATE TO authenticated
     USING (bucket_id = %L)
     WITH CHECK (bucket_id = %L)',
    pol_prefix || '_update',
    bucket_id,
    bucket_id
  );

  -- Remover anexo
  EXECUTE format(
    'CREATE POLICY %I ON storage.objects FOR DELETE TO authenticated
     USING (bucket_id = %L)',
    pol_prefix || '_delete',
    bucket_id
  );

  RAISE NOTICE 'Bucket % e policies % aplicados em storage.objects.', bucket_id, pol_prefix;
END
$fix_aviacao_anexos$;
