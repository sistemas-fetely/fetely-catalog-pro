
-- Bonificado: campos no pedido + condicao dedicada + trigger de liberacao
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS bonificado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_bonificacao text NULL,
  ADD COLUMN IF NOT EXISTS estado_liberacao text NOT NULL DEFAULT 'aguardando_liberacao',
  ADD COLUMN IF NOT EXISTS liberado_por uuid NULL,
  ADD COLUMN IF NOT EXISTS liberado_em timestamptz NULL;

-- integridade: se bonificado, motivo obrigatorio
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_bonificado_motivo_chk;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_bonificado_motivo_chk
  CHECK (bonificado = false OR (motivo_bonificacao IS NOT NULL AND btrim(motivo_bonificacao) <> ''));

-- trigger: quando sncf_status_sync vira 'enviado', carimba estado_liberacao
CREATE OR REPLACE FUNCTION public.orders_sync_estado_liberacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sncf_status_sync = 'enviado'
     AND (TG_OP = 'INSERT' OR OLD.sncf_status_sync IS DISTINCT FROM 'enviado') THEN
    NEW.estado_liberacao := 'enviado_sncf';
    IF NEW.liberado_em IS NULL THEN
      NEW.liberado_em := COALESCE(NEW.sncf_enviado_em, now());
    END IF;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS orders_sync_estado_liberacao ON public.orders;
CREATE TRIGGER orders_sync_estado_liberacao
BEFORE INSERT OR UPDATE OF sncf_status_sync ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_sync_estado_liberacao();

-- indice para listar bonificados
CREATE INDEX IF NOT EXISTS orders_bonificado_idx ON public.orders (bonificado) WHERE bonificado = true;

-- condicao de pagamento sentinela "Pedido bonificado"
INSERT INTO public.condicoes_pagamento
  (id, descricao, valor_minimo, tipo, numero_parcelas, dias_parcelas,
   sem_juros, tem_bonus_pix, destaque, exibir_para_vendedor, ativa, ordem)
VALUES
  (999, 'Pedido bonificado', 0, 'boleto', 1, ARRAY[0]::int[],
   true, false, false, true, true, 999)
ON CONFLICT (id) DO UPDATE
  SET descricao = EXCLUDED.descricao,
      valor_minimo = 0,
      tipo = EXCLUDED.tipo,
      sem_juros = true,
      tem_bonus_pix = false,
      destaque = false,
      exibir_para_vendedor = true,
      ativa = true,
      ordem = 999;
