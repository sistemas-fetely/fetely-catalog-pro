
-- Tabela de logs de acesso
CREATE TABLE IF NOT EXISTS public.access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text,
  nome text,
  tipo_usuario text,
  evento text NOT NULL,
  descricao text,
  cliente_id text,
  ator_id uuid,
  ator_email text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON public.access_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_user_id ON public.access_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_evento ON public.access_logs (evento);
CREATE INDEX IF NOT EXISTS idx_access_logs_tipo ON public.access_logs (tipo_usuario);

GRANT SELECT, INSERT ON public.access_logs TO authenticated;
GRANT ALL ON public.access_logs TO service_role;

ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins veem todos os logs" ON public.access_logs;
CREATE POLICY "admins veem todos os logs" ON public.access_logs
  FOR SELECT TO authenticated
  USING (public.is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "usuario insere proprio log" ON public.access_logs;
CREATE POLICY "usuario insere proprio log" ON public.access_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_admin_or_master(auth.uid()));

-- Função: registra evento (chamável pelo client autenticado e server)
CREATE OR REPLACE FUNCTION public.log_access_event(
  p_user_id uuid,
  p_evento text,
  p_descricao text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_nome text;
  v_cliente_id text;
  v_tipo text;
  v_ator_id uuid := auth.uid();
  v_ator_email text;
  v_log_id uuid;
BEGIN
  SELECT email, nome_completo, cliente_id
    INTO v_email, v_nome, v_cliente_id
  FROM public.profiles WHERE id = p_user_id;

  SELECT CASE
    WHEN bool_or(role = 'master') THEN 'master'
    WHEN bool_or(role = 'admin') THEN 'admin'
    WHEN bool_or(role = 'cliente') THEN 'cliente'
    WHEN bool_or(role = 'vendedor') THEN 'vendedor'
    ELSE NULL
  END
  INTO v_tipo
  FROM public.user_roles WHERE user_id = p_user_id;

  IF v_ator_id IS NOT NULL THEN
    SELECT email INTO v_ator_email FROM public.profiles WHERE id = v_ator_id;
  END IF;

  INSERT INTO public.access_logs (
    user_id, email, nome, tipo_usuario, evento, descricao,
    cliente_id, ator_id, ator_email, metadata
  ) VALUES (
    p_user_id, v_email, v_nome, v_tipo, p_evento, p_descricao,
    v_cliente_id, v_ator_id, v_ator_email, COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_access_event(uuid, text, text, jsonb) TO authenticated, service_role;

-- Atualiza record_login para também gravar em access_logs
CREATE OR REPLACE FUNCTION public.record_login()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.profiles
     SET first_login_at = COALESCE(first_login_at, now()),
         last_login_at  = now(),
         login_count    = COALESCE(login_count, 0) + 1
   WHERE id = v_uid;

  PERFORM public.log_access_event(v_uid, 'login', 'Login no sistema', '{}'::jsonb);
END;
$$;
