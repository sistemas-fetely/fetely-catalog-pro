CREATE OR REPLACE FUNCTION public.fn_products_gate_dimensoes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grupo_id     uuid;
  v_categoria    text;
  v_departamento text;
  v_colecao_id   uuid;
  v_cor_id       uuid;
BEGIN
  IF NEW.grupo IS NULL THEN
    RAISE EXCEPTION 'products: grupo nao pode ser nulo (gate de dimensao)';
  END IF;

  -- Resolve o grupo dentro da categoria informada (grupos homonimos podem
  -- existir em categorias diferentes, ex.: "Prato" em Celebrar a Mesa e em
  -- Imaginar & Celebrar). Sem categoria, cai no lookup global por nome.
  IF NEW.categoria IS NOT NULL THEN
    SELECT g.id, c.nome, d.nome
      INTO v_grupo_id, v_categoria, v_departamento
    FROM public.produto_grupos g
    JOIN public.produto_categorias c    ON c.id = g.categoria_id
    JOIN public.produto_departamentos d ON d.id = c.departamento_id
    WHERE g.nome = NEW.grupo AND c.nome = NEW.categoria;
  END IF;

  IF v_grupo_id IS NULL THEN
    SELECT g.id, c.nome, d.nome
      INTO v_grupo_id, v_categoria, v_departamento
    FROM public.produto_grupos g
    JOIN public.produto_categorias c    ON c.id = g.categoria_id
    JOIN public.produto_departamentos d ON d.id = c.departamento_id
    WHERE g.nome = NEW.grupo
    LIMIT 1;
  END IF;

  IF v_grupo_id IS NULL THEN
    RAISE EXCEPTION 'products: grupo desconhecido "%" — cadastre em produto_grupos antes (DEFAULT-DENY)', NEW.grupo;
  END IF;
  NEW.grupo_id := v_grupo_id; NEW.categoria := v_categoria; NEW.departamento := v_departamento;

  IF NEW.colecao IS NULL THEN
    RAISE EXCEPTION 'products: colecao nao pode ser nula (gate de dimensao)';
  END IF;
  SELECT id INTO v_colecao_id FROM public.produto_colecoes WHERE nome = NEW.colecao;
  IF v_colecao_id IS NULL THEN
    RAISE EXCEPTION 'products: colecao desconhecida "%" — cadastre em produto_colecoes antes (DEFAULT-DENY)', NEW.colecao;
  END IF;
  NEW.colecao_id := v_colecao_id;

  IF NEW.cor_nome IS NULL THEN
    RAISE EXCEPTION 'products: cor_nome nao pode ser nulo (gate de dimensao)';
  END IF;
  SELECT id INTO v_cor_id FROM public.produto_cores WHERE nome = NEW.cor_nome;
  IF v_cor_id IS NULL THEN
    RAISE EXCEPTION 'products: cor_nome desconhecido "%" — cadastre em produto_cores antes (DEFAULT-DENY)', NEW.cor_nome;
  END IF;
  NEW.cor_id := v_cor_id;

  RETURN NEW;
END
$$;