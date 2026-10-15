DROP POLICY IF EXISTS "clientes insert" ON public.clientes;
CREATE POLICY "clientes insert" ON public.clientes FOR INSERT TO authenticated
WITH CHECK (
  cadastrado_por_vendedor_id = auth.uid()
  OR public.is_admin_or_master(auth.uid())
  OR (public.has_role(auth.uid(), 'vendedor'::app_role) AND NOT public.is_representante(auth.uid()))
);