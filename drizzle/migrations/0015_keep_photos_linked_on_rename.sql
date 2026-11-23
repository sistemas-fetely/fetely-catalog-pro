UPDATE public.photos ph SET cor = m.novo
FROM (VALUES ('Metalic Gold','Dourado'),('Metalic Silver','Prata'),('Metalic Rose Gold','Rose'),('Plain Yellow','Amarelo')) m(antigo,novo)
WHERE ph.kind='produto' AND ph.colecao='Frost Glow' AND ph.cor=m.antigo;

UPDATE public.photos ph SET cor = p.sku
FROM public.products p
WHERE ph.kind='produto' AND ph.colecao='Jingle Pop' AND p.colecao='Jingle Pop'
  AND p.sku LIKE '%/' || ph.cor;

CREATE OR REPLACE FUNCTION public.fn_photos_follow_product_rename()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.sku IS DISTINCT FROM OLD.sku AND OLD.sku IS NOT NULL AND NEW.sku IS NOT NULL THEN
    UPDATE photos SET cor = NEW.sku
     WHERE kind='produto' AND colecao = NEW.colecao AND cor = OLD.sku
       AND NOT EXISTS (SELECT 1 FROM photos x WHERE x.kind='produto' AND x.colecao=NEW.colecao AND x.cor=NEW.sku);
  END IF;
  IF NEW.cor_nome IS DISTINCT FROM OLD.cor_nome AND OLD.cor_nome IS NOT NULL AND NEW.cor_nome IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM products o WHERE o.colecao=OLD.colecao AND o.cor_nome=OLD.cor_nome AND o.id<>NEW.id) THEN
    UPDATE photos SET cor = NEW.cor_nome
     WHERE kind='produto' AND colecao = NEW.colecao AND cor = OLD.cor_nome
       AND NOT EXISTS (SELECT 1 FROM photos x WHERE x.kind='produto' AND x.colecao=NEW.colecao AND x.cor=NEW.cor_nome);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_photos_follow_product_rename ON public.products;
CREATE TRIGGER trg_photos_follow_product_rename AFTER UPDATE OF sku, cor_nome ON public.products
FOR EACH ROW EXECUTE FUNCTION public.fn_photos_follow_product_rename();