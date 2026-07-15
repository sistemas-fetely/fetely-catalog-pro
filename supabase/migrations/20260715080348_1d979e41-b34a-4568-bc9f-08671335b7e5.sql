CREATE OR REPLACE FUNCTION public.ensure_link_instance_for_login(p_login text)
RETURNS TABLE(id uuid, token text, origem_tipo text, origem_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_login text := lower(trim(coalesce(p_login, '')));
  v_profile_id uuid;
  v_tipo_vendedor text;
  v_origem_tipo text;
  v_id uuid;
  v_token text;
BEGIN
  IF v_login = '' THEN
    RETURN;
  END IF;

  SELECT p.id, p.tipo_vendedor
    INTO v_profile_id, v_tipo_vendedor
  FROM public.profiles p
  WHERE lower(p.login_amigavel) = v_login
     OR lower(p.codigo_vendedor) = v_login
  LIMIT 1;

  v_origem_tipo := CASE
    WHEN v_tipo_vendedor = 'representante' THEN 'representante'
    WHEN v_profile_id IS NOT NULL THEN 'vendedor_interno'
    ELSE 'generico'
  END;

  SELECT li.id, li.token
    INTO v_id, v_token
  FROM public.link_instance li
  WHERE li.origem_login = v_login
  LIMIT 1;

  IF v_id IS NULL THEN
    v_token := 'v_' || v_login;
    INSERT INTO public.link_instance (token, origem_id, origem_login, origem_tipo)
    VALUES (v_token, v_profile_id, v_login, v_origem_tipo)
    RETURNING link_instance.id INTO v_id;
  ELSE
    UPDATE public.link_instance li
       SET origem_id = COALESCE(v_profile_id, li.origem_id),
           origem_tipo = v_origem_tipo
     WHERE li.id = v_id
       AND (li.origem_tipo IS DISTINCT FROM v_origem_tipo OR li.origem_id IS DISTINCT FROM v_profile_id);
  END IF;

  RETURN QUERY
  SELECT v_id AS id, v_token AS token, v_origem_tipo AS origem_tipo, v_profile_id AS origem_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_link_instance_for_login(text) TO anon, authenticated;