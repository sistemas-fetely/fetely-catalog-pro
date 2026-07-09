
CREATE OR REPLACE FUNCTION public.next_pre_selecao_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_num integer;
BEGIN
  SELECT COALESCE(MAX((substring(id from 'PS(\d+)$'))::int), 0)
  INTO max_num
  FROM public.pre_selecoes
  WHERE id ~ '^PS\d+$';
  RETURN 'PS' || lpad((max_num + 1)::text, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_pre_selecao_id() TO anon, authenticated, service_role;
