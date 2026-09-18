-- Permite vários clientes pessoa física (CNPJ vazio) por vendedor:
-- a unicidade passa a valer só quando existe CNPJ de fato.
ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_cnpj_cadastrado_por_vendedor_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS clientes_cnpj_vendedor_unico
  ON public.clientes (cnpj, cadastrado_por_vendedor_id)
  WHERE cnpj IS NOT NULL AND cnpj <> '';
