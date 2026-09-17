CREATE TABLE public.catalogos_pdf (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  colecao text,
  capa_url text,
  capa_path text,
  pdf_url text NOT NULL,
  pdf_path text NOT NULL,
  tamanho_bytes bigint,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  downloads integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT ON public.catalogos_pdf TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogos_pdf TO authenticated;
GRANT ALL ON public.catalogos_pdf TO service_role;

ALTER TABLE public.catalogos_pdf ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Catalogos ativos sao publicos"
ON public.catalogos_pdf FOR SELECT TO anon, authenticated
USING (ativo = true);

CREATE POLICY "Admin e master veem todos"
ON public.catalogos_pdf FOR SELECT TO authenticated
USING (public.is_admin_or_master(auth.uid()));

CREATE POLICY "Admin e master inserem"
ON public.catalogos_pdf FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_master(auth.uid()));

CREATE POLICY "Admin e master atualizam"
ON public.catalogos_pdf FOR UPDATE TO authenticated
USING (public.is_admin_or_master(auth.uid()));

CREATE POLICY "Admin e master excluem"
ON public.catalogos_pdf FOR DELETE TO authenticated
USING (public.is_admin_or_master(auth.uid()));

CREATE INDEX idx_catalogos_pdf_ordem ON public.catalogos_pdf (ordem, created_at DESC);

CREATE POLICY "Leitura publica bucket catalogos"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'catalogos');

CREATE POLICY "Admin e master enviam catalogos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'catalogos' AND public.is_admin_or_master(auth.uid()));

CREATE POLICY "Admin e master atualizam catalogos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'catalogos' AND public.is_admin_or_master(auth.uid()));

CREATE POLICY "Admin e master apagam catalogos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'catalogos' AND public.is_admin_or_master(auth.uid()));