ALTER TABLE public.treinamento_modulo ADD COLUMN IF NOT EXISTS categoria TEXT;
ALTER TABLE public.treinamento_aula ADD COLUMN IF NOT EXISTS secao TEXT;