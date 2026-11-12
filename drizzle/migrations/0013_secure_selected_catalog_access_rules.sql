-- Only the nine selected scanner findings; public catalog delivery remains via catalogo-file.
ALTER TABLE public.produto_canal_dim ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.produto_canal_dim FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produto_canal_dim TO authenticated;
GRANT ALL ON public.produto_canal_dim TO service_role;
CREATE POLICY "catalog channel admin read" ON public.produto_canal_dim FOR SELECT TO authenticated USING (private.is_admin_or_master(auth.uid()));
CREATE POLICY "catalog channel admin insert" ON public.produto_canal_dim FOR INSERT TO authenticated WITH CHECK (private.is_admin_or_master(auth.uid()));
CREATE POLICY "catalog channel admin update" ON public.produto_canal_dim FOR UPDATE TO authenticated USING (private.is_admin_or_master(auth.uid())) WITH CHECK (private.is_admin_or_master(auth.uid()));
CREATE POLICY "catalog channel admin delete" ON public.produto_canal_dim FOR DELETE TO authenticated USING (private.is_admin_or_master(auth.uid()));

ALTER POLICY "perm_perfis_select_auth" ON public.permissoes_perfis_override USING (private.is_admin_or_master(auth.uid()));
ALTER POLICY "perm_grupo_ov_select_auth" ON public.permissoes_grupo_overrides USING (private.is_admin_or_master(auth.uid()));
ALTER POLICY "perm_grupos_select_auth" ON public.permissoes_grupos USING (private.is_admin_or_master(auth.uid()));
ALTER POLICY "leitura_autenticados" ON public.produto_exigencia_dim USING (private.is_admin_or_master(auth.uid()));

-- Public attribution resolves a single login through the existing RPC, not by listing access keys.
DROP POLICY "anon pode ler link_instance" ON public.link_instance;
DROP POLICY "authenticated lê link_instance" ON public.link_instance;
REVOKE SELECT ON public.link_instance FROM anon;

-- Public tracking already uses public_upsert_sessao_catalogo; disallow unrestricted table writes.
DROP POLICY "anon atualiza sessao" ON public.sessao_catalogo;
DROP POLICY "anon insere sessao" ON public.sessao_catalogo;
REVOKE INSERT, UPDATE ON public.sessao_catalogo FROM anon;

-- Internal sales staff keep their pool; representatives only see carts attached to visible sessions.
ALTER POLICY "Equipe pode ver carrinhos salvos" ON public.wishlist_carrinho USING (
  private.is_admin_or_master(auth.uid()) OR (
    public.has_role(auth.uid(), 'vendedor'::public.app_role) AND (
      public.is_vendedor_interno(auth.uid()) OR EXISTS (
        SELECT 1 FROM public.sessao_catalogo s
        WHERE s.origem_id_snapshot = auth.uid()
          AND s.origem_tipo_snapshot = 'representante'
          AND (
            (s.device_id IS NOT NULL AND wishlist_carrinho.device_id = s.device_id)
            OR (s.whatsapp IS NOT NULL AND regexp_replace(s.whatsapp, '[^0-9]', '', 'g') <> ''
                AND regexp_replace(wishlist_carrinho.whatsapp, '[^0-9]', '', 'g') = regexp_replace(s.whatsapp, '[^0-9]', '', 'g'))
          )
      )
    )
  )
);

-- The bucket is already private; public active PDFs/covers use the existing checked server proxy.
DROP POLICY "Leitura publica bucket catalogos" ON storage.objects;
CREATE POLICY "Catalog administrators read files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'catalogos' AND private.is_admin_or_master(auth.uid()));