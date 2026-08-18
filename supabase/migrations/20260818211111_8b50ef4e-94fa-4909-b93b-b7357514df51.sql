-- 1) Carteira por representante: representante só vê seus próprios clientes
DROP POLICY IF EXISTS "clientes select" ON public.clientes;
CREATE POLICY "clientes select" ON public.clientes
FOR SELECT TO authenticated
USING (
  public.is_admin_or_master(auth.uid())
  OR (public.has_role(auth.uid(), 'vendedor') AND NOT public.is_representante(auth.uid()))
  OR (public.is_representante(auth.uid()) AND cadastrado_por_vendedor_id = auth.uid())
);

DROP POLICY IF EXISTS "clientes update" ON public.clientes;
CREATE POLICY "clientes update" ON public.clientes
FOR UPDATE TO authenticated
USING (
  public.is_admin_or_master(auth.uid())
  OR (public.has_role(auth.uid(), 'vendedor') AND NOT public.is_representante(auth.uid()))
  OR (public.is_representante(auth.uid()) AND cadastrado_por_vendedor_id = auth.uid())
)
WITH CHECK (
  public.is_admin_or_master(auth.uid())
  OR (public.has_role(auth.uid(), 'vendedor') AND NOT public.is_representante(auth.uid()))
  OR (public.is_representante(auth.uid()) AND cadastrado_por_vendedor_id = auth.uid())
);

-- 2) Checagem de CNPJ acima da RLS (para bloquear duplicidade sem expor dados)
CREATE OR REPLACE FUNCTION public.cliente_cnpj_status(p_cnpj text)
RETURNS TABLE(existe boolean, cliente_id uuid, razao_social text, owner_id uuid, owner_nome text, is_mine boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_digits text := regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g');
BEGIN
  IF auth.uid() IS NULL OR length(v_digits) < 11 THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, NULL::uuid, NULL::text, false;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT true,
         c.id,
         c.razao_social,
         c.cadastrado_por_vendedor_id,
         c.cadastrado_por_vendedor_nome,
         (c.cadastrado_por_vendedor_id = auth.uid())
  FROM public.clientes c
  WHERE regexp_replace(coalesce(c.cnpj, ''), '\D', '', 'g') = v_digits
  ORDER BY c.criado_em
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, NULL::uuid, NULL::text, false;
  END IF;
END;
$$;

-- 3) Solicitações de migração de carteira
CREATE TABLE IF NOT EXISTS public.cliente_migracao_solicitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  cnpj text NOT NULL,
  razao_social text,
  solicitante_id uuid NOT NULL,
  solicitante_nome text,
  owner_anterior_id uuid,
  owner_anterior_nome text,
  status text NOT NULL DEFAULT 'pendente',
  justificativa text,
  resposta text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  resolvido_em timestamptz,
  resolvido_por uuid
);

GRANT SELECT, INSERT ON public.cliente_migracao_solicitacoes TO authenticated;
GRANT ALL ON public.cliente_migracao_solicitacoes TO service_role;
ALTER TABLE public.cliente_migracao_solicitacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "migracao select" ON public.cliente_migracao_solicitacoes;
CREATE POLICY "migracao select" ON public.cliente_migracao_solicitacoes
FOR SELECT TO authenticated
USING (solicitante_id = auth.uid() OR public.is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "migracao insert" ON public.cliente_migracao_solicitacoes;
CREATE POLICY "migracao insert" ON public.cliente_migracao_solicitacoes
FOR INSERT TO authenticated
WITH CHECK (solicitante_id = auth.uid());

DROP POLICY IF EXISTS "migracao update admin" ON public.cliente_migracao_solicitacoes;
CREATE POLICY "migracao update admin" ON public.cliente_migracao_solicitacoes
FOR UPDATE TO authenticated
USING (public.is_admin_or_master(auth.uid()))
WITH CHECK (public.is_admin_or_master(auth.uid()));

-- 4) Abrir solicitação (acima da RLS para descobrir o cliente/owner)
CREATE OR REPLACE FUNCTION public.solicitar_migracao_cliente(p_cnpj text, p_justificativa text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_digits text := regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g');
  v_cliente public.clientes;
  v_nome text;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO v_cliente FROM public.clientes c
   WHERE regexp_replace(coalesce(c.cnpj, ''), '\D', '', 'g') = v_digits
   ORDER BY c.criado_em LIMIT 1;

  IF v_cliente.id IS NULL THEN
    RAISE EXCEPTION 'CNPJ nao encontrado na base';
  END IF;

  SELECT nome_completo INTO v_nome FROM public.profiles WHERE id = v_uid;

  SELECT s.id INTO v_id FROM public.cliente_migracao_solicitacoes s
   WHERE s.cliente_id = v_cliente.id AND s.solicitante_id = v_uid AND s.status = 'pendente'
   LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  INSERT INTO public.cliente_migracao_solicitacoes (
    cliente_id, cnpj, razao_social, solicitante_id, solicitante_nome,
    owner_anterior_id, owner_anterior_nome, justificativa
  ) VALUES (
    v_cliente.id, v_digits, v_cliente.razao_social, v_uid, v_nome,
    v_cliente.cadastrado_por_vendedor_id, v_cliente.cadastrado_por_vendedor_nome, p_justificativa
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 5) Resolver solicitação (somente admin/master)
CREATE OR REPLACE FUNCTION public.resolver_migracao_cliente(p_id uuid, p_aprovar boolean, p_resposta text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sol public.cliente_migracao_solicitacoes;
  v_nome text;
BEGIN
  IF NOT public.is_admin_or_master(v_uid) THEN
    RAISE EXCEPTION 'apenas admin/master pode resolver migracoes';
  END IF;

  SELECT * INTO v_sol FROM public.cliente_migracao_solicitacoes WHERE id = p_id;
  IF v_sol.id IS NULL THEN RAISE EXCEPTION 'solicitacao nao encontrada'; END IF;

  IF p_aprovar THEN
    SELECT nome_completo INTO v_nome FROM public.profiles WHERE id = v_sol.solicitante_id;
    UPDATE public.clientes
       SET cadastrado_por_vendedor_id = v_sol.solicitante_id,
           cadastrado_por_vendedor_nome = COALESCE(v_nome, v_sol.solicitante_nome, cadastrado_por_vendedor_nome),
           atualizado_em = now()
     WHERE id = v_sol.cliente_id;
  END IF;

  UPDATE public.cliente_migracao_solicitacoes
     SET status = CASE WHEN p_aprovar THEN 'aprovada' ELSE 'recusada' END,
         resposta = p_resposta,
         resolvido_em = now(),
         resolvido_por = v_uid
   WHERE id = p_id;
END;
$$;