-- Vincula usuário Supabase ↔ Cliente lojista (preenchido só quando role='cliente')
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cliente_id uuid;

CREATE INDEX IF NOT EXISTS profiles_cliente_id_idx
  ON public.profiles (cliente_id)
  WHERE cliente_id IS NOT NULL;

-- Helper de role (consistente com is_admin_or_master)
CREATE OR REPLACE FUNCTION private.is_cliente(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'cliente'::public.app_role
  )
$$;

-- Admins podem inserir/remover role 'cliente' (master já pode pela policy ALL existente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_roles'
      AND policyname = 'Admins can insert cliente roles'
  ) THEN
    CREATE POLICY "Admins can insert cliente roles"
      ON public.user_roles
      FOR INSERT
      TO authenticated
      WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) AND role = 'cliente'::app_role);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_roles'
      AND policyname = 'Admins can delete cliente roles'
  ) THEN
    CREATE POLICY "Admins can delete cliente roles"
      ON public.user_roles
      FOR DELETE
      TO authenticated
      USING (private.has_role(auth.uid(), 'admin'::app_role) AND role = 'cliente'::app_role);
  END IF;
END$$;