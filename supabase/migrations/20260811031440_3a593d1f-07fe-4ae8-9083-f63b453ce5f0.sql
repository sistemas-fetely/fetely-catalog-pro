ALTER TABLE public.produto_grupos DROP CONSTRAINT IF EXISTS produto_grupos_nome_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_produto_grupos_nome_categoria
  ON public.produto_grupos (nome, categoria_id);