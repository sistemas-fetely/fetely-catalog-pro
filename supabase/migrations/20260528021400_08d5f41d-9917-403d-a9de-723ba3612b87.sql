
DROP POLICY IF EXISTS "Admin/master can upload product photos" ON storage.objects;
DROP POLICY IF EXISTS "Admin/master can update product photos" ON storage.objects;
DROP POLICY IF EXISTS "Admin/master can delete product photos" ON storage.objects;

CREATE POLICY "Authenticated can upload product photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-photos');

CREATE POLICY "Authenticated can update product photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-photos');

CREATE POLICY "Authenticated can delete product photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-photos');

-- Also relax photos table policies if they exist with admin-only restriction
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='photos'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.photos', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "Public can view photos" ON public.photos FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert photos" ON public.photos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update photos" ON public.photos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete photos" ON public.photos FOR DELETE TO authenticated USING (true);
