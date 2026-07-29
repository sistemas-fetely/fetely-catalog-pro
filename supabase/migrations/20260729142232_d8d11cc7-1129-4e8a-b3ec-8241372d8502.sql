
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pronta_entrega boolean NOT NULL DEFAULT false;

UPDATE public.products SET pronta_entrega = true WHERE categoria = 'Celebrar à Mesa';

CREATE OR REPLACE FUNCTION public.products_default_pronta_entrega()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.categoria = 'Celebrar à Mesa' AND (NEW.pronta_entrega IS NULL OR NEW.pronta_entrega = false) THEN
    NEW.pronta_entrega := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_default_pronta_entrega ON public.products;
CREATE TRIGGER trg_products_default_pronta_entrega
BEFORE INSERT OR UPDATE OF categoria ON public.products
FOR EACH ROW EXECUTE FUNCTION public.products_default_pronta_entrega();
