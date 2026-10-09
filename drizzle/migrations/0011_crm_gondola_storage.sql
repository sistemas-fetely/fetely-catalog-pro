CREATE POLICY "crm gondola select" ON storage.objects FOR SELECT TO authenticated
 USING (bucket_id = 'crm-gondola' AND EXISTS (SELECT 1 FROM public.crm_leads l WHERE l.id::text = (storage.foldername(name))[1]));
CREATE POLICY "crm gondola insert" ON storage.objects FOR INSERT TO authenticated
 WITH CHECK (bucket_id = 'crm-gondola' AND EXISTS (SELECT 1 FROM public.crm_leads l WHERE l.id::text = (storage.foldername(name))[1]));