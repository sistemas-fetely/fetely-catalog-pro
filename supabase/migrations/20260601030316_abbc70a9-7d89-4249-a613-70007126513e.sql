
-- ============= ENUMS =============
CREATE TYPE public.lead_segmento AS ENUM (
  'lojista', 'decoradora', 'cerimonialista', 'atacadista',
  'buffet', 'influencer', 'consumidor', 'outro'
);

CREATE TYPE public.lead_potencial AS ENUM ('alto', 'medio', 'em_desenvolvimento');

CREATE TYPE public.lead_status_crm AS ENUM (
  'novo', 'em_contato', 'qualificado', 'proposta_enviada',
  'convertido', 'descartado'
);

CREATE TYPE public.lead_origem AS ENUM (
  'instagram', 'whatsapp', 'feira', 'indicacao', 'site', 'google', 'outro'
);

CREATE TYPE public.lead_frequencia AS ENUM (
  'pontual', 'mensal', 'trimestral', 'semestral', 'anual'
);

CREATE TYPE public.lead_volume_estimado AS ENUM (
  'ate_2500', '2500_10k', '10k_50k', 'acima_50k', 'nao_sei'
);

-- ============= TABELA: leads_qualificados =============
CREATE TABLE public.leads_qualificados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- formulário
  nome TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  instagram TEXT,
  email TEXT,
  cidade TEXT,
  uf TEXT,
  segmento public.lead_segmento NOT NULL DEFAULT 'outro',
  frequencia public.lead_frequencia,
  volume_estimado public.lead_volume_estimado,
  urgencia INTEGER CHECK (urgencia BETWEEN 1 AND 5),
  produtos_interesse TEXT[] NOT NULL DEFAULT '{}',
  origem public.lead_origem NOT NULL DEFAULT 'outro',
  observacoes TEXT,
  -- score
  score INTEGER NOT NULL DEFAULT 0,
  potencial public.lead_potencial NOT NULL DEFAULT 'em_desenvolvimento',
  -- crm
  status_crm public.lead_status_crm NOT NULL DEFAULT 'novo',
  responsavel_id UUID,
  responsavel_nome TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  notas_internas TEXT,
  -- vínculos
  cliente_b2b_id UUID,
  cotacao_origem_id TEXT,
  -- metadados
  ip_origem TEXT,
  user_agent TEXT
);

CREATE INDEX idx_leads_qualificados_status ON public.leads_qualificados (status_crm);
CREATE INDEX idx_leads_qualificados_segmento ON public.leads_qualificados (segmento);
CREATE INDEX idx_leads_qualificados_potencial ON public.leads_qualificados (potencial);
CREATE INDEX idx_leads_qualificados_responsavel ON public.leads_qualificados (responsavel_id);
CREATE INDEX idx_leads_qualificados_criado_em ON public.leads_qualificados (criado_em DESC);

-- GRANTS: anon pode INSERT (formulário público); admin/master via authenticated
GRANT INSERT ON public.leads_qualificados TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads_qualificados TO authenticated;
GRANT ALL ON public.leads_qualificados TO service_role;

ALTER TABLE public.leads_qualificados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads insert público"
  ON public.leads_qualificados FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "leads select admin"
  ON public.leads_qualificados FOR SELECT
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()));

CREATE POLICY "leads update admin"
  ON public.leads_qualificados FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()));

CREATE POLICY "leads delete admin"
  ON public.leads_qualificados FOR DELETE
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()));

-- trigger updated_at
CREATE TRIGGER trg_leads_qualificados_updated
  BEFORE UPDATE ON public.leads_qualificados
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

-- ============= TABELA: lead_historico =============
CREATE TABLE public.lead_historico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads_qualificados(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  usuario_id UUID,
  usuario_nome TEXT NOT NULL,
  descricao TEXT NOT NULL
);

CREATE INDEX idx_lead_historico_lead ON public.lead_historico (lead_id, criado_em DESC);

GRANT INSERT ON public.lead_historico TO anon;
GRANT SELECT, INSERT ON public.lead_historico TO authenticated;
GRANT ALL ON public.lead_historico TO service_role;

ALTER TABLE public.lead_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "historico insert público"
  ON public.lead_historico FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "historico select admin"
  ON public.lead_historico FOR SELECT
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()));

-- ============= TABELA: lead_grupos_campanha =============
CREATE TABLE public.lead_grupos_campanha (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  filtros JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_por_id UUID,
  criado_por_nome TEXT
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_grupos_campanha TO authenticated;
GRANT ALL ON public.lead_grupos_campanha TO service_role;

ALTER TABLE public.lead_grupos_campanha ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grupos admin all"
  ON public.lead_grupos_campanha FOR ALL
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));

-- ============= TABELA: lead_mensagens_wpp =============
CREATE TABLE public.lead_mensagens_wpp (
  segmento public.lead_segmento PRIMARY KEY,
  template TEXT NOT NULL DEFAULT '',
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_mensagens_wpp TO authenticated;
GRANT ALL ON public.lead_mensagens_wpp TO service_role;

ALTER TABLE public.lead_mensagens_wpp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mensagens admin all"
  ON public.lead_mensagens_wpp FOR ALL
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));

-- ============= TABELA: lead_webhooks =============
CREATE TABLE public.lead_webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  url TEXT NOT NULL,
  evento TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_webhooks TO authenticated;
GRANT ALL ON public.lead_webhooks TO service_role;

ALTER TABLE public.lead_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhooks admin all"
  ON public.lead_webhooks FOR ALL
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));
