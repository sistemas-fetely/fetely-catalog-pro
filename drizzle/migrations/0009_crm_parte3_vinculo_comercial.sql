ALTER TABLE public.crm_stage_history ADD COLUMN IF NOT EXISTS evento text;

-- Gestão lê cotações dos clientes vinculados a leads (espelha a política de pedidos).
CREATE POLICY "crm gestao le cotacoes vinculadas" ON public.cotacoes FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'gestao_representantes'::app_role) AND EXISTS (SELECT 1 FROM public.crm_leads l WHERE l.cliente_id = cotacoes.cliente_id));

CREATE OR REPLACE FUNCTION public.crm_leads_before()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
  IF NOT v_gestao AND NEW.cliente_id IS DISTINCT FROM (CASE WHEN TG_OP = 'UPDATE' THEN OLD.cliente_id END) THEN
    IF NEW.cliente_id IS NULL THEN
      RAISE EXCEPTION 'Somente a gestão pode desfazer o vínculo com o cliente';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM clientes c WHERE c.id = NEW.cliente_id AND c.cadastrado_por_vendedor_id = auth.uid()) THEN
      RAISE EXCEPTION 'Este CNPJ já está em outra carteira. A gestão foi avisada.';
    END IF;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.crm_leads_after()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_cnpj text := nullif(regexp_replace(coalesce(NEW.cnpj,''), '\D', '', 'g'), '');
        v_nome text := public.crm_norm_nome(NEW.nome_conta);
        v_evento text := nullif(current_setting('crm.evento', true), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO crm_stage_history (lead_id, stage_anterior_id, stage_novo_id, representante_novo_id, alterado_por, evento)
    VALUES (NEW.id, NULL, NEW.stage_id, NEW.representante_id, auth.uid(), v_evento);
  ELSIF NEW.stage_id IS DISTINCT FROM OLD.stage_id OR NEW.representante_id IS DISTINCT FROM OLD.representante_id THEN
    INSERT INTO crm_stage_history (lead_id, stage_anterior_id, stage_novo_id, representante_anterior_id, representante_novo_id, alterado_por, evento)
    VALUES (NEW.id, OLD.stage_id, NEW.stage_id,
            CASE WHEN NEW.representante_id IS DISTINCT FROM OLD.representante_id THEN OLD.representante_id END,
            CASE WHEN NEW.representante_id IS DISTINCT FROM OLD.representante_id THEN NEW.representante_id END,
            auth.uid(), v_evento);
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.cliente_id IS DISTINCT FROM OLD.cliente_id THEN
    INSERT INTO crm_stage_history (lead_id, stage_anterior_id, stage_novo_id, alterado_por, evento)
    VALUES (NEW.id, NEW.stage_id, NEW.stage_id, auth.uid(),
            CASE WHEN NEW.cliente_id IS NULL THEN 'vínculo com cliente desfeito' ELSE 'cliente vinculado' END);
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
END $function$;

-- Representante tentou vincular CNPJ de outra carteira: registra conflito (só a gestão vê).
-- Não lê pedidos nem cotações; só verifica a carteira do CNPJ.
CREATE OR REPLACE FUNCTION public.crm_reportar_conflito_cnpj(p_lead_id uuid, p_cnpj text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_digits text := regexp_replace(coalesce(p_cnpj,''), '\D', '', 'g');
        v_lead crm_leads%ROWTYPE; v_cli clientes%ROWTYPE;
BEGIN
  SELECT * INTO v_lead FROM crm_leads WHERE id = p_lead_id;
  IF NOT FOUND OR NOT (public.crm_is_gestao(auth.uid()) OR v_lead.representante_id = auth.uid()) THEN RETURN false; END IF;
  IF length(v_digits) < 11 THEN RETURN false; END IF;
  SELECT * INTO v_cli FROM clientes c WHERE regexp_replace(coalesce(c.cnpj,''), '\D', '', 'g') = v_digits ORDER BY c.criado_em LIMIT 1;
  IF NOT FOUND OR v_cli.cadastrado_por_vendedor_id IS NOT DISTINCT FROM v_lead.representante_id THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM crm_lead_conflitos WHERE lead_id = p_lead_id AND cliente_conflitante_id = v_cli.id AND resolvido = false) THEN
    INSERT INTO crm_lead_conflitos (lead_id, tipo, motivo, cliente_conflitante_id, representante_conflitante_id)
    VALUES (p_lead_id, 'cliente', 'vínculo bloqueado: CNPJ de outra carteira', v_cli.id, v_cli.cadastrado_por_vendedor_id);
  END IF;
  RETURN true;
END $function$;
REVOKE ALL ON FUNCTION public.crm_reportar_conflito_cnpj(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.crm_reportar_conflito_cnpj(uuid, text) TO authenticated;

-- Automação: pedido novo de cliente vinculado move o lead para "Pedido fechado". Não altera o pedido.
CREATE OR REPLACE FUNCTION public.crm_orders_pedido_fechado()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_fechado uuid; v_primeiro boolean;
BEGIN
  IF NEW.cliente_id IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO v_fechado FROM crm_stages WHERE nome = 'Pedido fechado' LIMIT 1;
  IF v_fechado IS NULL THEN RETURN NULL; END IF;
  v_primeiro := NOT EXISTS (SELECT 1 FROM orders o WHERE o.cliente_id = NEW.cliente_id AND o.id <> NEW.id);
  PERFORM set_config('crm.evento', 'automático: primeiro pedido', true);
  UPDATE crm_leads l SET stage_id = v_fechado
  WHERE l.cliente_id = NEW.cliente_id AND l.stage_id <> v_fechado
    AND (v_primeiro OR l.stage_id IN (SELECT id FROM crm_stages WHERE nome IN ('Parado','Perdido')));
  PERFORM set_config('crm.evento', '', true);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('crm.evento', '', true);
  RAISE WARNING 'crm_orders_pedido_fechado: %', SQLERRM;
  RETURN NULL;
END $function$;
DROP TRIGGER IF EXISTS trg_crm_orders_pedido_fechado ON public.orders;
CREATE TRIGGER trg_crm_orders_pedido_fechado AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.crm_orders_pedido_fechado();