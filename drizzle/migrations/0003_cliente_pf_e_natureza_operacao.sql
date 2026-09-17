-- Pessoa Física no cadastro de clientes (padrão continua Pessoa Jurídica)
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS tipo_pessoa TEXT NOT NULL DEFAULT 'PJ',
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS cpf_formatado TEXT,
  ADD COLUMN IF NOT EXISTS nome_completo_pf TEXT,
  ADD COLUMN IF NOT EXISTS data_nascimento DATE,
  ADD COLUMN IF NOT EXISTS ponto_referencia TEXT,
  ADD COLUMN IF NOT EXISTS tipo_endereco TEXT,
  ADD COLUMN IF NOT EXISTS observacao_entrega TEXT,
  ADD COLUMN IF NOT EXISTS social_handle TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS clientes_cpf_unico
  ON public.clientes (cpf)
  WHERE cpf IS NOT NULL AND cpf <> '';

-- Natureza da operação / entrega B2C no pedido
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS natureza_operacao TEXT NOT NULL DEFAULT 'venda',
  ADD COLUMN IF NOT EXISTS campanha TEXT,
  ADD COLUMN IF NOT EXISTS entrega_b2c BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cfop TEXT;

CREATE INDEX IF NOT EXISTS orders_entrega_b2c_idx ON public.orders (entrega_b2c) WHERE entrega_b2c;
