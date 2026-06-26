
-- 1) Remove public anon SELECT on products
DROP POLICY IF EXISTS "Public can view products" ON public.products;
REVOKE SELECT ON public.products FROM anon;

-- 2) Tighten permissive RLS policies (replace WITH CHECK true)
DROP POLICY IF EXISTS "leads insert público" ON public.leads_qualificados;
CREATE POLICY "leads insert público"
  ON public.leads_qualificados
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(btrim(nome)) > 0
    AND length(btrim(whatsapp)) >= 8
  );

DROP POLICY IF EXISTS "historico insert público" ON public.lead_historico;
CREATE POLICY "historico insert público"
  ON public.lead_historico
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(btrim(descricao)) > 0
    AND EXISTS (SELECT 1 FROM public.leads_qualificados l WHERE l.id = lead_id)
  );

-- 3) Set search_path on functions missing it
ALTER FUNCTION public.set_atualizado_em() SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.sync_orders_commercial_extraidas() SET search_path = public;
ALTER FUNCTION public.sync_premissas_extraidas() SET search_path = public;
ALTER FUNCTION public.sync_representantes_from_profiles() SET search_path = public;
ALTER FUNCTION public.get_order_by_sncf_id(uuid) SET search_path = public;

-- 4) Revoke EXECUTE on SECURITY DEFINER functions from anon/authenticated/PUBLIC where not needed

-- Trigger-only functions: no client should call directly
REVOKE EXECUTE ON FUNCTION public.close_previous_price_vigencia() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_initial_price_vigencia() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_products_gate_dimensoes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.route_product_price_to_prices_table() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_price_and_history() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_profiles_regiao() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_atualizado_em() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_orders_commercial_extraidas() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_premissas_extraidas() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_representantes_from_profiles() FROM PUBLIC, anon, authenticated;

-- Server/edge-function only: never callable from client
REVOKE EXECUTE ON FUNCTION public.get_vault_secret(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_order_by_sncf_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_access_event(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- Authenticated-only RPCs/helpers: drop anon, keep authenticated
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_master(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_login() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.next_order_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.next_cotacao_id() FROM PUBLIC, anon;
