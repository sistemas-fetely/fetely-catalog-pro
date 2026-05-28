
-- 1. PRODUCTS: restringir leitura a usuários autenticados (oculta preço de atacado do público)
DROP POLICY IF EXISTS "Anyone can view products" ON public.products;
CREATE POLICY "Authenticated can view products"
  ON public.products FOR SELECT
  TO authenticated
  USING (true);

-- 2. PHOTOS: restringir mutações a admin/master
DROP POLICY IF EXISTS "Authenticated can insert photos" ON public.photos;
DROP POLICY IF EXISTS "Authenticated can update photos" ON public.photos;
DROP POLICY IF EXISTS "Authenticated can delete photos" ON public.photos;

CREATE POLICY "Admin/master can insert photos"
  ON public.photos FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_master(auth.uid()));

CREATE POLICY "Admin/master can update photos"
  ON public.photos FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));

CREATE POLICY "Admin/master can delete photos"
  ON public.photos FOR DELETE
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()));

-- Photos SELECT continua público para permitir exibir catálogo

-- 3. STORAGE product-photos: restringir mutações a admin/master
DROP POLICY IF EXISTS "Authenticated can upload product photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update product photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete product photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view product photos" ON storage.objects;

CREATE POLICY "Admin/master can upload product photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-photos' AND public.is_admin_or_master(auth.uid()));

CREATE POLICY "Admin/master can update product photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-photos' AND public.is_admin_or_master(auth.uid()))
  WITH CHECK (bucket_id = 'product-photos' AND public.is_admin_or_master(auth.uid()));

CREATE POLICY "Admin/master can delete product photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-photos' AND public.is_admin_or_master(auth.uid()));

-- SELECT em storage.objects restrito a authenticated (impede listagem anônima do bucket).
-- Arquivos individuais continuam acessíveis via URL pública porque o bucket é público.
CREATE POLICY "Authenticated can read product photos metadata"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'product-photos');

-- 4. SECURITY DEFINER: remover EXECUTE público nas funções (continuam funcionando em RLS via privilégio do owner)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_master(uuid) FROM PUBLIC, anon, authenticated;
