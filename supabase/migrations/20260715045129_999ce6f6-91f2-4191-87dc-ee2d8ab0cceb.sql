
DROP VIEW IF EXISTS public.sessao_catalogo_estado;

CREATE VIEW public.sessao_catalogo_estado
WITH (security_invoker = true) AS
SELECT
  s.*,
  CASE
    WHEN s.estado_atual IN ('enviada','em_contato','convertida','expirada','descartada')
      THEN s.estado_atual
    WHEN s.ultimo_form_open IS NOT NULL
     AND (now() - s.ultimo_form_open) > interval '30 minutes'
      THEN 'formulario_abandonado'
    WHEN s.estado_atual = 'formulario_aberto'
      THEN 'formulario_aberto'
    WHEN s.qtd_itens > 0
     AND (now() - s.ultimo_evento) > interval '24 hours'
      THEN 'montagem_abandonada'
    WHEN s.qtd_itens > 0
     AND (now() - s.ultimo_evento) <= interval '15 minutes'
      THEN 'montando'
    WHEN s.qtd_itens > 0
      THEN 'montagem_abandonada'
    ELSE 'acessou'
  END AS estado_derivado
FROM public.sessao_catalogo s;

GRANT SELECT ON public.sessao_catalogo_estado TO authenticated;
GRANT ALL ON public.sessao_catalogo_estado TO service_role;
