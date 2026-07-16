
-- Helper: identifica vendedor interno
CREATE OR REPLACE FUNCTION public.is_vendedor_interno(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.user_roles r ON r.user_id = p.id
    WHERE p.id = _user_id
      AND r.role = 'vendedor'
      AND COALESCE(p.tipo_vendedor, 'interno') = 'interno'
  )
$$;

-- meta_mensal
CREATE TABLE public.meta_mensal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano integer NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  meta_global numeric NOT NULL DEFAULT 500000,
  atualizado_por uuid REFERENCES auth.users(id),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ano, mes)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_mensal TO authenticated;
GRANT ALL ON public.meta_mensal TO service_role;

ALTER TABLE public.meta_mensal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Time interno pode ver metas mensais"
  ON public.meta_mensal FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_master(auth.uid())
    OR public.is_vendedor_interno(auth.uid())
  );

CREATE POLICY "Admins podem gerenciar metas mensais"
  ON public.meta_mensal FOR ALL
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));

CREATE TRIGGER meta_mensal_set_updated
  BEFORE UPDATE ON public.meta_mensal
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- meta_vendedor
CREATE TABLE public.meta_vendedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano integer NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  vendedor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  meta numeric NOT NULL DEFAULT 0,
  atualizado_por uuid REFERENCES auth.users(id),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ano, mes, vendedor_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_vendedor TO authenticated;
GRANT ALL ON public.meta_vendedor TO service_role;

ALTER TABLE public.meta_vendedor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Time interno pode ver metas por vendedor"
  ON public.meta_vendedor FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_master(auth.uid())
    OR public.is_vendedor_interno(auth.uid())
  );

CREATE POLICY "Admins podem gerenciar metas por vendedor"
  ON public.meta_vendedor FOR ALL
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));

CREATE TRIGGER meta_vendedor_set_updated
  BEFORE UPDATE ON public.meta_vendedor
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_meta_vendedor_ano_mes ON public.meta_vendedor(ano, mes);
