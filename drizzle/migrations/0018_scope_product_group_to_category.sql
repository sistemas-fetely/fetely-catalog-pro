CREATE OR REPLACE FUNCTION public.fn_products_gate_dimensoes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
-- GATE CIENTE DE FASE (10/09/2026, decisao Flavio · projeto-modulo-produto-v1).
-- Antes recusava NULL sempre, o que contradizia a matriz produto_fase_ficha: ela promete que o
-- produto NASCE so com identidade (cod_cadastro, sku, ean, marca) e ganha classificacao na
-- PRE-VENDA. O importador de PI em lote foi o primeiro a bater nisso — a tela nunca expos porque
-- humano digita tudo de uma vez.
-- REGRA: na fase REGISTRADO (cartorio), classificacao pode ser nula. A partir de PRE-VENDA e'
-- obrigatoria. Valor INFORMADO continua DEFAULT-DENY em qualquer fase: nome que nao existe na
-- dimensao e' recusado. Quem cobra a presenca por fase e' trg_products_gate_fase.
declare
  v_grupo_id uuid; v_categoria text; v_departamento text;
  v_colecao_id uuid; v_cor_id uuid;
  v_nascendo boolean;
  v_grupo_count bigint;
begin
  v_nascendo := coalesce(new.fase, 'registrado') = 'registrado';

  if new.grupo is null then
    if not v_nascendo then
      raise exception 'products: grupo nao pode ser nulo fora da fase registrado (gate de dimensao)';
    end if;
    new.grupo_id := null; new.categoria := null; new.departamento := null;
  else
    if new.categoria is not null then
      select g.id, c.nome, d.nome into v_grupo_id, v_categoria, v_departamento
      from produto_grupos g
      join produto_categorias c on c.id = g.categoria_id
      join produto_departamentos d on d.id = c.departamento_id
      where g.nome = new.grupo and c.nome = new.categoria;
      if v_grupo_id is null then
        raise exception 'products: grupo "%" não existe na categoria "%" — cadastre o grupo nessa categoria (DEFAULT-DENY)', new.grupo, new.categoria;
      end if;
    else
      select count(*) into v_grupo_count
      from produto_grupos g
      where g.nome = new.grupo;
      if v_grupo_count > 1 then
        raise exception 'products: grupo "%" existe em mais de uma categoria — informe a categoria', new.grupo;
      end if;
      if v_grupo_count = 1 then
        select g.id, c.nome, d.nome into v_grupo_id, v_categoria, v_departamento
        from produto_grupos g
        join produto_categorias c on c.id = g.categoria_id
        join produto_departamentos d on d.id = c.departamento_id
        where g.nome = new.grupo;
      end if;
    end if;
    if v_grupo_id is null then
      raise exception 'products: grupo desconhecido "%" — cadastre em produto_grupos antes (DEFAULT-DENY)', new.grupo;
    end if;
    new.grupo_id := v_grupo_id; new.categoria := v_categoria; new.departamento := v_departamento;
  end if;

  if new.colecao is null then
    if not v_nascendo then
      raise exception 'products: colecao nao pode ser nula fora da fase registrado (gate de dimensao)';
    end if;
    new.colecao_id := null;
  else
    select id into v_colecao_id from produto_colecoes where nome = new.colecao;
    if v_colecao_id is null then
      raise exception 'products: colecao desconhecida "%" — cadastre em produto_colecoes antes (DEFAULT-DENY)', new.colecao;
    end if;
    new.colecao_id := v_colecao_id;
  end if;

  if new.cor_nome is null then
    if not v_nascendo then
      raise exception 'products: cor_nome nao pode ser nulo fora da fase registrado (gate de dimensao)';
    end if;
    new.cor_id := null;
  else
    select id into v_cor_id from produto_cores where nome = new.cor_nome;
    if v_cor_id is null then
      raise exception 'products: cor_nome desconhecido "%" — cadastre em produto_cores antes (DEFAULT-DENY)', new.cor_nome;
    end if;
    new.cor_id := v_cor_id;
  end if;

  return new;
end
$function$;