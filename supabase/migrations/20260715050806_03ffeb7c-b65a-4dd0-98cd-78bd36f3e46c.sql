
-- =========================================================
-- 1) feature_flags
-- =========================================================
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key        text PRIMARY KEY,
  enabled    boolean NOT NULL DEFAULT false,
  value      jsonb NOT NULL DEFAULT '{}'::jsonb,
  descricao  text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.feature_flags TO anon;
GRANT SELECT ON public.feature_flags TO authenticated;
GRANT ALL    ON public.feature_flags TO service_role;

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer um lê flags públicas"
  ON public.feature_flags FOR SELECT
  USING (true);

CREATE POLICY "Admin/master escreve flags"
  ON public.feature_flags FOR ALL
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));

CREATE OR REPLACE FUNCTION public.feature_flags_touch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_feature_flags_touch ON public.feature_flags;
CREATE TRIGGER trg_feature_flags_touch
BEFORE INSERT OR UPDATE ON public.feature_flags
FOR EACH ROW EXECUTE FUNCTION public.feature_flags_touch();

INSERT INTO public.feature_flags (key, enabled, descricao)
VALUES ('GATE_ENTRADA_ATIVO', true, 'Exige nome + WhatsApp antes do catálogo público')
ON CONFLICT (key) DO NOTHING;

-- =========================================================
-- 2) Pool interno em pre_selecoes
-- =========================================================
DROP POLICY IF EXISTS "Vendedor le suas pre-selecoes" ON public.pre_selecoes;
CREATE POLICY "Vendedor le suas pre-selecoes"
  ON public.pre_selecoes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          lower(p.login_amigavel) = lower(pre_selecoes.vendedor_login)
          OR lower(p.codigo_vendedor) = lower(pre_selecoes.vendedor_login)
          OR p.id = pre_selecoes.atribuido_para_vendedor_id
          OR (
            pre_selecoes.atribuido_para_vendedor_id IS NULL
            AND p.tipo_vendedor::text IN ('vendedor_interno','sdr','admin_op')
            AND (
              pre_selecoes.vendedor_login IS NULL
              OR NOT EXISTS (
                SELECT 1 FROM public.profiles p2
                WHERE (lower(p2.login_amigavel) = lower(pre_selecoes.vendedor_login)
                    OR lower(p2.codigo_vendedor) = lower(pre_selecoes.vendedor_login))
                  AND p2.tipo_vendedor::text = 'representante'
              )
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS "Vendedor atualiza suas pre-selecoes" ON public.pre_selecoes;
CREATE POLICY "Vendedor atualiza suas pre-selecoes"
  ON public.pre_selecoes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          lower(p.login_amigavel) = lower(pre_selecoes.vendedor_login)
          OR lower(p.codigo_vendedor) = lower(pre_selecoes.vendedor_login)
          OR p.id = pre_selecoes.atribuido_para_vendedor_id
          OR (
            pre_selecoes.atribuido_para_vendedor_id IS NULL
            AND p.tipo_vendedor::text IN ('vendedor_interno','sdr','admin_op')
            AND (
              pre_selecoes.vendedor_login IS NULL
              OR NOT EXISTS (
                SELECT 1 FROM public.profiles p2
                WHERE (lower(p2.login_amigavel) = lower(pre_selecoes.vendedor_login)
                    OR lower(p2.codigo_vendedor) = lower(pre_selecoes.vendedor_login))
                  AND p2.tipo_vendedor::text = 'representante'
              )
            )
          )
        )
    )
  );

-- =========================================================
-- 3) claim_pre_selecao — atribuição atômica
-- =========================================================
CREATE OR REPLACE FUNCTION public.claim_pre_selecao(p_id text)
RETURNS TABLE (id text, atribuido_para_vendedor_id uuid, atribuido boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.pre_selecoes ps
     SET atribuido_para_vendedor_id = v_uid,
         updated_at = now()
   WHERE ps.id = p_id
     AND ps.atribuido_para_vendedor_id IS NULL;

  RETURN QUERY
    SELECT ps.id,
           ps.atribuido_para_vendedor_id,
           (ps.atribuido_para_vendedor_id = v_uid)
      FROM public.pre_selecoes ps
     WHERE ps.id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_pre_selecao(text) TO authenticated;

-- =========================================================
-- 4) View de métricas A/B do gate (14 dias)
-- =========================================================
CREATE OR REPLACE VIEW public.gate_ab_metrics AS
WITH janela AS (
  SELECT * FROM public.sessao_catalogo
   WHERE primeiro_acesso >= now() - interval '14 days'
),
por_variante AS (
  SELECT
    CASE WHEN identificado_gate IS TRUE THEN 'com_gate' ELSE 'sem_gate' END AS variante,
    COUNT(*)::int                                                          AS sessoes,
    COUNT(*) FILTER (WHERE qtd_itens > 0)::int                              AS montaram,
    COUNT(*) FILTER (WHERE estado_atual = 'enviada')::int                   AS enviaram,
    COALESCE(SUM(valor_wishlist) FILTER (WHERE estado_atual = 'enviada'), 0) AS valor_enviado
  FROM janela
  GROUP BY 1
)
SELECT
  variante,
  sessoes,
  montaram,
  enviaram,
  valor_enviado,
  CASE WHEN sessoes  > 0 THEN ROUND(100.0 * montaram / sessoes, 1) ELSE 0 END AS taxa_montagem,
  CASE WHEN montaram > 0 THEN ROUND(100.0 * enviaram / montaram, 1) ELSE 0 END AS taxa_envio,
  CASE WHEN sessoes  > 0 THEN ROUND(100.0 * enviaram / sessoes, 1) ELSE 0 END AS conv_total
FROM por_variante;

GRANT SELECT ON public.gate_ab_metrics TO authenticated;
