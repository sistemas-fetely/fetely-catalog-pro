
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provisoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provisao_itens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faixas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.condicoes_pagamento TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.regras_gerais TO authenticated;
GRANT SELECT, INSERT ON public.cartilhas_audit TO authenticated;
GRANT SELECT, INSERT ON public.catalog_audit TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.regioes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.representantes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comissoes TO authenticated;

GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.order_items TO service_role;
GRANT ALL ON public.clientes TO service_role;
GRANT ALL ON public.provisoes TO service_role;
GRANT ALL ON public.provisao_itens TO service_role;
GRANT ALL ON public.faixas TO service_role;
GRANT ALL ON public.condicoes_pagamento TO service_role;
GRANT ALL ON public.regras_gerais TO service_role;
GRANT ALL ON public.cartilhas_audit TO service_role;
GRANT ALL ON public.catalog_audit TO service_role;
GRANT ALL ON public.regioes TO service_role;
GRANT ALL ON public.representantes TO service_role;
GRANT ALL ON public.comissoes TO service_role;
