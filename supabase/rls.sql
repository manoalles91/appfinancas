-- ============================================================================
-- MIGRAÇÃO: ROW LEVEL SECURITY + DONO (owner) POR LINHA
-- App: Minhas Finanças & Casa (appfinancas)
--
-- COMO APLICAR:
--   1) Abra o SQL Editor do seu projeto em https://supabase.com/dashboard
--   2) Cole este arquivo inteiro e clique em RUN.
--   3) Substitua o conteúdo de appfinancas/.env.local:
--        NEXT_PUBLIC_REQUIRE_AUTH=true
--      Isso faz o app exigir login (Supabase Auth) antes de mostrar os dados.
--   4) Rebuild do app (npm run build) e reenvie o arquivo estático gerado em /out.
--   5) Crie um usuário no app (tela "Criar conta"). O primeiro login "adota" as
--      linhas legadas (owner IS NULL). Use o mesmo e-mail em todos os aparelhos.
--
-- OBSERVAÇÃO: se você JÁ tem dados nas tabelas, rode este script. As linhas
-- existentes ficam com owner = NULL e são "adotadas" pelo primeiro usuário
-- autenticado que logar (ver política 'claim legacy'). Depois que todos os seus
-- dados forem adotados, você pode remover a política 'claim legacy' e a cláusula
-- da política 'read own' que libera owner IS NULL (final do arquivo).
-- ============================================================================

-- 1) Adiciona a coluna owner (uuid) às tabelas protegidas
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS owner uuid;
ALTER TABLE public.cartoes      ADD COLUMN IF NOT EXISTS owner uuid;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS owner uuid;

-- 2) Habilita RLS nas tabelas
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cartoes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 3) Políticas genéricas (reutilizáveis) -------------------------------------------------
-- Cada tabela ganha políticas de SELECT/INSERT/UPDATE/DELETE restritas a auth.uid() = owner.

DO $$
DECLARE
  t text;
  pol text;
BEGIN
  FOREACH t IN ARRAY ARRAY['transactions','cartoes','app_settings']
  LOOP
    -- SELECT: só o próprio dono (ou linhas legadas, até serem adotadas)
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'read own ' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT USING (owner = auth.uid() OR owner IS NULL)',
      'read own ' || t, t
    );

    -- INSERT: grava owner = auth.uid() automaticamente
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'insert own ' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT WITH CHECK (owner = auth.uid() OR owner IS NULL)',
      'insert own ' || t, t
    );

    -- UPDATE: só pode alterar (e reivindicar) linhas próprias
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'update own ' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE USING (owner = auth.uid() OR owner IS NULL) WITH CHECK (owner = auth.uid())',
      'update own ' || t, t
    );

    -- DELETE: só pode apagar linhas próprias
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'delete own ' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE USING (owner = auth.uid() OR owner IS NULL)',
      'delete own ' || t, t
    );
  END LOOP;
END $$;

-- 4) Trigger: define owner = auth.uid() automaticamente em toda inserção ---------------
DO $$
DECLARE t text; fn text;
BEGIN
  FOREACH t IN ARRAY ARRAY['transactions','cartoes','app_settings']
  LOOP
    fn := 'set_owner_' || t;
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', fn, t);
    EXECUTE format('DROP FUNCTION IF EXISTS %I CASCADE', fn);
    EXECUTE format(
      'CREATE FUNCTION %I() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
       BEGIN
         IF NEW.owner IS NULL THEN NEW.owner := auth.uid(); END IF;
         RETURN NEW;
       END $$', fn
    );
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION %I()',
      fn, t, fn
    );
  END LOOP;
END $$;

-- 4b) Tabela de histórico (audit trail) ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  owner uuid,
  action text,
  entity text,
  entity_id text,
  description text,
  meta jsonb
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol text;
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS read own audit_log ON public.audit_log';
  EXECUTE 'CREATE POLICY read own audit_log ON public.audit_log FOR SELECT USING (owner = auth.uid() OR owner IS NULL)';

  EXECUTE 'DROP POLICY IF EXISTS insert own audit_log ON public.audit_log';
  EXECUTE 'CREATE POLICY insert own audit_log ON public.audit_log FOR INSERT WITH CHECK (owner = auth.uid() OR owner IS NULL)';

  EXECUTE 'DROP POLICY IF EXISTS delete own audit_log ON public.audit_log';
  EXECUTE 'CREATE POLICY delete own audit_log ON public.audit_log FOR DELETE USING (owner = auth.uid() OR owner IS NULL)';

  EXECUTE 'DROP TRIGGER IF EXISTS set_owner_audit_log ON public.audit_log';
  EXECUTE 'DROP FUNCTION IF EXISTS set_owner_audit_log CASCADE';
  EXECUTE 'CREATE FUNCTION set_owner_audit_log() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
          BEGIN
            IF NEW.owner IS NULL THEN NEW.owner := auth.uid(); END IF;
            RETURN NEW;
          END $$';
  EXECUTE 'CREATE TRIGGER set_owner_audit_log BEFORE INSERT ON public.audit_log FOR EACH ROW EXECUTE FUNCTION set_owner_audit_log()';
END $$;

-- 5) Anônimos (não logados) não enxergam/não alteram nada ---------------------------------
-- O Supabase, por padrão, não cria "grant" para anon. Garantimos que apenas
-- usuários autenticados (role authenticated) tenham acesso às tabelas via RLS.
REVOKE ALL ON public.transactions FROM anon;
REVOKE ALL ON public.cartoes FROM anon;
REVOKE ALL ON public.app_settings FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cartoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.audit_log TO authenticated;

-- ============================================================================
-- APÓS ADOTAR TODOS OS SEUS DADOS (primeiro login), você PODE (opcional)
-- endurecer removendo o acesso a linhas legadas. Rode o bloco abaixo quando
-- não houver mais linhas com owner IS NULL:
--
--   DO $$
--   DECLARE t text;
--   BEGIN
--     FOREACH t IN ARRAY ARRAY['transactions','cartoes','app_settings']
--     LOOP
--       EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'read own ' || t, t);
--       EXECUTE format(
--         'CREATE POLICY %I ON %I FOR SELECT USING (owner = auth.uid())',
--         'read own ' || t, t
--       );
--       EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'delete own ' || t, t);
--       EXECUTE format(
--         'CREATE POLICY %I ON %I FOR DELETE USING (owner = auth.uid())',
--         'delete own ' || t, t
--       );
--       EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'claim legacy ' || t, t);
--     END LOOP;
--   END $$;
-- ============================================================================
