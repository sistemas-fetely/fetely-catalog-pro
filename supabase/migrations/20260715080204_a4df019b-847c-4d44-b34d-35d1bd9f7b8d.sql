CREATE OR REPLACE FUNCTION public.public_upsert_sessao_catalogo(
  p_id uuid,
  p_patch jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link_instance_id uuid := NULL;
  v_estado text := NULLIF(p_patch->>'estado_atual', '');
  v_identificado boolean := CASE
    WHEN p_patch ? 'identificado_gate' THEN COALESCE((p_patch->>'identificado_gate')::boolean, false)
    ELSE NULL
  END;
  v_valor numeric := CASE
    WHEN p_patch ? 'valor_wishlist' THEN GREATEST(COALESCE((p_patch->>'valor_wishlist')::numeric, 0), 0)
    ELSE NULL
  END;
  v_qtd integer := CASE
    WHEN p_patch ? 'qtd_itens' THEN GREATEST(COALESCE((p_patch->>'qtd_itens')::integer, 0), 0)
    ELSE NULL
  END;
  v_ultimo_form_open timestamptz := CASE
    WHEN p_patch ? 'ultimo_form_open' AND NULLIF(p_patch->>'ultimo_form_open', '') IS NOT NULL THEN (p_patch->>'ultimo_form_open')::timestamptz
    ELSE NULL
  END;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'session id is required';
  END IF;

  IF p_patch ? 'link_instance_id' AND NULLIF(p_patch->>'link_instance_id', '') IS NOT NULL THEN
    v_link_instance_id := (p_patch->>'link_instance_id')::uuid;
  END IF;

  IF v_estado IS NOT NULL AND v_estado NOT IN (
    'acessou','montando','montagem_abandonada','formulario_aberto','formulario_abandonado',
    'enviada','em_contato','convertida','expirada','descartada'
  ) THEN
    RAISE EXCEPTION 'invalid session state';
  END IF;

  INSERT INTO public.sessao_catalogo (
    id,
    link_instance_id,
    nome,
    whatsapp,
    identificado_gate,
    cnpj,
    razao_social,
    segmento,
    valor_wishlist,
    qtd_itens,
    estado_atual,
    ultimo_evento,
    ultimo_form_open,
    campos_preenchidos,
    user_agent
  ) VALUES (
    p_id,
    v_link_instance_id,
    NULLIF(LEFT(COALESCE(p_patch->>'nome', ''), 160), ''),
    NULLIF(LEFT(COALESCE(p_patch->>'whatsapp', ''), 40), ''),
    COALESCE(v_identificado, false),
    NULLIF(LEFT(COALESCE(p_patch->>'cnpj', ''), 32), ''),
    NULLIF(LEFT(COALESCE(p_patch->>'razao_social', ''), 240), ''),
    NULLIF(LEFT(COALESCE(p_patch->>'segmento', ''), 80), ''),
    COALESCE(v_valor, 0),
    COALESCE(v_qtd, 0),
    COALESCE(v_estado, 'acessou'),
    now(),
    v_ultimo_form_open,
    CASE WHEN p_patch ? 'campos_preenchidos' THEN p_patch->'campos_preenchidos' ELSE NULL END,
    NULLIF(LEFT(COALESCE(p_patch->>'user_agent', ''), 400), '')
  )
  ON CONFLICT (id) DO UPDATE SET
    link_instance_id = COALESCE(EXCLUDED.link_instance_id, sessao_catalogo.link_instance_id),
    nome = COALESCE(EXCLUDED.nome, sessao_catalogo.nome),
    whatsapp = COALESCE(EXCLUDED.whatsapp, sessao_catalogo.whatsapp),
    identificado_gate = CASE
      WHEN p_patch ? 'identificado_gate' THEN EXCLUDED.identificado_gate
      ELSE sessao_catalogo.identificado_gate
    END,
    cnpj = COALESCE(EXCLUDED.cnpj, sessao_catalogo.cnpj),
    razao_social = COALESCE(EXCLUDED.razao_social, sessao_catalogo.razao_social),
    segmento = COALESCE(EXCLUDED.segmento, sessao_catalogo.segmento),
    valor_wishlist = CASE WHEN p_patch ? 'valor_wishlist' THEN EXCLUDED.valor_wishlist ELSE sessao_catalogo.valor_wishlist END,
    qtd_itens = CASE WHEN p_patch ? 'qtd_itens' THEN EXCLUDED.qtd_itens ELSE sessao_catalogo.qtd_itens END,
    estado_atual = COALESCE(EXCLUDED.estado_atual, sessao_catalogo.estado_atual),
    ultimo_evento = now(),
    ultimo_form_open = CASE WHEN p_patch ? 'ultimo_form_open' THEN EXCLUDED.ultimo_form_open ELSE sessao_catalogo.ultimo_form_open END,
    campos_preenchidos = CASE WHEN p_patch ? 'campos_preenchidos' THEN EXCLUDED.campos_preenchidos ELSE sessao_catalogo.campos_preenchidos END,
    user_agent = COALESCE(EXCLUDED.user_agent, sessao_catalogo.user_agent);
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_upsert_sessao_catalogo(uuid, jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.public_emit_evento_catalogo(
  p_sessao_id uuid,
  p_tipo text,
  p_valor_parcial numeric DEFAULT NULL,
  p_itens_parcial integer DEFAULT NULL,
  p_campos_preenchidos jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_sessao_id IS NULL THEN
    RAISE EXCEPTION 'session id is required';
  END IF;

  IF p_tipo NOT IN ('portal_acessado','montagem_iniciada','formulario_aberto','pre_selecao_enviada','formulario_autosave') THEN
    RAISE EXCEPTION 'invalid event type';
  END IF;

  INSERT INTO public.evento_catalogo (
    sessao_id,
    tipo,
    valor_parcial,
    itens_parcial,
    campos_preenchidos
  ) VALUES (
    p_sessao_id,
    p_tipo,
    CASE WHEN p_valor_parcial IS NULL THEN NULL ELSE GREATEST(p_valor_parcial, 0) END,
    CASE WHEN p_itens_parcial IS NULL THEN NULL ELSE GREATEST(p_itens_parcial, 0) END,
    p_campos_preenchidos
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_emit_evento_catalogo(uuid, text, numeric, integer, jsonb) TO anon, authenticated;