ALTER POLICY "frete_uf_select_auth" ON public.frete_uf USING ((SELECT auth.uid()) IS NOT NULL);
ALTER POLICY "Authenticated can view products" ON public.products USING ((SELECT auth.uid()) IS NOT NULL);
ALTER POLICY "dim view" ON public.produto_categorias USING ((SELECT auth.uid()) IS NOT NULL);
ALTER POLICY "dim view" ON public.produto_colecoes USING ((SELECT auth.uid()) IS NOT NULL);
ALTER POLICY "dim view" ON public.produto_cores USING ((SELECT auth.uid()) IS NOT NULL);
ALTER POLICY "dim view" ON public.produto_departamentos USING ((SELECT auth.uid()) IS NOT NULL);
ALTER POLICY "dim view" ON public.produto_grupos USING ((SELECT auth.uid()) IS NOT NULL);
ALTER POLICY "Authenticated can view fases" ON public.produto_fase_dim USING ((SELECT auth.uid()) IS NOT NULL);
ALTER POLICY "Public can view photos" ON public.photos USING (
  (SELECT auth.uid()) IS NOT NULL
  OR EXISTS (SELECT 1 FROM public.products p WHERE p.ativo = true AND p.colecao = photos.colecao)
);