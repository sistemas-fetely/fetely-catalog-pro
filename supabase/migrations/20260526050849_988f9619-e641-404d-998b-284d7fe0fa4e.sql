
-- Photos metadata table
CREATE TABLE public.photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('colecao','produto')),
  colecao text NOT NULL,
  cor text,
  url text NOT NULL,
  path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX photos_colecao_unique
  ON public.photos (colecao)
  WHERE kind = 'colecao';

CREATE UNIQUE INDEX photos_produto_unique
  ON public.photos (colecao, cor)
  WHERE kind = 'produto';

ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view photos"
  ON public.photos FOR SELECT
  USING (true);

CREATE POLICY "Admin/master can insert photos"
  ON public.photos FOR INSERT
  WITH CHECK (public.is_admin_or_master(auth.uid()));

CREATE POLICY "Admin/master can update photos"
  ON public.photos FOR UPDATE
  USING (public.is_admin_or_master(auth.uid()));

CREATE POLICY "Admin/master can delete photos"
  ON public.photos FOR DELETE
  USING (public.is_admin_or_master(auth.uid()));

CREATE TRIGGER photos_set_updated_at
  BEFORE UPDATE ON public.photos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-photos', 'product-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view product photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-photos');

CREATE POLICY "Admin/master can upload product photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-photos' AND public.is_admin_or_master(auth.uid()));

CREATE POLICY "Admin/master can update product photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'product-photos' AND public.is_admin_or_master(auth.uid()));

CREATE POLICY "Admin/master can delete product photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'product-photos' AND public.is_admin_or_master(auth.uid()));
