-- 1. Remove o trigger antigo (gravava histórico direto a partir de products)
DROP TRIGGER IF EXISTS trg_products_price_history ON public.products;
DROP FUNCTION IF EXISTS public.log_product_price_change();

-- 2. Trigger BEFORE INSERT em product_prices:
--    encerra a vigência anterior do mesmo produto.
CREATE OR REPLACE FUNCTION public.close_previous_price_vigencia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ativo IS TRUE THEN
    UPDATE public.product_prices
       SET ativo = false,
           vigencia_fim = COALESCE(vigencia_fim, now())
     WHERE product_id = NEW.product_id
       AND ativo = true
       AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  END IF;
  IF NEW.vigencia_inicio IS NULL THEN
    NEW.vigencia_inicio := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_product_prices_close_previous
  BEFORE INSERT ON public.product_prices
  FOR EACH ROW EXECUTE FUNCTION public.close_previous_price_vigencia();

-- 3. Trigger AFTER INSERT em product_prices:
--    grava histórico + sincroniza products.preco_atacado/preco_varejo.
CREATE OR REPLACE FUNCTION public.sync_price_and_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_atacado numeric;
  v_old_varejo  numeric;
  v_sku text;
  v_nome text;
  v_user_id uuid;
  v_user_nome text;
BEGIN
  -- Busca preço anterior (última vigência fechada do mesmo produto)
  SELECT preco_atacado, preco_varejo
    INTO v_old_atacado, v_old_varejo
  FROM public.product_prices
  WHERE product_id = NEW.product_id
    AND id <> NEW.id
  ORDER BY vigencia_inicio DESC
  LIMIT 1;

  SELECT sku, nome_comercial INTO v_sku, v_nome
  FROM public.products WHERE id = NEW.product_id;

  v_user_id := COALESCE(NEW.criado_por_id, auth.uid());
  v_user_nome := COALESCE(NEW.criado_por_nome,
    (SELECT nome_completo FROM public.profiles WHERE id = v_user_id));

  -- Sincroniza products (espelho de leitura) — sem disparar trigger recursivo
  UPDATE public.products
     SET preco_atacado = NEW.preco_atacado,
         preco_varejo  = NEW.preco_varejo,
         updated_at    = now()
   WHERE id = NEW.product_id
     AND (preco_atacado IS DISTINCT FROM NEW.preco_atacado
       OR preco_varejo  IS DISTINCT FROM NEW.preco_varejo);

  -- Histórico
  INSERT INTO public.product_price_history(
    product_id, sku, nome_comercial,
    preco_atacado_anterior, preco_varejo_anterior,
    preco_atacado_novo, preco_varejo_novo,
    variacao_atacado_percent, variacao_varejo_percent,
    acao, alterado_por_id, alterado_por_nome, observacao
  ) VALUES (
    NEW.product_id, v_sku, v_nome,
    v_old_atacado, v_old_varejo,
    NEW.preco_atacado, NEW.preco_varejo,
    CASE WHEN COALESCE(v_old_atacado,0) = 0 THEN NULL
         ELSE ROUND(((NEW.preco_atacado - v_old_atacado) / v_old_atacado * 100)::numeric, 2) END,
    CASE WHEN COALESCE(v_old_varejo,0) = 0 THEN NULL
         ELSE ROUND(((NEW.preco_varejo - v_old_varejo) / v_old_varejo * 100)::numeric, 2) END,
    CASE WHEN v_old_atacado IS NULL THEN 'create' ELSE 'update' END,
    v_user_id, v_user_nome, NEW.observacao
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_product_prices_sync_and_history
  AFTER INSERT ON public.product_prices
  FOR EACH ROW EXECUTE FUNCTION public.sync_price_and_history();

-- 4. Trigger em products: quando alguém edita preço diretamente em products
--    (telas atuais), redireciona a alteração criando uma nova vigência em product_prices.
--    A trigger acima então sincroniza de volta o products — sem loop, pois
--    o sync só dispara UPDATE quando os valores diferem.
CREATE OR REPLACE FUNCTION public.route_product_price_to_prices_table()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_atacado numeric;
  v_active_varejo  numeric;
  v_user_id uuid;
  v_user_nome text;
BEGIN
  -- Preço ativo na tabela de preços
  SELECT preco_atacado, preco_varejo
    INTO v_active_atacado, v_active_varejo
  FROM public.product_prices
  WHERE product_id = NEW.id AND ativo = true
  ORDER BY vigencia_inicio DESC LIMIT 1;

  -- Se products mudou e diverge do preço ativo → cria nova vigência
  IF (NEW.preco_atacado IS DISTINCT FROM COALESCE(v_active_atacado, OLD.preco_atacado)
     OR NEW.preco_varejo IS DISTINCT FROM COALESCE(v_active_varejo, OLD.preco_varejo))
  THEN
    v_user_id := auth.uid();
    SELECT nome_completo INTO v_user_nome FROM public.profiles WHERE id = v_user_id;

    INSERT INTO public.product_prices(
      product_id, preco_atacado, preco_varejo,
      ativo, vigencia_inicio,
      criado_por_id, criado_por_nome
    ) VALUES (
      NEW.id, NEW.preco_atacado, NEW.preco_varejo,
      true, now(),
      v_user_id, v_user_nome
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_products_route_price
  AFTER UPDATE OF preco_atacado, preco_varejo ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.route_product_price_to_prices_table();

-- 5. Trigger em products AFTER INSERT: cria vigência inicial automaticamente
CREATE OR REPLACE FUNCTION public.create_initial_price_vigencia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_nome text;
BEGIN
  v_user_id := auth.uid();
  SELECT nome_completo INTO v_user_nome FROM public.profiles WHERE id = v_user_id;

  INSERT INTO public.product_prices(
    product_id, preco_atacado, preco_varejo,
    ativo, vigencia_inicio,
    criado_por_id, criado_por_nome, observacao
  ) VALUES (
    NEW.id, NEW.preco_atacado, NEW.preco_varejo,
    true, now(),
    v_user_id, v_user_nome, 'Cadastro inicial'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_products_initial_price
  AFTER INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.create_initial_price_vigencia();

-- 6. Backfill: cria vigência inicial para todos os produtos existentes
--    que ainda não têm linha em product_prices.
INSERT INTO public.product_prices(
  product_id, preco_atacado, preco_varejo, ativo, vigencia_inicio, observacao
)
SELECT p.id, p.preco_atacado, p.preco_varejo, true, COALESCE(p.created_at, now()),
       'Backfill inicial'
FROM public.products p
LEFT JOIN public.product_prices pp ON pp.product_id = p.id
WHERE pp.id IS NULL;
