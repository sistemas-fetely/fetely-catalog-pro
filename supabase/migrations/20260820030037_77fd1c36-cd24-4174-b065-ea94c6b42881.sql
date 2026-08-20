ALTER TABLE public.leads_qualificados
  ADD COLUMN IF NOT EXISTS intencao_sequencia text,
  ADD COLUMN IF NOT EXISTS aceite_condicoes text,
  ADD COLUMN IF NOT EXISTS destaque text;

CREATE TABLE IF NOT EXISTS public.lead_form_rascunho (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id uuid NOT NULL UNIQUE,
  lead_id uuid REFERENCES public.leads_qualificados(id) ON DELETE SET NULL,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  campos_preenchidos integer NOT NULL DEFAULT 0,
  enviado boolean NOT NULL DEFAULT false,
  user_agent text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.lead_form_rascunho TO authenticated;
GRANT ALL ON public.lead_form_rascunho TO service_role;
ALTER TABLE public.lead_form_rascunho ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rascunho admin read" ON public.lead_form_rascunho;
CREATE POLICY "rascunho admin read" ON public.lead_form_rascunho
  FOR SELECT TO authenticated
  USING (public.is_admin_or_master(auth.uid()));

CREATE OR REPLACE FUNCTION public.public_upsert_lead_rascunho(
  p_sessao_id uuid,
  p_dados jsonb DEFAULT '{}'::jsonb,
  p_campos integer DEFAULT 0,
  p_user_agent text DEFAULT NULL,
  p_enviado boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_sessao_id IS NULL THEN
    RAISE EXCEPTION 'session id is required';
  END IF;

  INSERT INTO public.lead_form_rascunho (sessao_id, dados, campos_preenchidos, user_agent, enviado)
  VALUES (p_sessao_id, COALESCE(p_dados, '{}'::jsonb), GREATEST(COALESCE(p_campos, 0), 0),
          NULLIF(left(COALESCE(p_user_agent, ''), 400), ''), COALESCE(p_enviado, false))
  ON CONFLICT (sessao_id) DO UPDATE SET
    dados = EXCLUDED.dados,
    campos_preenchidos = EXCLUDED.campos_preenchidos,
    user_agent = COALESCE(EXCLUDED.user_agent, public.lead_form_rascunho.user_agent),
    enviado = public.lead_form_rascunho.enviado OR EXCLUDED.enviado,
    atualizado_em = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_upsert_lead_rascunho(uuid, jsonb, integer, text, boolean) TO anon, authenticated;