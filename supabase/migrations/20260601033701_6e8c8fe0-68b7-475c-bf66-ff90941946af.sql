ALTER TABLE public.leads_qualificados ADD COLUMN IF NOT EXISTS catalogo_liberado boolean NOT NULL DEFAULT false;

-- Grant access so authenticated users (admins) can update this field
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads_qualificados TO authenticated;
GRANT ALL ON public.leads_qualificados TO service_role;