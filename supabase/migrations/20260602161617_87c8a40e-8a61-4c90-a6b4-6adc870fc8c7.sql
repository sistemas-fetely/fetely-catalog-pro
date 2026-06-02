CREATE TABLE public.cotacoes (
  id text PRIMARY KEY,
  vendedor_id uuid NOT NULL,
  vendedor_nome text NOT NULL,
  vendedor_login text,
  cliente_id uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  valido_ate timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'aberta',
  total numeric NOT NULL DEFAULT 0,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  commercial jsonb,
  pedido_convertido_id text,
  motivo_perda text,
  motivo_perda_obs text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cotacoes TO authenticated;
GRANT ALL ON public.cotacoes TO service_role;

ALTER TABLE public.cotacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cotacoes select" ON public.cotacoes FOR SELECT
USING (
  vendedor_id = auth.uid()
  OR is_admin_or_master(auth.uid())
  OR cliente_id IN (SELECT p.cliente_id FROM public.profiles p WHERE p.id = auth.uid() AND p.cliente_id IS NOT NULL)
  OR cliente_id IN (SELECT c.id FROM public.clientes c WHERE c.cadastrado_por_vendedor_id = auth.uid())
);

CREATE POLICY "cotacoes insert" ON public.cotacoes FOR INSERT
WITH CHECK (vendedor_id = auth.uid() OR is_admin_or_master(auth.uid()));

CREATE POLICY "cotacoes update" ON public.cotacoes FOR UPDATE
USING (
  vendedor_id = auth.uid()
  OR is_admin_or_master(auth.uid())
  OR cliente_id IN (SELECT c.id FROM public.clientes c WHERE c.cadastrado_por_vendedor_id = auth.uid())
);

CREATE POLICY "cotacoes delete" ON public.cotacoes FOR DELETE
USING (is_admin_or_master(auth.uid()));

CREATE INDEX idx_cotacoes_vendedor ON public.cotacoes(vendedor_id);
CREATE INDEX idx_cotacoes_cliente ON public.cotacoes(cliente_id);
CREATE INDEX idx_cotacoes_status ON public.cotacoes(status);

CREATE OR REPLACE FUNCTION public.next_cotacao_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_num integer;
BEGIN
  SELECT COALESCE(MAX((substring(id from 'C(\d+)$'))::int), 0)
  INTO max_num
  FROM public.cotacoes
  WHERE id ~ '^C\d+$';
  RETURN 'C' || lpad((max_num + 1)::text, 4, '0');
END;
$$;