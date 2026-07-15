
-- =========================================================
-- Fatia 1: rastreamento de jornada de pré-seleção
-- Tabelas: link_instance, sessao_catalogo, evento_catalogo
-- FK sessao_id em pre_selecoes
-- RLS: representante vê só o seu; interno/admin vê tudo
-- =========================================================

-- 1) link_instance --------------------------------------------------
CREATE TABLE public.link_instance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  origem_id uuid NULL,                -- profile id (quando interno/representante)
  origem_login text NULL,             -- login/codigo_vendedor original (?v=)
  origem_tipo text NOT NULL DEFAULT 'generico'
    CHECK (origem_tipo IN ('representante','vendedor_interno','sdr','generico')),
  lead_contato_id uuid NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_link_instance_origem_id ON public.link_instance(origem_id);
CREATE INDEX idx_link_instance_origem_login ON public.link_instance(origem_login);

GRANT SELECT ON public.link_instance TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.link_instance TO authenticated;
GRANT ALL ON public.link_instance TO service_role;

ALTER TABLE public.link_instance ENABLE ROW LEVEL SECURITY;

-- Anon lê pelo token (necessário para o catálogo público resolver origem)
CREATE POLICY "anon pode ler link_instance"
  ON public.link_instance FOR SELECT
  TO anon USING (true);

CREATE POLICY "authenticated lê link_instance"
  ON public.link_instance FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "admin/master gerencia link_instance"
  ON public.link_instance FOR ALL
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));

-- 2) sessao_catalogo -----------------------------------------------
CREATE TABLE public.sessao_catalogo (
  id uuid PRIMARY KEY,                -- session_id gerado no cliente
  link_instance_id uuid NULL REFERENCES public.link_instance(id) ON DELETE SET NULL,
  nome text NULL,
  whatsapp text NULL,
  identificado_gate boolean NOT NULL DEFAULT false,
  cnpj text NULL,
  razao_social text NULL,
  segmento text NULL,
  valor_wishlist numeric NOT NULL DEFAULT 0,
  qtd_itens integer NOT NULL DEFAULT 0,
  estado_atual text NOT NULL DEFAULT 'acessou'
    CHECK (estado_atual IN ('acessou','montando','montagem_abandonada',
                            'formulario_aberto','formulario_abandonado',
                            'enviada','em_contato','convertida','expirada','descartada')),
  primeiro_acesso timestamptz NOT NULL DEFAULT now(),
  ultimo_evento timestamptz NOT NULL DEFAULT now(),
  ultimo_form_open timestamptz NULL,
  campos_preenchidos jsonb NULL,
  vendedor_responsavel uuid NULL,
  origem_tipo_snapshot text NULL,     -- copiado do link para RLS rápido
  origem_id_snapshot uuid NULL,
  user_agent text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessao_link ON public.sessao_catalogo(link_instance_id);
CREATE INDEX idx_sessao_estado ON public.sessao_catalogo(estado_atual);
CREATE INDEX idx_sessao_origem ON public.sessao_catalogo(origem_tipo_snapshot, origem_id_snapshot);

GRANT SELECT, INSERT, UPDATE ON public.sessao_catalogo TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessao_catalogo TO authenticated;
GRANT ALL ON public.sessao_catalogo TO service_role;

ALTER TABLE public.sessao_catalogo ENABLE ROW LEVEL SECURITY;

-- Anon: pode inserir/atualizar a própria sessão (id gerado no cliente).
-- Não damos SELECT amplo a anon.
CREATE POLICY "anon insere sessao"
  ON public.sessao_catalogo FOR INSERT
  TO anon WITH CHECK (true);

CREATE POLICY "anon atualiza sessao"
  ON public.sessao_catalogo FOR UPDATE
  TO anon USING (true) WITH CHECK (true);

-- Admin/master lê tudo
CREATE POLICY "admin lê todas sessoes"
  ON public.sessao_catalogo FOR SELECT
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()));

-- Representante: só as sessões cujo link foi originado por ele
CREATE POLICY "representante lê suas sessoes"
  ON public.sessao_catalogo FOR SELECT
  TO authenticated
  USING (
    origem_tipo_snapshot = 'representante'
    AND origem_id_snapshot = auth.uid()
  );

-- Vendedor interno / sdr: pool visível a todo authenticated não-representante
CREATE POLICY "interno lê pool"
  ON public.sessao_catalogo FOR SELECT
  TO authenticated
  USING (
    origem_tipo_snapshot IN ('vendedor_interno','sdr','generico')
  );

-- Admin/master pode atualizar (atribuir vendedor, etc)
CREATE POLICY "admin atualiza sessao"
  ON public.sessao_catalogo FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));

-- 3) evento_catalogo -----------------------------------------------
CREATE TABLE public.evento_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id uuid NOT NULL REFERENCES public.sessao_catalogo(id) ON DELETE CASCADE,
  tipo text NOT NULL
    CHECK (tipo IN ('portal_acessado','montagem_iniciada',
                    'formulario_aberto','pre_selecao_enviada',
                    'formulario_autosave')),
  valor_parcial numeric NULL,
  itens_parcial integer NULL,
  campos_preenchidos jsonb NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_evento_sessao ON public.evento_catalogo(sessao_id, criado_em DESC);
CREATE INDEX idx_evento_tipo ON public.evento_catalogo(tipo);

GRANT SELECT, INSERT ON public.evento_catalogo TO anon;
GRANT SELECT, INSERT, DELETE ON public.evento_catalogo TO authenticated;
GRANT ALL ON public.evento_catalogo TO service_role;

ALTER TABLE public.evento_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon insere evento"
  ON public.evento_catalogo FOR INSERT
  TO anon WITH CHECK (true);

-- SELECT segue a mesma lógica da sessão dona
CREATE POLICY "authenticated lê eventos das sessoes visíveis"
  ON public.evento_catalogo FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessao_catalogo s
      WHERE s.id = evento_catalogo.sessao_id
        AND (
          public.is_admin_or_master(auth.uid())
          OR (s.origem_tipo_snapshot = 'representante' AND s.origem_id_snapshot = auth.uid())
          OR s.origem_tipo_snapshot IN ('vendedor_interno','sdr','generico')
        )
    )
  );

-- 4) FK em pre_selecoes -------------------------------------------
ALTER TABLE public.pre_selecoes
  ADD COLUMN IF NOT EXISTS sessao_id uuid NULL
    REFERENCES public.sessao_catalogo(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pre_selecoes_sessao ON public.pre_selecoes(sessao_id);

-- 5) Trigger updated_at + snapshot de origem em sessao_catalogo ---
CREATE OR REPLACE FUNCTION public.sessao_catalogo_before_upsert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_origem_tipo text;
  v_origem_id uuid;
BEGIN
  NEW.updated_at := now();
  NEW.ultimo_evento := COALESCE(NEW.ultimo_evento, now());

  -- Snapshot origem a partir do link_instance (para RLS eficiente)
  IF NEW.link_instance_id IS NOT NULL THEN
    SELECT origem_tipo, origem_id
      INTO v_origem_tipo, v_origem_id
    FROM public.link_instance
    WHERE id = NEW.link_instance_id;
    NEW.origem_tipo_snapshot := COALESCE(v_origem_tipo, 'generico');
    NEW.origem_id_snapshot := v_origem_id;
  ELSE
    NEW.origem_tipo_snapshot := COALESCE(NEW.origem_tipo_snapshot, 'generico');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sessao_catalogo_before_upsert
  BEFORE INSERT OR UPDATE ON public.sessao_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.sessao_catalogo_before_upsert();

-- 6) RPC: resolver/criar link_instance a partir de ?v=<login> ------
-- Chamável por anon; identifica se o login é representante lendo profiles.
CREATE OR REPLACE FUNCTION public.ensure_link_instance_for_login(p_login text)
RETURNS TABLE(id uuid, token text, origem_tipo text, origem_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_login text := lower(trim(coalesce(p_login, '')));
  v_profile_id uuid;
  v_tipo_vendedor text;
  v_origem_tipo text;
  v_id uuid;
  v_token text;
BEGIN
  IF v_login = '' THEN
    -- Link genérico anônimo (não persiste — retorna nulo)
    RETURN;
  END IF;

  -- Tenta achar o profile pelo login_amigavel ou codigo_vendedor
  SELECT p.id, p.tipo_vendedor
    INTO v_profile_id, v_tipo_vendedor
  FROM public.profiles p
  WHERE lower(p.login_amigavel) = v_login
     OR lower(p.codigo_vendedor) = v_login
  LIMIT 1;

  v_origem_tipo := CASE
    WHEN v_tipo_vendedor = 'representante' THEN 'representante'
    WHEN v_profile_id IS NOT NULL THEN 'vendedor_interno'
    ELSE 'generico'
  END;

  -- Reusa por login (token estável: "v_" + login)
  SELECT li.id, li.token INTO v_id, v_token
  FROM public.link_instance li
  WHERE li.origem_login = v_login
  LIMIT 1;

  IF v_id IS NULL THEN
    v_token := 'v_' || v_login;
    INSERT INTO public.link_instance (token, origem_id, origem_login, origem_tipo)
    VALUES (v_token, v_profile_id, v_login, v_origem_tipo)
    RETURNING link_instance.id INTO v_id;
  ELSE
    -- Atualiza origem se mudou o tipo de vendedor
    UPDATE public.link_instance
       SET origem_id = COALESCE(v_profile_id, origem_id),
           origem_tipo = v_origem_tipo
     WHERE id = v_id
       AND (origem_tipo IS DISTINCT FROM v_origem_tipo OR origem_id IS DISTINCT FROM v_profile_id);
  END IF;

  RETURN QUERY
  SELECT v_id, v_token, v_origem_tipo, v_profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_link_instance_for_login(text) TO anon, authenticated;

-- 7) Vista com estado derivado on-read ----------------------------
-- Aplica as janelas de tempo dos estados abandonados sem precisar de cron.
CREATE OR REPLACE VIEW public.sessao_catalogo_estado AS
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
