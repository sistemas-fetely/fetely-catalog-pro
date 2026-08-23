ALTER TABLE public.treinamento_bloco ADD COLUMN IF NOT EXISTS faq_conhecimento text;

CREATE TABLE public.faq_conhecimento (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  conteudo text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faq_conhecimento TO authenticated;
GRANT ALL ON public.faq_conhecimento TO service_role;
ALTER TABLE public.faq_conhecimento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gerenciam base do FAQ"
  ON public.faq_conhecimento FOR ALL TO authenticated
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));

CREATE TRIGGER set_faq_conhecimento_atualizado_em
  BEFORE UPDATE ON public.faq_conhecimento
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

ALTER TABLE public.kb_chunk ALTER COLUMN modulo_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.match_kb_chunks(p_embedding vector, p_limit integer DEFAULT 8, p_ver_interno boolean DEFAULT false)
 RETURNS TABLE(id uuid, origem_tipo text, modulo_id uuid, aula_id uuid, bloco_id uuid, texto text, timestamp_video text, similaridade double precision)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.id, c.origem_tipo, c.modulo_id, c.aula_id, c.bloco_id, c.texto,
         c.timestamp_video,
         1 - (c.embedding <=> p_embedding) as similaridade
  from public.kb_chunk c
  left join public.treinamento_modulo m on m.id = c.modulo_id
  where c.embedding is not null
    and (
      c.modulo_id is null
      or (m.status = 'publicado' and (p_ver_interno or m.visibilidade = 'todos'))
    )
  order by c.embedding <=> p_embedding
  limit p_limit;
$function$;