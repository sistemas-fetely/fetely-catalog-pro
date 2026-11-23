ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS cod_cadastros text[];
CREATE INDEX IF NOT EXISTS photos_cod_cadastros_gin ON public.photos USING gin (cod_cadastros);

CREATE OR REPLACE FUNCTION public.fn_photos_resolver_cods()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kind = 'produto' AND NEW.cor IS NOT NULL AND (NEW.cod_cadastros IS NULL OR cardinality(NEW.cod_cadastros) = 0) THEN
    SELECT array_agg(DISTINCT p.cod_cadastro) INTO NEW.cod_cadastros
    FROM public.products p
    WHERE p.cod_cadastro IS NOT NULL AND p.cod_cadastro <> ''
      AND lower(trim(p.colecao)) = lower(trim(NEW.colecao))
      AND (p.sku = NEW.cor
           OR lower(trim(coalesce(p.cor_nome, p.cor))) = lower(trim(NEW.cor))
           OR lower(trim(p.cor)) = lower(trim(NEW.cor)));
    IF NEW.cod_cadastros IS NULL AND position('/' in NEW.cor) > 0 THEN
      NEW.cod_cadastros := ARRAY[split_part(NEW.cor, '/', 2)];
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_photos_resolver_cods ON public.photos;
CREATE TRIGGER trg_photos_resolver_cods BEFORE INSERT OR UPDATE OF cor, colecao ON public.photos
FOR EACH ROW EXECUTE FUNCTION public.fn_photos_resolver_cods();

UPDATE public.photos ph SET cod_cadastros = sub.cods
FROM (
  SELECT ph2.id, array_agg(DISTINCT p.cod_cadastro) cods
  FROM public.photos ph2 JOIN public.products p
    ON lower(trim(p.colecao)) = lower(trim(ph2.colecao))
   AND (p.sku = ph2.cor OR lower(trim(coalesce(p.cor_nome,p.cor))) = lower(trim(ph2.cor)) OR lower(trim(p.cor)) = lower(trim(ph2.cor)))
  WHERE ph2.kind='produto' AND p.cod_cadastro IS NOT NULL AND p.cod_cadastro <> ''
  GROUP BY ph2.id
) sub WHERE ph.id = sub.id;

UPDATE public.photos SET cod_cadastros = ARRAY[split_part(cor,'/',2)]
WHERE kind='produto' AND cod_cadastros IS NULL AND position('/' in cor) > 0;