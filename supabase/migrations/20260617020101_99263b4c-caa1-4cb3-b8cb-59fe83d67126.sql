ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS categoria text;

DROP INDEX IF EXISTS public.photos_colecao_unique;

CREATE UNIQUE INDEX photos_colecao_unique
  ON public.photos (colecao, COALESCE(categoria, ''))
  WHERE kind = 'colecao';