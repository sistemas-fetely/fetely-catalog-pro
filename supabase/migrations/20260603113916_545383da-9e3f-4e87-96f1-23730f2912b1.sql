CREATE OR REPLACE FUNCTION public.next_order_id()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  max_num integer;
BEGIN
  SELECT COALESCE(MAX((substring(id from 'PED-(\d+)$'))::int), 1999)
  INTO max_num
  FROM public.orders
  WHERE id ~ '^PED-\d+$';
  IF max_num < 1999 THEN
    max_num := 1999;
  END IF;
  RETURN 'PED-' || (max_num + 1)::text;
END;
$function$;