DROP POLICY IF EXISTS "anon insere evento" ON public.evento_catalogo;
DROP POLICY IF EXISTS "Anon pode inserir pre-selecao" ON public.pre_selecoes;
DROP POLICY IF EXISTS "Authenticated pode inserir pre-selecao" ON public.pre_selecoes;

DROP POLICY IF EXISTS "origens_fiscais_leitura" ON public.produto_origens_fiscais;
CREATE POLICY "origens_fiscais_leitura" ON public.produto_origens_fiscais
  FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Qualquer um lê flags públicas" ON public.feature_flags;
CREATE POLICY "Usuarios leem flags" ON public.feature_flags
  FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can view ficha" ON public.produto_fase_ficha;
CREATE POLICY "Authenticated can view ficha" ON public.produto_fase_ficha
  FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "crm gondola select" ON storage.objects;
CREATE POLICY "crm gondola select" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'crm-gondola' AND EXISTS (
      SELECT 1 FROM public.crm_leads l
      WHERE l.id::text = (storage.foldername(objects.name))[1]
        AND (public.crm_is_gestao((select auth.uid()))
             OR (public.is_representante((select auth.uid())) AND l.representante_id = (select auth.uid())))
    )
  );

DROP POLICY IF EXISTS "crm gondola insert" ON storage.objects;
CREATE POLICY "crm gondola insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'crm-gondola' AND EXISTS (
      SELECT 1 FROM public.crm_leads l
      WHERE l.id::text = (storage.foldername(objects.name))[1]
        AND (public.crm_is_gestao((select auth.uid()))
             OR (public.is_representante((select auth.uid())) AND l.representante_id = (select auth.uid())))
    )
  );