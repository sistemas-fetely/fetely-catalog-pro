ALTER TABLE public.pre_selecoes ADD COLUMN preferencias_sugestao jsonb;
CREATE FUNCTION public.public_ranking_vendas() RETURNS TABLE(sku text,colecao text,grupo text,categoria text,pedidos_distintos bigint,clientes_distintos bigint,unidades_vendidas bigint,receita numeric,caixas_medias_por_pedido numeric,score_popularidade numeric,score_recencia numeric,participacao_receita_grupo numeric) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
WITH vendas AS (
 SELECT p.sku,p.colecao,p.grupo,p.categoria,count(DISTINCT o.id) pedidos,count(DISTINCT o.cliente_id) clientes,sum(i.quantity)::bigint unidades,sum(coalesce(i.preco_unit_override,i.preco_unit_atacado,0)*i.quantity) receita,
 sum(i.quantity::numeric/greatest(coalesce(p.multiplos,1),1))/greatest(count(DISTINCT o.id),1) caixas,
 sum(i.quantity * CASE WHEN o.created_at >= now()-interval '90 days' THEN 3 ELSE 1 END)::numeric peso,
 coalesce(sum(i.quantity) FILTER (WHERE o.created_at >= now()-interval '90 days'),0)::numeric/greatest(sum(i.quantity),1)*100 recencia
 FROM public.orders o JOIN public.order_items i ON i.order_id=o.id JOIN public.products p ON p.id=i.product_id OR (i.product_id IS NULL AND p.sku=i.sku)
 WHERE coalesce(o.reprovado,false)=false AND i.quantity>0 GROUP BY p.sku,p.colecao,p.grupo,p.categoria
)
SELECT sku,colecao,grupo,categoria,pedidos,clientes,unidades,receita,caixas,100*peso/greatest(max(peso) OVER (),1),recencia,
 sum(receita) OVER (PARTITION BY categoria,grupo)/greatest(sum(receita) OVER (),1) FROM vendas ORDER BY peso DESC,sku;
$$;
REVOKE ALL ON FUNCTION public.public_ranking_vendas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_ranking_vendas() TO anon,authenticated,service_role;
CREATE FUNCTION public.public_afinidade_colecoes() RETURNS TABLE(colecao_a text,grupo_a text,colecao_b text,grupo_b text,pedidos_juntos bigint,score_afinidade numeric) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
WITH presencas AS (SELECT DISTINCT o.id,p.colecao,p.grupo FROM public.orders o JOIN public.order_items i ON i.order_id=o.id JOIN public.products p ON p.id=i.product_id OR (i.product_id IS NULL AND p.sku=i.sku) WHERE coalesce(o.reprovado,false)=false AND i.quantity>0 AND p.colecao IS NOT NULL), pares AS (
SELECT a.colecao ca,a.grupo ga,b.colecao cb,b.grupo gb,count(*) n FROM presencas a JOIN presencas b ON a.id=b.id AND (a.colecao,a.grupo)<(b.colecao,b.grupo) GROUP BY a.colecao,a.grupo,b.colecao,b.grupo)
SELECT ca,ga,cb,gb,n,100*n::numeric/greatest(max(n) OVER (),1) FROM pares ORDER BY n DESC,ca,ga,cb,gb LIMIT 200;
$$;
REVOKE ALL ON FUNCTION public.public_afinidade_colecoes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_afinidade_colecoes() TO anon,authenticated,service_role;
CREATE FUNCTION public.public_catalogo_sugestao() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
SELECT coalesce(jsonb_agg(jsonb_build_object('sku',sku,'codCadastro',cod_cadastro,'nomeComercial',nome_comercial,'colecao',colecao,'grupo',grupo,'categoria',categoria,'corNome',cor_nome,'cor',cor,'tamanhoNumero',tamanho_numero,'multiplos',multiplos,'precoAtacado',preco_atacado,'statusEstoque',status_estoque,'prontaEntrega',pronta_entrega,'isVelaNumerica',is_vela_numerica,'numeroVela',numero_vela,'ativo',ativo) ORDER BY sku),'[]'::jsonb) FROM public.products WHERE ativo=true AND preco_atacado>0 AND coalesce(status_estoque,'') <> 'Esgotado';
$$;
REVOKE ALL ON FUNCTION public.public_catalogo_sugestao() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_catalogo_sugestao() TO anon,authenticated,service_role;
CREATE FUNCTION public.public_faixas_sugestao() RETURNS TABLE(nome text,valor_min numeric,valor_max numeric,desconto_celebra numeric,frete text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT nome,valor_min,valor_max,desconto_celebra,frete::text FROM public.faixas WHERE ativa=true AND nome IN ('Convidado','Anfitrião','Celebrante','Cerimônia') ORDER BY valor_min; $$;
REVOKE ALL ON FUNCTION public.public_faixas_sugestao() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_faixas_sugestao() TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.public_emit_evento_catalogo(p_sessao_id uuid,p_tipo text,p_valor_parcial numeric DEFAULT NULL,p_itens_parcial integer DEFAULT NULL,p_campos_preenchidos jsonb DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF p_sessao_id IS NULL THEN RAISE EXCEPTION 'session id is required'; END IF;
 IF p_tipo NOT IN ('portal_acessado','montagem_iniciada','formulario_aberto','pre_selecao_enviada','formulario_autosave','sugestao_aberta','sugestao_gerada','sugestao_aplicada') THEN RAISE EXCEPTION 'invalid event type'; END IF;
 INSERT INTO public.evento_catalogo(sessao_id,tipo,valor_parcial,itens_parcial,campos_preenchidos) VALUES(p_sessao_id,p_tipo,CASE WHEN p_valor_parcial IS NULL THEN NULL ELSE greatest(p_valor_parcial,0) END,CASE WHEN p_itens_parcial IS NULL THEN NULL ELSE greatest(p_itens_parcial,0) END,p_campos_preenchidos);
END; $$;