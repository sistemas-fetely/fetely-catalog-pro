GRANT SELECT ON public.products TO anon;
CREATE POLICY "Anon can view active products" ON public.products FOR SELECT TO anon USING (ativo = true);