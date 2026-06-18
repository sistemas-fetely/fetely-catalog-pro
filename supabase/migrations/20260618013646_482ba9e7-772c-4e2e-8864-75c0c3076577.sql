
-- ============================================================
-- V19: grupos_clientes
-- ============================================================
CREATE TABLE public.grupos_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  cor text NOT NULL DEFAULT '#C9A961',
  cliente_ids uuid[] NOT NULL DEFAULT '{}',
  criado_por_vendedor_id uuid NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  ativo boolean NOT NULL DEFAULT true
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grupos_clientes TO authenticated;
GRANT ALL ON public.grupos_clientes TO service_role;

ALTER TABLE public.grupos_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grupos_select_own_or_admin"
  ON public.grupos_clientes FOR SELECT TO authenticated
  USING (criado_por_vendedor_id = auth.uid() OR public.is_admin_or_master(auth.uid()));

CREATE POLICY "grupos_insert_own"
  ON public.grupos_clientes FOR INSERT TO authenticated
  WITH CHECK (criado_por_vendedor_id = auth.uid() OR public.is_admin_or_master(auth.uid()));

CREATE POLICY "grupos_update_own_or_admin"
  ON public.grupos_clientes FOR UPDATE TO authenticated
  USING (criado_por_vendedor_id = auth.uid() OR public.is_admin_or_master(auth.uid()))
  WITH CHECK (criado_por_vendedor_id = auth.uid() OR public.is_admin_or_master(auth.uid()));

CREATE POLICY "grupos_delete_own_or_admin"
  ON public.grupos_clientes FOR DELETE TO authenticated
  USING (criado_por_vendedor_id = auth.uid() OR public.is_admin_or_master(auth.uid()));

CREATE TRIGGER set_grupos_atualizado_em
  BEFORE UPDATE ON public.grupos_clientes
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

-- ============================================================
-- V19: modelos_pedido
-- ============================================================
CREATE TABLE public.modelos_pedido (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  criado_por_vendedor_id uuid NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.modelos_pedido TO authenticated;
GRANT ALL ON public.modelos_pedido TO service_role;

ALTER TABLE public.modelos_pedido ENABLE ROW LEVEL SECURITY;

CREATE POLICY "modelos_select_own_or_admin"
  ON public.modelos_pedido FOR SELECT TO authenticated
  USING (criado_por_vendedor_id = auth.uid() OR public.is_admin_or_master(auth.uid()));

CREATE POLICY "modelos_insert_own"
  ON public.modelos_pedido FOR INSERT TO authenticated
  WITH CHECK (criado_por_vendedor_id = auth.uid() OR public.is_admin_or_master(auth.uid()));

CREATE POLICY "modelos_update_own_or_admin"
  ON public.modelos_pedido FOR UPDATE TO authenticated
  USING (criado_por_vendedor_id = auth.uid() OR public.is_admin_or_master(auth.uid()))
  WITH CHECK (criado_por_vendedor_id = auth.uid() OR public.is_admin_or_master(auth.uid()));

CREATE POLICY "modelos_delete_own_or_admin"
  ON public.modelos_pedido FOR DELETE TO authenticated
  USING (criado_por_vendedor_id = auth.uid() OR public.is_admin_or_master(auth.uid()));

CREATE TRIGGER set_modelos_atualizado_em
  BEFORE UPDATE ON public.modelos_pedido
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

-- ============================================================
-- V19: rastreabilidade em orders
-- ============================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS duplicado_de text,
  ADD COLUMN IF NOT EXISTS modelo_origem_id uuid,
  ADD COLUMN IF NOT EXISTS grupo_origem_id uuid;
