ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS is_internacional boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pais text,
  ADD COLUMN IF NOT EXISTS documento_tipo text,
  ADD COLUMN IF NOT EXISTS documento_numero text;