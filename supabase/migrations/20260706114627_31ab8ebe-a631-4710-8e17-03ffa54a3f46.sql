
CREATE TABLE public.pre_selecoes (
  id text PRIMARY KEY,
  criado_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL,

  vendedor_login text,
  vendedor_nome text,
  atribuido_para_vendedor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  cnpj text NOT NULL,
  razao_social text NOT NULL,
  nome_fantasia text NOT NULL,
  contato_nome text NOT NULL,
  contato_cargo text,
  contato_email text NOT NULL,
  contato_whatsapp text NOT NULL,
  cidade_estado text NOT NULL,
  segmento text NOT NULL,
  observacao text,
  aceita_newsletter boolean NOT NULL DEFAULT false,

  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_itens integer NOT NULL DEFAULT 0,
  total_unidades integer NOT NULL DEFAULT 0,
  total_varejo_ref numeric(12,2) NOT NULL DEFAULT 0,

  status text NOT NULL DEFAULT 'nova',
  cliente_b2b_id uuid,
  cotacao_gerada_id text,
  pedido_gerado_id text,
  visualizado_em timestamptz,

  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pre_selecoes_vendedor_login ON public.pre_selecoes (lower(vendedor_login));
CREATE INDEX idx_pre_selecoes_status ON public.pre_selecoes (status);
CREATE INDEX idx_pre_selecoes_criado_em ON public.pre_selecoes (criado_em DESC);

GRANT INSERT ON public.pre_selecoes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pre_selecoes TO authenticated;
GRANT ALL ON public.pre_selecoes TO service_role;

ALTER TABLE public.pre_selecoes ENABLE ROW LEVEL SECURITY;

-- Qualquer visitante pode ENVIAR uma pré-seleção (não pode ler)
CREATE POLICY "Anon pode inserir pre-selecao"
  ON public.pre_selecoes FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated pode inserir pre-selecao"
  ON public.pre_selecoes FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admin/master vê tudo
CREATE POLICY "Admin/master le tudo"
  ON public.pre_selecoes FOR SELECT
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()));

CREATE POLICY "Admin/master atualiza tudo"
  ON public.pre_selecoes FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));

CREATE POLICY "Admin/master apaga tudo"
  ON public.pre_selecoes FOR DELETE
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()));

-- Vendedor dono (match por login_amigavel ou codigo_vendedor) vê / gerencia as suas
CREATE POLICY "Vendedor le suas pre-selecoes"
  ON public.pre_selecoes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          lower(p.login_amigavel) = lower(pre_selecoes.vendedor_login)
          OR lower(p.codigo_vendedor) = lower(pre_selecoes.vendedor_login)
          OR p.id = pre_selecoes.atribuido_para_vendedor_id
        )
    )
  );

CREATE POLICY "Vendedor atualiza suas pre-selecoes"
  ON public.pre_selecoes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          lower(p.login_amigavel) = lower(pre_selecoes.vendedor_login)
          OR lower(p.codigo_vendedor) = lower(pre_selecoes.vendedor_login)
          OR p.id = pre_selecoes.atribuido_para_vendedor_id
        )
    )
  );

CREATE TRIGGER trg_pre_selecoes_updated_at
  BEFORE UPDATE ON public.pre_selecoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
