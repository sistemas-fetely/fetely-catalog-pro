ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS preco_unit_override numeric NULL,
  ADD COLUMN IF NOT EXISTS desconto_item_pct numeric NULL,
  ADD COLUMN IF NOT EXISTS justificativa_negociacao text NULL;

COMMENT ON COLUMN public.order_items.preco_unit_override IS 'Preço unitário manual definido no modo negociação. NULL = usar preco_unit_atacado (snapshot de tabela).';
COMMENT ON COLUMN public.order_items.desconto_item_pct IS 'Desconto por item aplicado no modo negociação, 0–100. NULL = sem desconto extra.';
COMMENT ON COLUMN public.order_items.justificativa_negociacao IS 'Justificativa obrigatória quando há override de preço ou desconto por item.';