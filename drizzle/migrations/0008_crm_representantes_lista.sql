CREATE OR REPLACE FUNCTION public.crm_representantes_lista()
RETURNS TABLE(id uuid, nome text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, coalesce(nullif(p.nome_completo,''), p.email) AS nome, p.email
  FROM public.profiles p
  WHERE p.tipo_vendedor = 'representante'
    AND (public.crm_is_gestao(auth.uid()) OR p.id = auth.uid())
  ORDER BY 2
$$;
REVOKE ALL ON FUNCTION public.crm_representantes_lista() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.crm_representantes_lista() TO authenticated;