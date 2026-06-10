GRANT SELECT ON public.products TO anon;
CREATE POLICY "Public can view products" ON public.products FOR SELECT TO anon USING (true);