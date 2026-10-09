ALTER TABLE public.crm_stages ADD COLUMN IF NOT EXISTS fase text;
ALTER TABLE public.crm_stages ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

UPDATE public.crm_stages SET fase = '4', ordem = 105, prazo_max_dias = 15, encerrado = false, cor = '#F97316' WHERE nome = 'Em negociação';
INSERT INTO public.crm_stages (nome, ordem, prazo_max_dias, encerrado, cor, fase, ativo) VALUES
 ('A agendar', 101, 10, false, '#94A3B8', '0', true),
 ('Visita marcada', 102, NULL, false, '#60A5FA', '1', true),
 ('Visita feita', 103, 1, false, '#A78BFA', '2', true),
 ('Catálogo e condições', 104, 7, false, '#F59E0B', '3', true),
 ('Pedido e pagamento', 106, 10, false, '#22C55E', '5', true),
 ('Pós-venda', 107, NULL, false, '#15803D', '6', true),
 ('Não vai agora', 199, NULL, true, '#6B7280', 'X', true);

CREATE TYPE public.crm_segmento AS ENUM ('Supermercado','Hortifruti','Empório','Padaria e confeitaria','Loja de departamento','Festas','Casa & decoração','Papelaria e presentes','Buffet','Decoradora','Outro');
CREATE TYPE public.crm_em_que_pe AS ENUM ('Pediu catálogo','Pediu preço','Quer amostra','Vai levar ao comitê','Só olhou');
CREATE TYPE public.crm_classe AS ENUM ('A','B','C');
CREATE TYPE public.crm_nivel AS ENUM ('Lead','MQL','SQL','CLIENTE','NUTRIÇÃO');
CREATE TYPE public.crm_motivo_nao_agora AS ENUM ('Preço','Prazo','Sem retorno','Não é perfil','Já tem fornecedor','Migrado','Outro');
CREATE TYPE public.crm_task_tipo AS ENUM ('Ligar','Visitar','Enviar catálogo','Enviar amostra','Cobrar devolutiva','Cobrar cadastro','Cobrar pagamento','Ver gôndola','Outro');
CREATE TYPE public.crm_task_resp AS ENUM ('Representante','Gestão');
CREATE TYPE public.crm_task_status AS ENUM ('Aberta','Feita','Cancelada');

ALTER TABLE public.crm_leads
 ADD COLUMN visita_em timestamptz,
 ADD COLUMN visita_confirmada boolean NOT NULL DEFAULT false,
 ADD COLUMN segmento public.crm_segmento,
 ADD COLUMN categorias text[] NOT NULL DEFAULT '{}',
 ADD COLUMN faturamento_esperado_mes numeric,
 ADD COLUMN em_que_pe_ficou public.crm_em_que_pe,
 ADD COLUMN rede_grupo text,
 ADD COLUMN classe public.crm_classe,
 ADD COLUMN nivel public.crm_nivel,
 ADD COLUMN catalogo_enviado_em date,
 ADD COLUMN toque_d2_feito boolean NOT NULL DEFAULT false,
 ADD COLUMN toque_d5_feito boolean NOT NULL DEFAULT false,
 ADD COLUMN valor_estimado numeric,
 ADD COLUMN amostra boolean NOT NULL DEFAULT false,
 ADD COLUMN cadastro_fornecedor boolean NOT NULL DEFAULT false,
 ADD COLUMN comite boolean NOT NULL DEFAULT false,
 ADD COLUMN comissao_registrada boolean NOT NULL DEFAULT false,
 ADD COLUMN pago_em date,
 ADD COLUMN forma_pagamento text,
 ADD COLUMN foto_gondola text,
 ADD COLUMN sell_out_em date,
 ADD COLUMN motivo_nao_agora public.crm_motivo_nao_agora,
 ADD COLUMN retomar_em date,
 ADD COLUMN descobertas text,
 ADD COLUMN ultimo_toque_em date;
ALTER TABLE public.crm_leads ADD CONSTRAINT crm_leads_categorias_chk
 CHECK (categorias <@ ARRAY['Velas','Mesa posta','Festa premium','Infantil','Presentes & embalagem']::text[]);

CREATE OR REPLACE FUNCTION public.crm_calc_classe(p_lojas int, p_fat numeric, p_cnpj text)
RETURNS public.crm_classe LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN nullif(regexp_replace(coalesce(p_cnpj,''), '\D', '', 'g'), '') IS NULL THEN 'C'
    WHEN coalesce(p_lojas,0) >= 3 OR coalesce(p_fat,0) >= 5000 THEN 'A'
    WHEN coalesce(p_lojas,0) BETWEEN 1 AND 2 AND coalesce(p_fat,0) >= 1500 THEN 'B'
    ELSE 'C' END::public.crm_classe
$$;

CREATE OR REPLACE FUNCTION public.crm_leads_calc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fase text; v_ficha boolean;
BEGIN
  SELECT fase INTO v_fase FROM crm_stages WHERE id = NEW.stage_id;
  v_ficha := NEW.numero_lojas IS NOT NULL AND NEW.segmento IS NOT NULL AND NEW.faturamento_esperado_mes IS NOT NULL AND NEW.em_que_pe_ficou IS NOT NULL;
  NEW.classe := public.crm_calc_classe(NEW.numero_lojas, NEW.faturamento_esperado_mes, NEW.cnpj);
  NEW.nivel := CASE
    WHEN v_fase = 'X' THEN 'NUTRIÇÃO'
    WHEN v_fase IN ('0','1') THEN 'Lead'
    WHEN v_fase = '2' THEN CASE WHEN v_ficha THEN 'MQL' ELSE 'Lead' END
    WHEN v_fase = '3' THEN 'MQL'
    WHEN v_fase = '4' THEN 'SQL'
    WHEN v_fase = '5' THEN CASE WHEN NEW.pago_em IS NOT NULL THEN 'CLIENTE' ELSE 'SQL' END
    WHEN v_fase = '6' THEN 'CLIENTE'
    ELSE NULL END::public.crm_nivel;
  RETURN NEW;
END $$;
CREATE TRIGGER zz_crm_leads_calc BEFORE INSERT OR UPDATE ON public.crm_leads FOR EACH ROW EXECUTE FUNCTION public.crm_leads_calc();

CREATE TABLE public.crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  representante_id uuid REFERENCES public.profiles(id),
  tipo public.crm_task_tipo NOT NULL,
  descricao text,
  vence_em date NOT NULL,
  responsavel public.crm_task_resp NOT NULL DEFAULT 'Representante',
  status public.crm_task_status NOT NULL DEFAULT 'Aberta',
  feita_em timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_tasks_lead_idx ON public.crm_tasks(lead_id);
CREATE UNIQUE INDEX crm_tasks_uma_aberta ON public.crm_tasks(lead_id) WHERE status = 'Aberta';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_tasks TO authenticated;
GRANT ALL ON public.crm_tasks TO service_role;
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_tasks select" ON public.crm_tasks FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.crm_leads l WHERE l.id = crm_tasks.lead_id));
CREATE POLICY "crm_tasks insert" ON public.crm_tasks FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.crm_leads l WHERE l.id = crm_tasks.lead_id));
CREATE POLICY "crm_tasks update" ON public.crm_tasks FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.crm_leads l WHERE l.id = crm_tasks.lead_id)) WITH CHECK (EXISTS (SELECT 1 FROM public.crm_leads l WHERE l.id = crm_tasks.lead_id));
CREATE POLICY "crm_tasks delete" ON public.crm_tasks FOR DELETE TO authenticated USING (public.crm_is_gestao(auth.uid()));

CREATE OR REPLACE FUNCTION public.crm_tasks_before()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT representante_id INTO NEW.representante_id FROM crm_leads WHERE id = NEW.lead_id;
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
    IF NEW.status = 'Aberta' THEN
      UPDATE crm_tasks SET status = 'Cancelada' WHERE lead_id = NEW.lead_id AND status = 'Aberta';
    END IF;
  ELSE
    NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at;
  END IF;
  IF NEW.status = 'Feita' AND NEW.feita_em IS NULL THEN NEW.feita_em := now(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER crm_tasks_before BEFORE INSERT OR UPDATE ON public.crm_tasks FOR EACH ROW EXECUTE FUNCTION public.crm_tasks_before();

CREATE OR REPLACE FUNCTION public.crm_tasks_sync_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lead uuid := COALESCE(NEW.lead_id, OLD.lead_id); v_tipo text; v_desc text; v_vence date;
BEGIN
  SELECT tipo::text, descricao, vence_em INTO v_tipo, v_desc, v_vence FROM crm_tasks WHERE lead_id = v_lead AND status = 'Aberta' LIMIT 1;
  UPDATE crm_leads SET
    proxima_acao = CASE WHEN v_tipo IS NULL THEN NULL ELSE v_tipo || coalesce(' — ' || nullif(v_desc,''), '') END,
    proxima_acao_data = v_vence
  WHERE id = v_lead;
  RETURN NULL;
END $$;
CREATE TRIGGER crm_tasks_sync_lead AFTER INSERT OR UPDATE OR DELETE ON public.crm_tasks FOR EACH ROW EXECUTE FUNCTION public.crm_tasks_sync_lead();

CREATE TABLE public.crm_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  representante_id uuid REFERENCES public.profiles(id),
  feita_por uuid,
  iniciada_em timestamptz NOT NULL DEFAULT now(),
  concluida_em timestamptz,
  total_leads int NOT NULL DEFAULT 0,
  atualizados int NOT NULL DEFAULT 0,
  avancos int NOT NULL DEFAULT 0,
  sem_novidade int NOT NULL DEFAULT 0,
  encerrados int NOT NULL DEFAULT 0,
  lead_ids uuid[] NOT NULL DEFAULT '{}',
  salvos uuid[] NOT NULL DEFAULT '{}',
  pulados uuid[] NOT NULL DEFAULT '{}',
  filtros jsonb NOT NULL DEFAULT '{}',
  detalhes jsonb NOT NULL DEFAULT '[]'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_rounds TO authenticated;
GRANT ALL ON public.crm_rounds TO service_role;
ALTER TABLE public.crm_rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_rounds select" ON public.crm_rounds FOR SELECT TO authenticated USING (public.crm_is_gestao(auth.uid()) OR (public.is_representante(auth.uid()) AND representante_id = auth.uid()));
CREATE POLICY "crm_rounds gestao write" ON public.crm_rounds FOR ALL TO authenticated USING (public.crm_is_gestao(auth.uid())) WITH CHECK (public.crm_is_gestao(auth.uid()));

ALTER TABLE public.crm_activities ADD COLUMN round_id uuid REFERENCES public.crm_rounds(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.crm_activities_toque()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE crm_leads SET ultimo_toque_em = GREATEST(coalesce(ultimo_toque_em, NEW.data), NEW.data) WHERE id = NEW.lead_id;
  RETURN NULL;
END $$;
CREATE TRIGGER crm_activities_toque AFTER INSERT ON public.crm_activities FOR EACH ROW EXECUTE FUNCTION public.crm_activities_toque();

CREATE OR REPLACE FUNCTION public.crm_processar_retomadas()
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_x uuid; v_0 uuid; r record; n int := 0;
BEGIN
  SELECT id INTO v_x FROM crm_stages WHERE fase = 'X' AND ativo LIMIT 1;
  SELECT id INTO v_0 FROM crm_stages WHERE fase = '0' AND ativo LIMIT 1;
  FOR r IN SELECT id FROM crm_leads WHERE stage_id = v_x AND retomar_em IS NOT NULL AND retomar_em <= current_date LOOP
    PERFORM set_config('crm.evento', 'retomada automática', true);
    UPDATE crm_leads SET stage_id = v_0, retomar_em = NULL WHERE id = r.id;
    PERFORM set_config('crm.evento', '', true);
    INSERT INTO crm_tasks (lead_id, tipo, descricao, vence_em, responsavel) VALUES (r.id, 'Ligar', 'Retomar contato', current_date, 'Representante');
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.crm_processar_retomadas() TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_orders_pedido_fechado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fechado uuid; v_primeiro boolean;
BEGIN
  IF NEW.cliente_id IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO v_fechado FROM crm_stages WHERE fase = '5' AND ativo LIMIT 1;
  IF v_fechado IS NULL THEN RETURN NULL; END IF;
  v_primeiro := NOT EXISTS (SELECT 1 FROM orders o WHERE o.cliente_id = NEW.cliente_id AND o.id <> NEW.id);
  PERFORM set_config('crm.evento', 'automático: primeiro pedido', true);
  UPDATE crm_leads l SET stage_id = v_fechado, ultimo_toque_em = current_date
  WHERE l.cliente_id = NEW.cliente_id AND l.stage_id <> v_fechado
    AND l.stage_id NOT IN (SELECT id FROM crm_stages WHERE fase = '6')
    AND (v_primeiro OR l.stage_id IN (SELECT id FROM crm_stages WHERE fase = 'X' OR nome IN ('Parado','Perdido')));
  PERFORM set_config('crm.evento', '', true);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('crm.evento', '', true);
  RAISE WARNING 'crm_orders_pedido_fechado: %', SQLERRM;
  RETURN NULL;
END $$;

SELECT set_config('crm.evento', 'migração: fases da Parte 4', true);
WITH novo AS (SELECT fase, id FROM public.crm_stages WHERE ativo AND fase IS NOT NULL),
alvo AS (
  SELECT l.id AS lead_id,
    CASE s.nome
      WHEN 'Primeiro contato' THEN '0' WHEN 'Aguardando data' THEN '0'
      WHEN 'Agenda marcada' THEN '1' WHEN 'Apresentado' THEN '2'
      WHEN 'Cadastro ou amostra' THEN '4'
      WHEN 'Pedido fechado' THEN '5' WHEN 'Perdido' THEN 'X'
      WHEN 'Parado' THEN coalesce((
        SELECT CASE ps.nome WHEN 'Primeiro contato' THEN '0' WHEN 'Aguardando data' THEN '0' WHEN 'Agenda marcada' THEN '1'
          WHEN 'Apresentado' THEN '2' WHEN 'Pedido fechado' THEN '5' ELSE '4' END
        FROM public.crm_stage_history h JOIN public.crm_stages ps ON ps.id = h.stage_anterior_id
        WHERE h.lead_id = l.id AND h.stage_novo_id = l.stage_id AND h.stage_anterior_id IS NOT NULL AND h.stage_anterior_id <> h.stage_novo_id
        ORDER BY h.alterado_em DESC LIMIT 1), '4')
    END AS fase
  FROM public.crm_leads l JOIN public.crm_stages s ON s.id = l.stage_id
  WHERE s.fase IS NULL
)
UPDATE public.crm_leads l SET stage_id = novo.id,
  motivo_nao_agora = CASE WHEN alvo.fase = 'X' THEN 'Migrado'::public.crm_motivo_nao_agora ELSE l.motivo_nao_agora END
FROM alvo JOIN novo ON novo.fase = alvo.fase
WHERE l.id = alvo.lead_id;
SELECT set_config('crm.evento', '', true);

UPDATE public.crm_stages SET ativo = false WHERE fase IS NULL;
COMMENT ON COLUMN public.crm_leads.motivo_perda IS 'DEPRECATED: substituído por motivo_nao_agora (Parte 4)';
