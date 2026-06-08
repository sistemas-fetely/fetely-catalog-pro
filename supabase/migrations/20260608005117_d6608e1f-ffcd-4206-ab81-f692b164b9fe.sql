-- 1. Tabela de preços com vigência
CREATE TABLE public.product_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL,
  preco_atacado numeric NOT NULL DEFAULT 0,
  preco_varejo numeric NOT NULL DEFAULT 0,
  vigencia_inicio timestamptz NOT NULL DEFAULT now(),
  vigencia_fim timestamptz,
  ativo boolean NOT NULL DEFAULT true,
  observacao text,
  criado_por_id uuid,
  criado_por_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_prices_product_id ON public.product_prices(product_id);
CREATE INDEX idx_product_prices_vigencia ON public.product_prices(product_id, vigencia_inicio DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_prices TO authenticated;
GRANT ALL ON public.product_prices TO service_role;

ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_prices select admin" ON public.product_prices
  FOR SELECT TO authenticated USING (is_admin_or_master(auth.uid()));
CREATE POLICY "product_prices insert admin" ON public.product_prices
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_master(auth.uid()));
CREATE POLICY "product_prices update admin" ON public.product_prices
  FOR UPDATE TO authenticated USING (is_admin_or_master(auth.uid()));
CREATE POLICY "product_prices delete admin" ON public.product_prices
  FOR DELETE TO authenticated USING (is_admin_or_master(auth.uid()));

CREATE TRIGGER trg_product_prices_updated_at
  BEFORE UPDATE ON public.product_prices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Tabela de histórico (auditoria de todas as mudanças)
CREATE TABLE public.product_price_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL,
  sku text,
  nome_comercial text,
  preco_atacado_anterior numeric,
  preco_varejo_anterior numeric,
  preco_atacado_novo numeric,
  preco_varejo_novo numeric,
  variacao_atacado_percent numeric,
  variacao_varejo_percent numeric,
  acao text NOT NULL DEFAULT 'update',
  alterado_por_id uuid,
  alterado_por_nome text,
  observacao text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pph_product_id ON public.product_price_history(product_id, criado_em DESC);

GRANT SELECT, INSERT ON public.product_price_history TO authenticated;
GRANT ALL ON public.product_price_history TO service_role;

ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pph select admin" ON public.product_price_history
  FOR SELECT TO authenticated USING (is_admin_or_master(auth.uid()));
CREATE POLICY "pph insert admin" ON public.product_price_history
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_master(auth.uid()));

-- 3. Trigger: grava histórico automaticamente quando products.preco_atacado/preco_varejo muda
CREATE OR REPLACE FUNCTION public.log_product_price_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome text;
  v_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.preco_atacado IS DISTINCT FROM OLD.preco_atacado
    OR NEW.preco_varejo IS DISTINCT FROM OLD.preco_varejo
  ) THEN
    v_id := auth.uid();
    SELECT nome_completo INTO v_nome FROM public.profiles WHERE id = v_id;

    INSERT INTO public.product_price_history(
      product_id, sku, nome_comercial,
      preco_atacado_anterior, preco_varejo_anterior,
      preco_atacado_novo, preco_varejo_novo,
      variacao_atacado_percent, variacao_varejo_percent,
      acao, alterado_por_id, alterado_por_nome
    ) VALUES (
      NEW.id, NEW.sku, NEW.nome_comercial,
      OLD.preco_atacado, OLD.preco_varejo,
      NEW.preco_atacado, NEW.preco_varejo,
      CASE WHEN COALESCE(OLD.preco_atacado,0) = 0 THEN NULL
           ELSE ROUND(((NEW.preco_atacado - OLD.preco_atacado) / OLD.preco_atacado * 100)::numeric, 2) END,
      CASE WHEN COALESCE(OLD.preco_varejo,0) = 0 THEN NULL
           ELSE ROUND(((NEW.preco_varejo - OLD.preco_varejo) / OLD.preco_varejo * 100)::numeric, 2) END,
      'update', v_id, v_nome
    );
  ELSIF TG_OP = 'INSERT' THEN
    v_id := auth.uid();
    SELECT nome_completo INTO v_nome FROM public.profiles WHERE id = v_id;

    INSERT INTO public.product_price_history(
      product_id, sku, nome_comercial,
      preco_atacado_novo, preco_varejo_novo,
      acao, alterado_por_id, alterado_por_nome
    ) VALUES (
      NEW.id, NEW.sku, NEW.nome_comercial,
      NEW.preco_atacado, NEW.preco_varejo,
      'create', v_id, v_nome
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_products_price_history
  AFTER INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.log_product_price_change();
