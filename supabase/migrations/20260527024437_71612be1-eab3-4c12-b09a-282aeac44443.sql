CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  cod_cadastro TEXT,
  ean TEXT,
  marca TEXT NOT NULL DEFAULT 'Fetély',
  linha TEXT,
  categoria TEXT NOT NULL,
  departamento TEXT,
  grupo TEXT NOT NULL,
  tipo TEXT,
  familia TEXT,
  colecao TEXT NOT NULL,
  sub_colecao TEXT,
  sub_colecao2 TEXT,
  cor_nome TEXT,
  cor TEXT,
  estampa TEXT,
  tamanho_numero TEXT,
  tamanho_ref TEXT,
  nome_comercial TEXT NOT NULL,
  nome_completo TEXT,
  meta_descricao TEXT,
  descricao_colecao TEXT,
  descricao_produto TEXT,
  ncm TEXT,
  cest TEXT,
  origem_fisc TEXT,
  origem_prod TEXT,
  tipo_embalagem TEXT,
  material TEXT,
  material_descritivo TEXT,
  peso_g NUMERIC NOT NULL DEFAULT 0,
  largura_cm NUMERIC NOT NULL DEFAULT 0,
  altura_cm NUMERIC NOT NULL DEFAULT 0,
  profundidade_cm NUMERIC,
  multiplos INTEGER NOT NULL DEFAULT 1,
  qtd_kit INTEGER NOT NULL DEFAULT 1,
  preco_varejo NUMERIC NOT NULL DEFAULT 0,
  preco_atacado NUMERIC NOT NULL DEFAULT 0,
  status_estoque TEXT NOT NULL DEFAULT 'em estoque',
  is_vela_numerica BOOLEAN NOT NULL DEFAULT false,
  numero_vela INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_colecao ON public.products(colecao);
CREATE INDEX idx_products_categoria ON public.products(categoria);
CREATE INDEX idx_products_grupo ON public.products(grupo);

GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view products"
ON public.products FOR SELECT
USING (true);

CREATE POLICY "Admin/master can insert products"
ON public.products FOR INSERT
WITH CHECK (is_admin_or_master(auth.uid()));

CREATE POLICY "Admin/master can update products"
ON public.products FOR UPDATE
USING (is_admin_or_master(auth.uid()));

CREATE POLICY "Admin/master can delete products"
ON public.products FOR DELETE
USING (is_admin_or_master(auth.uid()));

CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();