
-- Enum para tipo de vendedor
DO $$ BEGIN
  CREATE TYPE public.tipo_vendedor AS ENUM ('interno', 'representante');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tipo_vendedor public.tipo_vendedor,
  ADD COLUMN IF NOT EXISTS regiao text,
  ADD COLUMN IF NOT EXISTS comissao_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS cargo text,
  ADD COLUMN IF NOT EXISTS supervisor text,
  ADD COLUMN IF NOT EXISTS cnpj_cpf text,
  ADD COLUMN IF NOT EXISTS empresa text,
  ADD COLUMN IF NOT EXISTS observacoes text,
  ADD COLUMN IF NOT EXISTS login_amigavel text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_login_amigavel_unique
  ON public.profiles (lower(login_amigavel))
  WHERE login_amigavel IS NOT NULL;
