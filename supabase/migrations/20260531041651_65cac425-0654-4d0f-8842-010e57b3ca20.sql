-- Campos de reprovação em orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS reprovado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS reprovado_motivo text,
  ADD COLUMN IF NOT EXISTS reprovado_por_id uuid,
  ADD COLUMN IF NOT EXISTS reprovado_por_nome text;

CREATE INDEX IF NOT EXISTS idx_orders_reprovado ON public.orders (reprovado);

-- Campos de reprovação em provisoes
ALTER TABLE public.provisoes
  ADD COLUMN IF NOT EXISTS reprovado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS reprovado_motivo text,
  ADD COLUMN IF NOT EXISTS reprovado_por_id uuid,
  ADD COLUMN IF NOT EXISTS reprovado_por_nome text;

CREATE INDEX IF NOT EXISTS idx_provisoes_reprovado ON public.provisoes (reprovado);

-- Atualiza políticas de UPDATE para incluir o vendedor responsável pelo cliente
DROP POLICY IF EXISTS "orders update" ON public.orders;
CREATE POLICY "orders update"
ON public.orders
FOR UPDATE
USING (
  vendedor_id = auth.uid()
  OR is_admin_or_master(auth.uid())
  OR cliente_id IN (
    SELECT c.id FROM public.clientes c
    WHERE c.cadastrado_por_vendedor_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "provisoes update" ON public.provisoes;
CREATE POLICY "provisoes update"
ON public.provisoes
FOR UPDATE
USING (
  vendedor_id = auth.uid()
  OR is_admin_or_master(auth.uid())
  OR cliente_id IN (
    SELECT c.id FROM public.clientes c
    WHERE c.cadastrado_por_vendedor_id = auth.uid()
  )
);