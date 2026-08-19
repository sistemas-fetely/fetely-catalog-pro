-- Internos e admins: visão total. Representantes: somente seus próprios registros.
DROP POLICY IF EXISTS "orders select" ON public.orders;
CREATE POLICY "orders select" ON public.orders FOR SELECT TO authenticated
USING (
  is_admin_or_master(auth.uid())
  OR (has_role(auth.uid(), 'vendedor'::app_role) AND NOT is_representante(auth.uid()))
  OR vendedor_id = auth.uid()
  OR cliente_id IN (SELECT p.cliente_id FROM profiles p WHERE p.id = auth.uid() AND p.cliente_id IS NOT NULL)
  OR cliente_id IN (SELECT c.id FROM clientes c WHERE c.cadastrado_por_vendedor_id = auth.uid())
);

DROP POLICY IF EXISTS "cotacoes select" ON public.cotacoes;
CREATE POLICY "cotacoes select" ON public.cotacoes FOR SELECT TO authenticated
USING (
  is_admin_or_master(auth.uid())
  OR (has_role(auth.uid(), 'vendedor'::app_role) AND NOT is_representante(auth.uid()))
  OR vendedor_id = auth.uid()
  OR cliente_id IN (SELECT p.cliente_id FROM profiles p WHERE p.id = auth.uid() AND p.cliente_id IS NOT NULL)
  OR cliente_id IN (SELECT c.id FROM clientes c WHERE c.cadastrado_por_vendedor_id = auth.uid())
);

DROP POLICY IF EXISTS "provisoes select" ON public.provisoes;
CREATE POLICY "provisoes select" ON public.provisoes FOR SELECT TO authenticated
USING (
  is_admin_or_master(auth.uid())
  OR (has_role(auth.uid(), 'vendedor'::app_role) AND NOT is_representante(auth.uid()))
  OR vendedor_id = auth.uid()
  OR cliente_id IN (SELECT p.cliente_id FROM profiles p WHERE p.id = auth.uid() AND p.cliente_id IS NOT NULL)
  OR cliente_id IN (SELECT c.id FROM clientes c WHERE c.cadastrado_por_vendedor_id = auth.uid())
);

DROP POLICY IF EXISTS "order_items select" ON public.order_items;
CREATE POLICY "order_items select" ON public.order_items FOR SELECT TO authenticated
USING (
  is_admin_or_master(auth.uid())
  OR (has_role(auth.uid(), 'vendedor'::app_role) AND NOT is_representante(auth.uid()))
  OR EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id
      AND (
        o.vendedor_id = auth.uid()
        OR o.cliente_id IN (SELECT p.cliente_id FROM profiles p WHERE p.id = auth.uid() AND p.cliente_id IS NOT NULL)
        OR o.cliente_id IN (SELECT c.id FROM clientes c WHERE c.cadastrado_por_vendedor_id = auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "provisao_itens select" ON public.provisao_itens;
CREATE POLICY "provisao_itens select" ON public.provisao_itens FOR SELECT TO authenticated
USING (
  is_admin_or_master(auth.uid())
  OR (has_role(auth.uid(), 'vendedor'::app_role) AND NOT is_representante(auth.uid()))
  OR EXISTS (
    SELECT 1 FROM provisoes p
    WHERE p.id = provisao_itens.provisao_id
      AND (
        p.vendedor_id = auth.uid()
        OR p.cliente_id IN (SELECT pr.cliente_id FROM profiles pr WHERE pr.id = auth.uid() AND pr.cliente_id IS NOT NULL)
        OR p.cliente_id IN (SELECT c.id FROM clientes c WHERE c.cadastrado_por_vendedor_id = auth.uid())
      )
  )
);