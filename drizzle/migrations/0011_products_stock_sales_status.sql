CREATE OR REPLACE FUNCTION public.products_derivar_status_por_estoque()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF lower(coalesce(NEW.status_estoque, '')) LIKE 'prev%' THEN
    RETURN NEW;
  END IF;
  IF NEW.estoque_disponivel = 0 AND lower(NEW.status_estoque) = 'em estoque' THEN
    NEW.status_estoque := 'Esgotado';
  ELSIF NEW.estoque_disponivel > 0 AND NEW.status_estoque = 'Esgotado' THEN
    NEW.status_estoque := 'em estoque';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_products_stock_sales_status
BEFORE INSERT OR UPDATE OF estoque_disponivel ON public.products
FOR EACH ROW EXECUTE FUNCTION public.products_derivar_status_por_estoque();