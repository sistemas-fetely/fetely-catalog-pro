CREATE OR REPLACE FUNCTION public.is_representante(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id AND p.tipo_vendedor = 'representante'
  )
$$;

ALTER VIEW public.sessao_catalogo_estado SET (security_invoker = true);

DROP POLICY IF EXISTS "interno lê pool" ON public.sessao_catalogo;
CREATE POLICY "interno lê pool" ON public.sessao_catalogo
FOR SELECT TO authenticated
USING (
  NOT public.is_representante(auth.uid())
  AND origem_tipo_snapshot = ANY (ARRAY['vendedor_interno','sdr','generico'])
);

DROP POLICY IF EXISTS "responsavel lê sessao atribuida" ON public.sessao_catalogo;
CREATE POLICY "responsavel lê sessao atribuida" ON public.sessao_catalogo
FOR SELECT TO authenticated
USING (vendedor_responsavel = auth.uid());