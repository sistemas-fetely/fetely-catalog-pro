
CREATE TYPE public.crm_rep_grupo AS ENUM ('Produtivo','Ativação','Ultimato','Trilha separada');
CREATE TYPE public.crm_regiao AS ENUM ('Sul','Sudeste','Centro-Oeste','Nordeste','Norte','A definir');
CREATE TYPE public.crm_atividade_tipo AS ENUM ('Reunião','Visita','Ligação','E-mail ou WhatsApp');

CREATE OR REPLACE FUNCTION public.crm_is_gestao(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_or_master(_uid) OR public.has_role(_uid, 'gestao_representantes'::app_role)
$$;

CREATE TABLE public.crm_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ordem int NOT NULL,
  prazo_max_dias int,
  encerrado boolean NOT NULL DEFAULT false,
  cor text NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_stages TO authenticated;
GRANT ALL ON public.crm_stages TO service_role;
ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_stages select" ON public.crm_stages FOR SELECT TO authenticated
  USING (public.crm_is_gestao(auth.uid()) OR public.is_representante(auth.uid()));
CREATE POLICY "crm_stages gestao write" ON public.crm_stages FOR ALL TO authenticated
  USING (public.crm_is_gestao(auth.uid())) WITH CHECK (public.crm_is_gestao(auth.uid()));

INSERT INTO public.crm_stages (nome, ordem, prazo_max_dias, encerrado, cor) VALUES
 ('Primeiro contato',1,10,false,'#E6DDD2'),
 ('Aguardando data',2,15,false,'#EAC85C'),
 ('Agenda marcada',3,NULL,false,'#E87A47'),
 ('Apresentado',4,7,false,'#F5C3CF'),
 ('Em negociação',5,15,false,'#CED997'),
 ('Cadastro ou amostra',6,20,false,'#A9C08A'),
 ('Pedido fechado',7,NULL,true,'#344B3B'),
 ('Parado',8,NULL,true,'#C9BFB3'),
 ('Perdido',9,NULL,true,'#7B1523');

CREATE TABLE public.crm_rep_settings (
  representante_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  grupo public.crm_rep_grupo NOT NULL DEFAULT 'Ativação',
  regiao public.crm_regiao NOT NULL DEFAULT 'A definir',
  observacao text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_rep_settings TO authenticated;
GRANT ALL ON public.crm_rep_settings TO service_role;
ALTER TABLE public.crm_rep_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_rep_settings select" ON public.crm_rep_settings FOR SELECT TO authenticated
  USING (public.crm_is_gestao(auth.uid()) OR representante_id = auth.uid());
CREATE POLICY "crm_rep_settings gestao write" ON public.crm_rep_settings FOR ALL TO authenticated
  USING (public.crm_is_gestao(auth.uid())) WITH CHECK (public.crm_is_gestao(auth.uid()));

INSERT INTO public.crm_rep_settings (representante_id, grupo, regiao)
SELECT id, 'Ativação', 'A definir' FROM public.profiles WHERE tipo_vendedor = 'representante'
ON CONFLICT DO NOTHING;

CREATE TABLE public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  representante_id uuid NOT NULL REFERENCES public.profiles(id),
  nome_conta text NOT NULL,
  cnpj text,
  cidade text,
  uf text,
  numero_lojas int,
  tier_a boolean NOT NULL DEFAULT false,
  stage_id uuid NOT NULL REFERENCES public.crm_stages(id),
  stage_desde date NOT NULL DEFAULT current_date,
  ultima_acao text,
  proxima_acao text,
  proxima_acao_data date,
  cliente_id uuid REFERENCES public.clientes(id),
  motivo_perda text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_leads_rep_idx ON public.crm_leads(representante_id);
CREATE INDEX crm_leads_stage_idx ON public.crm_leads(stage_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_leads TO authenticated;
GRANT ALL ON public.crm_leads TO service_role;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_leads select" ON public.crm_leads FOR SELECT TO authenticated
  USING (public.crm_is_gestao(auth.uid()) OR (public.is_representante(auth.uid()) AND representante_id = auth.uid()));
CREATE POLICY "crm_leads insert" ON public.crm_leads FOR INSERT TO authenticated
  WITH CHECK (public.crm_is_gestao(auth.uid()) OR (public.is_representante(auth.uid()) AND representante_id = auth.uid()));
CREATE POLICY "crm_leads update" ON public.crm_leads FOR UPDATE TO authenticated
  USING (public.crm_is_gestao(auth.uid()) OR (public.is_representante(auth.uid()) AND representante_id = auth.uid()))
  WITH CHECK (public.crm_is_gestao(auth.uid()) OR (public.is_representante(auth.uid()) AND representante_id = auth.uid()));
CREATE POLICY "crm_leads delete" ON public.crm_leads FOR DELETE TO authenticated
  USING (public.crm_is_gestao(auth.uid()));

CREATE TABLE public.crm_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  stage_anterior_id uuid REFERENCES public.crm_stages(id),
  stage_novo_id uuid REFERENCES public.crm_stages(id),
  representante_anterior_id uuid REFERENCES public.profiles(id),
  representante_novo_id uuid REFERENCES public.profiles(id),
  alterado_em timestamptz NOT NULL DEFAULT now(),
  alterado_por uuid
);
CREATE INDEX crm_stage_history_lead_idx ON public.crm_stage_history(lead_id);
GRANT SELECT ON public.crm_stage_history TO authenticated;
GRANT ALL ON public.crm_stage_history TO service_role;
ALTER TABLE public.crm_stage_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_stage_history select" ON public.crm_stage_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.crm_leads l WHERE l.id = lead_id));

CREATE TABLE public.crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  representante_id uuid NOT NULL REFERENCES public.profiles(id),
  data date NOT NULL DEFAULT current_date,
  tipo public.crm_atividade_tipo NOT NULL,
  resultado text,
  proximo_passo text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_activities_lead_idx ON public.crm_activities(lead_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_activities TO authenticated;
GRANT ALL ON public.crm_activities TO service_role;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_activities select" ON public.crm_activities FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.crm_leads l WHERE l.id = lead_id));
CREATE POLICY "crm_activities insert" ON public.crm_activities FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.crm_leads l WHERE l.id = lead_id));
CREATE POLICY "crm_activities update" ON public.crm_activities FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.crm_leads l WHERE l.id = lead_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.crm_leads l WHERE l.id = lead_id));
CREATE POLICY "crm_activities delete" ON public.crm_activities FOR DELETE TO authenticated
  USING (public.crm_is_gestao(auth.uid()) OR created_by = auth.uid());

-- Conflitos: visíveis somente para a gestão
CREATE TABLE public.crm_lead_conflitos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  motivo text NOT NULL,
  lead_conflitante_id uuid REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  cliente_conflitante_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  representante_conflitante_id uuid REFERENCES public.profiles(id),
  resolvido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_lead_conflitos_lead_idx ON public.crm_lead_conflitos(lead_id);
GRANT SELECT, UPDATE, DELETE ON public.crm_lead_conflitos TO authenticated;
GRANT ALL ON public.crm_lead_conflitos TO service_role;
ALTER TABLE public.crm_lead_conflitos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_lead_conflitos gestao" ON public.crm_lead_conflitos FOR ALL TO authenticated
  USING (public.crm_is_gestao(auth.uid())) WITH CHECK (public.crm_is_gestao(auth.uid()));

-- Triggers
CREATE OR REPLACE FUNCTION public.crm_leads_before() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_gestao boolean := auth.uid() IS NULL OR public.crm_is_gestao(auth.uid());
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT v_gestao THEN NEW.representante_id := auth.uid(); END IF;
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
    NEW.stage_desde := COALESCE(NEW.stage_desde, current_date);
  ELSE
    IF NEW.representante_id IS DISTINCT FROM OLD.representante_id AND NOT v_gestao THEN
      RAISE EXCEPTION 'Somente a gestão pode transferir o lead para outro representante';
    END IF;
    IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN NEW.stage_desde := current_date; END IF;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER crm_leads_before BEFORE INSERT OR UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.crm_leads_before();

CREATE OR REPLACE FUNCTION public.crm_norm_nome(t text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$ SELECT lower(regexp_replace(trim(coalesce(t,'')), '\s+', ' ', 'g')) $$;

CREATE OR REPLACE FUNCTION public.crm_leads_after() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cnpj text := nullif(regexp_replace(coalesce(NEW.cnpj,''), '\D', '', 'g'), '');
        v_nome text := public.crm_norm_nome(NEW.nome_conta);
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO crm_stage_history (lead_id, stage_anterior_id, stage_novo_id, representante_novo_id, alterado_por)
    VALUES (NEW.id, NULL, NEW.stage_id, NEW.representante_id, auth.uid());
  ELSIF NEW.stage_id IS DISTINCT FROM OLD.stage_id OR NEW.representante_id IS DISTINCT FROM OLD.representante_id THEN
    INSERT INTO crm_stage_history (lead_id, stage_anterior_id, stage_novo_id, representante_anterior_id, representante_novo_id, alterado_por)
    VALUES (NEW.id, OLD.stage_id, NEW.stage_id,
            CASE WHEN NEW.representante_id IS DISTINCT FROM OLD.representante_id THEN OLD.representante_id END,
            CASE WHEN NEW.representante_id IS DISTINCT FROM OLD.representante_id THEN NEW.representante_id END,
            auth.uid());
  END IF;

  IF TG_OP = 'INSERT' OR NEW.cnpj IS DISTINCT FROM OLD.cnpj OR NEW.nome_conta IS DISTINCT FROM OLD.nome_conta
     OR NEW.representante_id IS DISTINCT FROM OLD.representante_id THEN
    DELETE FROM crm_lead_conflitos WHERE lead_id = NEW.id AND resolvido = false;
    INSERT INTO crm_lead_conflitos (lead_id, tipo, motivo, lead_conflitante_id, representante_conflitante_id)
    SELECT NEW.id, 'lead',
           CASE WHEN v_cnpj IS NOT NULL AND regexp_replace(coalesce(l.cnpj,''), '\D', '', 'g') = v_cnpj THEN 'mesmo CNPJ' ELSE 'mesmo nome' END,
           l.id, l.representante_id
    FROM crm_leads l
    WHERE l.id <> NEW.id AND l.representante_id <> NEW.representante_id
      AND ((v_cnpj IS NOT NULL AND regexp_replace(coalesce(l.cnpj,''), '\D', '', 'g') = v_cnpj)
           OR (v_nome <> '' AND public.crm_norm_nome(l.nome_conta) = v_nome));
    INSERT INTO crm_lead_conflitos (lead_id, tipo, motivo, cliente_conflitante_id, representante_conflitante_id)
    SELECT NEW.id, 'cliente',
           CASE WHEN v_cnpj IS NOT NULL AND regexp_replace(coalesce(c.cnpj,''), '\D', '', 'g') = v_cnpj THEN 'mesmo CNPJ' ELSE 'mesmo nome' END,
           c.id, c.cadastrado_por_vendedor_id
    FROM clientes c
    WHERE c.cadastrado_por_vendedor_id IS NOT NULL AND c.cadastrado_por_vendedor_id <> NEW.representante_id
      AND (NEW.cliente_id IS NULL OR c.id <> NEW.cliente_id)
      AND ((v_cnpj IS NOT NULL AND regexp_replace(coalesce(c.cnpj,''), '\D', '', 'g') = v_cnpj)
           OR (v_nome <> '' AND public.crm_norm_nome(c.razao_social) = v_nome));
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER crm_leads_after AFTER INSERT OR UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.crm_leads_after();

CREATE OR REPLACE FUNCTION public.crm_activities_before() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT representante_id INTO NEW.representante_id FROM crm_leads WHERE id = NEW.lead_id;
  IF TG_OP = 'INSERT' THEN NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  ELSE NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER crm_activities_before BEFORE INSERT OR UPDATE ON public.crm_activities
  FOR EACH ROW EXECUTE FUNCTION public.crm_activities_before();

-- Mantém representante das atividades alinhado ao lead quando a gestão transfere
CREATE OR REPLACE FUNCTION public.crm_leads_sync_activities() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.representante_id IS DISTINCT FROM OLD.representante_id THEN
    UPDATE crm_activities SET representante_id = NEW.representante_id WHERE lead_id = NEW.id;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER crm_leads_sync_activities AFTER UPDATE OF representante_id ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.crm_leads_sync_activities();

-- Novo representante ganha crm_rep_settings automaticamente
CREATE OR REPLACE FUNCTION public.crm_profiles_rep_settings() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tipo_vendedor = 'representante' THEN
    INSERT INTO crm_rep_settings (representante_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER crm_profiles_rep_settings AFTER INSERT OR UPDATE OF tipo_vendedor ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.crm_profiles_rep_settings();

-- Gestão de representantes lê clientes e pedidos vinculados a leads do CRM (políticas aditivas)
CREATE POLICY "crm gestao le clientes vinculados" ON public.clientes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'gestao_representantes'::app_role)
         AND EXISTS (SELECT 1 FROM public.crm_leads l WHERE l.cliente_id = clientes.id));
CREATE POLICY "crm gestao le pedidos vinculados" ON public.orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'gestao_representantes'::app_role)
         AND EXISTS (SELECT 1 FROM public.crm_leads l WHERE l.cliente_id = orders.cliente_id));
