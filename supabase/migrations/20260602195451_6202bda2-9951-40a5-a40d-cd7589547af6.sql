-- =============================================================================
-- V16 — Aprovação de pedidos do portal do cliente
-- =============================================================================
-- Pedidos feitos pelo perfil "cliente" entram como pendente_aprovacao e só
-- viram pedido firme / provisão após aprovação de admin/master.
-- =============================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS origem_perfil text NOT NULL DEFAULT 'vendedor',
  ADD COLUMN IF NOT EXISTS status_pedido text NOT NULL DEFAULT 'confirmado',
  ADD COLUMN IF NOT EXISTS aprovado_por_id uuid,
  ADD COLUMN IF NOT EXISTS aprovado_por_nome text,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS aprovacao_obs text,
  ADD COLUMN IF NOT EXISTS recusado_por_id uuid,
  ADD COLUMN IF NOT EXISTS recusado_por_nome text,
  ADD COLUMN IF NOT EXISTS recusado_motivo text,
  ADD COLUMN IF NOT EXISTS recusado_obs text,
  ADD COLUMN IF NOT EXISTS recusado_em timestamptz,
  ADD COLUMN IF NOT EXISTS tem_solicitacao_ajuste boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ajuste_mensagem text,
  ADD COLUMN IF NOT EXISTS historico jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Constraints de domínio
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_origem_perfil_check,
  ADD CONSTRAINT orders_origem_perfil_check
    CHECK (origem_perfil IN ('vendedor','admin','master','cliente'));

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_pedido_check,
  ADD CONSTRAINT orders_status_pedido_check
    CHECK (status_pedido IN ('pendente_aprovacao','aprovado','recusado','confirmado','convertido','cancelado'));

-- Index para listagem rápida de pendentes
CREATE INDEX IF NOT EXISTS orders_status_pedido_idx
  ON public.orders (status_pedido, created_at DESC);

-- RLS: cliente pode atualizar SEU pedido pendente (para cancelar / reenviar após ajuste)
DROP POLICY IF EXISTS "cliente pode atualizar pedido pendente" ON public.orders;
CREATE POLICY "cliente pode atualizar pedido pendente"
ON public.orders
FOR UPDATE
USING (
  status_pedido = 'pendente_aprovacao'
  AND cliente_id IN (
    SELECT p.cliente_id FROM public.profiles p
    WHERE p.id = auth.uid() AND p.cliente_id IS NOT NULL
  )
);

-- RLS: cliente pode INSERT itens em seu próprio pedido pendente
DROP POLICY IF EXISTS "cliente order_items insert pendente" ON public.order_items;
CREATE POLICY "cliente order_items insert pendente"
ON public.order_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.status_pedido = 'pendente_aprovacao'
      AND o.cliente_id IN (
        SELECT p.cliente_id FROM public.profiles p
        WHERE p.id = auth.uid() AND p.cliente_id IS NOT NULL
      )
  )
);

DROP POLICY IF EXISTS "cliente order_items delete pendente" ON public.order_items;
CREATE POLICY "cliente order_items delete pendente"
ON public.order_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.status_pedido = 'pendente_aprovacao'
      AND o.cliente_id IN (
        SELECT p.cliente_id FROM public.profiles p
        WHERE p.id = auth.uid() AND p.cliente_id IS NOT NULL
      )
  )
);

-- Cliente também precisa poder INSERIR pedido próprio (status pendente)
DROP POLICY IF EXISTS "cliente pode inserir pedido proprio" ON public.orders;
CREATE POLICY "cliente pode inserir pedido proprio"
ON public.orders
FOR INSERT
WITH CHECK (
  status_pedido = 'pendente_aprovacao'
  AND origem_perfil = 'cliente'
  AND cliente_id IN (
    SELECT p.cliente_id FROM public.profiles p
    WHERE p.id = auth.uid() AND p.cliente_id IS NOT NULL
  )
);

-- Marcar pedidos pré-existentes como confirmados de vendedor (default já cobre, mas garante)
UPDATE public.orders
SET status_pedido = COALESCE(status_pedido, 'confirmado'),
    origem_perfil = COALESCE(origem_perfil, 'vendedor')
WHERE status_pedido IS NULL OR origem_perfil IS NULL;