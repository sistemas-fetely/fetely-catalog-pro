DROP POLICY IF EXISTS "orders select" ON public.orders;
CREATE POLICY "orders select"
ON public.orders
FOR SELECT
USING (
  vendedor_id = auth.uid()
  OR is_admin_or_master(auth.uid())
  OR cliente_id IN (
    SELECT p.cliente_id
    FROM public.profiles p
    WHERE p.id = auth.uid() AND p.cliente_id IS NOT NULL
  )
  OR cliente_id IN (
    SELECT c.id FROM public.clientes c
    WHERE c.cadastrado_por_vendedor_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "provisoes select" ON public.provisoes;
CREATE POLICY "provisoes select"
ON public.provisoes
FOR SELECT
USING (
  vendedor_id = auth.uid()
  OR is_admin_or_master(auth.uid())
  OR cliente_id IN (
    SELECT p.cliente_id
    FROM public.profiles p
    WHERE p.id = auth.uid() AND p.cliente_id IS NOT NULL
  )
  OR cliente_id IN (
    SELECT c.id FROM public.clientes c
    WHERE c.cadastrado_por_vendedor_id = auth.uid()
  )
);