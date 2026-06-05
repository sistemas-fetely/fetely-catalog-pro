CREATE OR REPLACE FUNCTION public.next_order_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  max_num bigint;
  next_num bigint;
BEGIN
  -- Considera apenas IDs sequenciais (até 6 dígitos), ignorando IDs antigos baseados em timestamp
  SELECT COALESCE(MAX((substring(id from 'PED-(\d+)$'))::bigint), 1999)
  INTO max_num
  FROM public.orders
  WHERE id ~ '^PED-\d{1,6}$';

  IF max_num < 1999 THEN
    max_num := 1999;
  END IF;

  next_num := max_num + 1;

  -- Garante que o piso seja 2000
  IF next_num < 2000 THEN
    next_num := 2000;
  END IF;

  RETURN 'PED-' || next_num::text;
END;
$$;