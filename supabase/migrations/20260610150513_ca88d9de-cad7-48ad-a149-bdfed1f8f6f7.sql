DROP POLICY IF EXISTS "clientes select" ON public.clientes;
DROP POLICY IF EXISTS "clientes update" ON public.clientes;

CREATE POLICY "clientes select" ON public.clientes
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'vendedor'::app_role)
  OR is_admin_or_master(auth.uid())
);

CREATE POLICY "clientes update" ON public.clientes
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'vendedor'::app_role)
  OR is_admin_or_master(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'vendedor'::app_role)
  OR is_admin_or_master(auth.uid())
);