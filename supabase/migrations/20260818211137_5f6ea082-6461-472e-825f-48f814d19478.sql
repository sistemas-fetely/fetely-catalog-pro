REVOKE EXECUTE ON FUNCTION public.cliente_cnpj_status(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.solicitar_migracao_cliente(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolver_migracao_cliente(uuid, boolean, text) FROM anon;