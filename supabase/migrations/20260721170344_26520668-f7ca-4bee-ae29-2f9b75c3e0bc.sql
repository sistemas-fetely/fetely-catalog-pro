
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS estoque_disponivel integer NOT NULL DEFAULT 0;

ALTER TABLE public.products
  ADD CONSTRAINT products_estoque_disponivel_nonneg
  CHECK (estoque_disponivel >= 0);

-- Backfill: produtos hoje marcados como "em estoque" no texto ganham quantidade
-- alta temporária para preservar o roteamento atual até o admin ajustar na Fatia 4.
UPDATE public.products
   SET estoque_disponivel = 999999
 WHERE lower(trim(coalesce(status_estoque, ''))) = 'em estoque'
   AND estoque_disponivel = 0;

CREATE INDEX IF NOT EXISTS products_estoque_disponivel_idx
  ON public.products (estoque_disponivel)
  WHERE estoque_disponivel > 0;
