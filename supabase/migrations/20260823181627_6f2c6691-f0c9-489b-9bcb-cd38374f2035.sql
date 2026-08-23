-- Academia Fetély — central de treinamento

CREATE TABLE public.treinamento_modulo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  capa_url text,
  ordem integer NOT NULL DEFAULT 0,
  visibilidade text NOT NULL DEFAULT 'todos' CHECK (visibilidade IN ('todos','interno')),
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','publicado')),
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.treinamento_aula (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_id uuid NOT NULL REFERENCES public.treinamento_modulo(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  ordem integer NOT NULL DEFAULT 0
);

CREATE TABLE public.treinamento_bloco (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aula_id uuid NOT NULL REFERENCES public.treinamento_aula(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('video','texto','imagem','anexo')),
  ordem integer NOT NULL DEFAULT 0,
  conteudo_texto text,
  youtube_id text,
  arquivo_url text,
  arquivo_nome text
);

CREATE TABLE public.treinamento_progresso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  aula_id uuid NOT NULL REFERENCES public.treinamento_aula(id) ON DELETE CASCADE,
  concluida boolean NOT NULL DEFAULT false,
  concluida_em timestamptz,
  UNIQUE (user_id, aula_id)
);

CREATE INDEX idx_treinamento_aula_modulo ON public.treinamento_aula (modulo_id, ordem);
CREATE INDEX idx_treinamento_bloco_aula ON public.treinamento_bloco (aula_id, ordem);
CREATE INDEX idx_treinamento_progresso_user ON public.treinamento_progresso (user_id);

-- GRANTs (obrigatório para a Data API)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treinamento_modulo TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treinamento_aula TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treinamento_bloco TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treinamento_progresso TO authenticated;
GRANT ALL ON public.treinamento_modulo TO service_role;
GRANT ALL ON public.treinamento_aula TO service_role;
GRANT ALL ON public.treinamento_bloco TO service_role;
GRANT ALL ON public.treinamento_progresso TO service_role;

ALTER TABLE public.treinamento_modulo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treinamento_aula ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treinamento_bloco ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treinamento_progresso ENABLE ROW LEVEL SECURITY;

-- Leitura de módulo: admin/master tudo; vendedor (interno ou rep) só publicados;
-- visibilidade 'interno' some para representante. Cliente (portal) não vê nada.
CREATE POLICY treinamento_modulo_select ON public.treinamento_modulo
  FOR SELECT TO authenticated USING (
    public.is_admin_or_master(auth.uid())
    OR (
      public.has_role(auth.uid(), 'vendedor')
      AND status = 'publicado'
      AND (visibilidade = 'todos' OR NOT public.is_representante(auth.uid()))
    )
  );

CREATE POLICY treinamento_modulo_admin_all ON public.treinamento_modulo
  FOR ALL TO authenticated
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));

CREATE POLICY treinamento_aula_select ON public.treinamento_aula
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.treinamento_modulo m
      WHERE m.id = modulo_id
        AND (
          public.is_admin_or_master(auth.uid())
          OR (
            public.has_role(auth.uid(), 'vendedor')
            AND m.status = 'publicado'
            AND (m.visibilidade = 'todos' OR NOT public.is_representante(auth.uid()))
          )
        )
    )
  );

CREATE POLICY treinamento_aula_admin_all ON public.treinamento_aula
  FOR ALL TO authenticated
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));

CREATE POLICY treinamento_bloco_select ON public.treinamento_bloco
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.treinamento_aula a
      JOIN public.treinamento_modulo m ON m.id = a.modulo_id
      WHERE a.id = aula_id
        AND (
          public.is_admin_or_master(auth.uid())
          OR (
            public.has_role(auth.uid(), 'vendedor')
            AND m.status = 'publicado'
            AND (m.visibilidade = 'todos' OR NOT public.is_representante(auth.uid()))
          )
        )
    )
  );

CREATE POLICY treinamento_bloco_admin_all ON public.treinamento_bloco
  FOR ALL TO authenticated
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));

-- Progresso: cada usuário gerencia o próprio; admin/master leem tudo (relatórios).
CREATE POLICY treinamento_progresso_own ON public.treinamento_progresso
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY treinamento_progresso_admin_read ON public.treinamento_progresso
  FOR SELECT TO authenticated
  USING (public.is_admin_or_master(auth.uid()));

-- Storage do bucket 'academia' (privado): leitura para time interno,
-- escrita somente admin/master.
CREATE POLICY academia_storage_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'academia'
    AND (public.is_admin_or_master(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'))
  );

CREATE POLICY academia_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'academia' AND public.is_admin_or_master(auth.uid()));

CREATE POLICY academia_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'academia' AND public.is_admin_or_master(auth.uid()));

CREATE POLICY academia_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'academia' AND public.is_admin_or_master(auth.uid()));