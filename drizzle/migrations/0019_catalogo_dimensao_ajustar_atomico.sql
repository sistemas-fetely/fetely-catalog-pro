CREATE OR REPLACE FUNCTION public.fn_catalogo_dimension_key(p_nome text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(string_agg(t, ' ' ORDER BY ord), '')
  FROM unnest(regexp_split_to_array(lower(regexp_replace(normalize(p_nome, NFD), U&'[\0300-\036f]', '', 'g')), '[^a-z0-9]+')) WITH ORDINALITY AS tokens(t, ord)
  WHERE t <> '' AND t <> 'e';
$$;
REVOKE ALL ON FUNCTION public.fn_catalogo_dimension_key(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_catalogo_dimension_key(text) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_catalogo_dimensao_renomear(p_kind text, p_id uuid, p_para text, p_cods text[], p_quem jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_table text; v_fk text; v_old text; v_categoria uuid; v_ativo boolean;
  v_actual text[]; v_expected text[]; v_destino boolean; v_n integer; v_user uuid;
BEGIN
  IF p_kind NOT IN ('grupo', 'colecao') OR p_kind IS NULL OR p_id IS NULL
     OR p_para IS NULL OR length(btrim(p_para)) NOT BETWEEN 1 AND 120
     OR p_cods IS NULL OR cardinality(p_cods) NOT BETWEEN 1 AND 2000
     OR p_quem->>'id' IS NULL OR nullif(btrim(p_quem->>'nome'), '') IS NULL THEN
    RAISE EXCEPTION 'Parâmetros de renomeação inválidos';
  END IF;
  v_table := CASE p_kind WHEN 'grupo' THEN 'produto_grupos' ELSE 'produto_colecoes' END;
  v_fk := p_kind || '_id';
  PERFORM pg_advisory_xact_lock(hashtextextended(p_kind || ':' || p_id::text, 0));
  -- Block membership changes and competing dimension creation until commit.
  LOCK TABLE public.products IN SHARE ROW EXCLUSIVE MODE;
  EXECUTE format('LOCK TABLE public.%I IN SHARE ROW EXCLUSIVE MODE', v_table);
  IF p_kind = 'grupo' THEN
    SELECT nome, categoria_id, ativo INTO v_old, v_categoria, v_ativo FROM public.produto_grupos WHERE id = p_id FOR UPDATE;
  ELSE
    SELECT nome, ativo INTO v_old, v_ativo FROM public.produto_colecoes WHERE id = p_id FOR UPDATE;
  END IF;
  IF v_old IS NULL OR v_ativo IS NOT TRUE THEN
    RETURN jsonb_build_object('renomeado', false, 'motivo', 'nao_encontrado');
  END IF;
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE public.fn_catalogo_dimension_key(nome) = public.fn_catalogo_dimension_key($1) %s)', v_table,
    CASE WHEN p_kind = 'grupo' THEN 'AND categoria_id = $2' ELSE '' END)
    INTO v_destino USING p_para, v_categoria;
  IF v_destino THEN RETURN jsonb_build_object('renomeado', false, 'motivo', 'destino_existe'); END IF;
  EXECUTE format('SELECT ARRAY(SELECT DISTINCT cod_cadastro FROM public.products WHERE %I = $1 ORDER BY cod_cadastro)', v_fk) INTO v_actual USING p_id;
  SELECT ARRAY(SELECT DISTINCT c FROM unnest(p_cods) c ORDER BY c) INTO v_expected;
  IF v_actual IS DISTINCT FROM v_expected THEN
    RETURN jsonb_build_object('renomeado', false, 'motivo', 'parcial');
  END IF;
  SELECT id INTO v_user FROM public.profiles WHERE id = (p_quem->>'id')::uuid;
  EXECUTE format('INSERT INTO public.catalog_audit (usuario_id, usuario_nome, produto_sku, produto_nome, acao, campos_alterados)
    SELECT $1, $2->>''nome'', sku, coalesce(nome_comercial, ''''), ''editado'',
      jsonb_build_object($3, jsonb_build_object(''antes'', %I, ''depois'', $4), ''origem'', ''planilha_sharepoint_renomear'', ''quem'', $2)
    FROM public.products WHERE %I = $5', p_kind, v_fk) USING v_user, p_quem, p_kind, p_para, p_id;
  EXECUTE format('UPDATE public.%I SET nome = $1 WHERE id = $2', v_table) USING p_para, p_id;
  EXECUTE format('UPDATE public.products SET %I = $1 WHERE %I = $2', p_kind, v_fk) USING p_para, p_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF p_kind = 'colecao' THEN
    UPDATE public.photos SET colecao = p_para WHERE colecao = v_old;
  END IF;
  INSERT INTO public.catalog_audit (usuario_id, usuario_nome, produto_sku, produto_nome, acao, campos_alterados)
  VALUES (v_user, p_quem->>'nome', 'dimensao:' || p_kind || ':' || p_id::text, p_kind || ': ' || p_para, 'editado',
    jsonb_build_object(p_kind, jsonb_build_object('antes', v_old, 'depois', p_para), 'origem', 'planilha_sharepoint_renomear', 'quem', p_quem));
  RETURN jsonb_build_object('renomeado', true, 'id', p_id, 'produtos', v_n);
END;
$$;
REVOKE ALL ON FUNCTION public.fn_catalogo_dimensao_renomear(text, uuid, text, text[], jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_catalogo_dimensao_renomear(text, uuid, text, text[], jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_catalogo_dimensao_inativar_se_vazio(p_kind text, p_id uuid, p_quem jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_table text; v_fk text; v_nome text; v_ativo boolean; v_used boolean; v_user uuid;
BEGIN
  IF p_kind NOT IN ('grupo', 'colecao', 'cor') OR p_kind IS NULL OR p_id IS NULL
     OR p_quem->>'id' IS NULL OR nullif(btrim(p_quem->>'nome'), '') IS NULL THEN
    RAISE EXCEPTION 'Parâmetros de inativação inválidos';
  END IF;
  v_table := CASE p_kind WHEN 'grupo' THEN 'produto_grupos' WHEN 'colecao' THEN 'produto_colecoes' ELSE 'produto_cores' END;
  v_fk := p_kind || '_id';
  PERFORM pg_advisory_xact_lock(hashtextextended(p_kind || ':' || p_id::text, 0));
  LOCK TABLE public.products IN SHARE ROW EXCLUSIVE MODE;
  EXECUTE format('LOCK TABLE public.%I IN SHARE ROW EXCLUSIVE MODE', v_table);
  EXECUTE format('SELECT nome, ativo FROM public.%I WHERE id = $1 FOR UPDATE', v_table) INTO v_nome, v_ativo USING p_id;
  IF v_nome IS NULL THEN RETURN jsonb_build_object('inativado', false, 'motivo', 'nao_encontrado'); END IF;
  IF v_ativo IS NOT TRUE THEN RETURN jsonb_build_object('inativado', false, 'motivo', 'ja_inativo'); END IF;
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.products WHERE %I = $1 %s)', v_fk,
    CASE WHEN p_kind = 'cor' THEN 'OR cor = $2' ELSE '' END) INTO v_used USING p_id, v_nome;
  IF v_used THEN RETURN jsonb_build_object('inativado', false, 'motivo', 'tem_produtos'); END IF;
  EXECUTE format('UPDATE public.%I SET ativo = false WHERE id = $1', v_table) USING p_id;
  SELECT id INTO v_user FROM public.profiles WHERE id = (p_quem->>'id')::uuid;
  INSERT INTO public.catalog_audit (usuario_id, usuario_nome, produto_sku, produto_nome, acao, campos_alterados)
  VALUES (v_user, p_quem->>'nome', 'dimensao:' || p_kind || ':' || p_id::text, p_kind || ': ' || v_nome, 'desativado',
    jsonb_build_object('ativo', jsonb_build_object('antes', true, 'depois', false), 'origem', 'planilha_sharepoint_renomear', 'quem', p_quem));
  RETURN jsonb_build_object('inativado', true, 'id', p_id);
END;
$$;
REVOKE ALL ON FUNCTION public.fn_catalogo_dimensao_inativar_se_vazio(text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_catalogo_dimensao_inativar_se_vazio(text, uuid, jsonb) TO service_role;