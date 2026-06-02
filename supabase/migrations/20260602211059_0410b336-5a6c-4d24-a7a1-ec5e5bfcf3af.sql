-- Permitir que cliente edite suas próprias cotações (abertas ou em negociação)
CREATE POLICY "cliente atualiza sua cotacao"
ON public.cotacoes
FOR UPDATE
TO authenticated
USING (
  cliente_id IN (
    SELECT p.cliente_id FROM public.profiles p
    WHERE p.id = auth.uid() AND p.cliente_id IS NOT NULL
  )
  AND status IN ('aberta', 'em_negociacao')
);