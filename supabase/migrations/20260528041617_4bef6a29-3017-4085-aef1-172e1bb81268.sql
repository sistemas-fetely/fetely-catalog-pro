REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_master(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_master(uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_master(uuid) TO authenticated;

DROP POLICY IF EXISTS "Admin/master can insert products" ON public.products;
DROP POLICY IF EXISTS "Admin/master can update products" ON public.products;
DROP POLICY IF EXISTS "Admin/master can delete products" ON public.products;
CREATE POLICY "Admin/master can insert products"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_master(auth.uid()));
CREATE POLICY "Admin/master can update products"
ON public.products
FOR UPDATE
TO authenticated
USING (public.is_admin_or_master(auth.uid()));
CREATE POLICY "Admin/master can delete products"
ON public.products
FOR DELETE
TO authenticated
USING (public.is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins/Master can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins/Master can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins/Master can delete profiles" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);
CREATE POLICY "Admins/Master can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin_or_master(auth.uid()));
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);
CREATE POLICY "Admins/Master can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_admin_or_master(auth.uid()));
CREATE POLICY "Admins/Master can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins/Master can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Master can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage vendedor roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete vendedor roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
CREATE POLICY "Admins/Master can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_admin_or_master(auth.uid()));
CREATE POLICY "Master can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'master'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'master'::public.app_role));
CREATE POLICY "Admins can manage vendedor roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) AND role = 'vendedor'::public.app_role);
CREATE POLICY "Admins can delete vendedor roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) AND role = 'vendedor'::public.app_role);