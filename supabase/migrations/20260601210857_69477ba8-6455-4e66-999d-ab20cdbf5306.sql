CREATE OR REPLACE FUNCTION public.next_order_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_num integer;
BEGIN
  SELECT COALESCE(MAX((substring(id from 'PED-(\d+)$'))::int), 999)
  INTO max_num
  FROM public.orders
  WHERE id ~ '^PED-\d+$';
  RETURN 'PED-' || (max_num + 1)::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_order_id() TO authenticated, service_role;