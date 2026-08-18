CREATE TABLE public.wishlist_carrinho (
  chave text PRIMARY KEY,
  itens jsonb NOT NULL DEFAULT '{}'::jsonb,
  nome text,
  whatsapp text,
  device_id text,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wishlist_carrinho TO authenticated;
GRANT ALL ON public.wishlist_carrinho TO service_role;

ALTER TABLE public.wishlist_carrinho ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe pode ver carrinhos salvos"
ON public.wishlist_carrinho FOR SELECT TO authenticated
USING (true);

CREATE OR REPLACE FUNCTION public.public_save_wishlist(
  p_chave text,
  p_itens jsonb,
  p_nome text DEFAULT NULL,
  p_whatsapp text DEFAULT NULL,
  p_device_id text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_chave IS NULL OR length(trim(p_chave)) = 0 THEN
    RAISE EXCEPTION 'chave is required';
  END IF;

  INSERT INTO public.wishlist_carrinho (chave, itens, nome, whatsapp, device_id, atualizado_em)
  VALUES (
    left(trim(p_chave), 120),
    COALESCE(p_itens, '{}'::jsonb),
    NULLIF(left(COALESCE(p_nome, ''), 160), ''),
    NULLIF(left(COALESCE(p_whatsapp, ''), 40), ''),
    NULLIF(left(COALESCE(p_device_id, ''), 80), ''),
    now()
  )
  ON CONFLICT (chave) DO UPDATE SET
    itens = EXCLUDED.itens,
    nome = COALESCE(EXCLUDED.nome, public.wishlist_carrinho.nome),
    whatsapp = COALESCE(EXCLUDED.whatsapp, public.wishlist_carrinho.whatsapp),
    device_id = COALESCE(EXCLUDED.device_id, public.wishlist_carrinho.device_id),
    atualizado_em = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.public_get_wishlist(p_chave text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT itens FROM public.wishlist_carrinho WHERE chave = left(trim(p_chave), 120)),
    '{}'::jsonb
  );
$$;

GRANT EXECUTE ON FUNCTION public.public_save_wishlist(text, jsonb, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_get_wishlist(text) TO anon, authenticated;