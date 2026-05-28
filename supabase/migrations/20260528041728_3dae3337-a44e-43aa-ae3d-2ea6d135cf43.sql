CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION private.is_admin_or_master(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('master', 'admin')
  )
$$;

REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION private.is_admin_or_master(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.is_admin_or_master(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_admin_or_master(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_master(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_master(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_master(uuid) FROM authenticated;

DROP POLICY IF EXISTS "Admin/master can insert products" ON public.products;
DROP POLICY IF EXISTS "Admin/master can update products" ON public.products;
DROP POLICY IF EXISTS "Admin/master can delete products" ON public.products;
CREATE POLICY "Admin/master can insert products"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (private.is_admin_or_master(auth.uid()));
CREATE POLICY "Admin/master can update products"
ON public.products
FOR UPDATE
TO authenticated
USING (private.is_admin_or_master(auth.uid()));
CREATE POLICY "Admin/master can delete products"
ON public.products
FOR DELETE
TO authenticated
USING (private.is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins/Master can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins/Master can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins/Master can delete profiles" ON public.profiles;
CREATE POLICY "Admins/Master can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (private.is_admin_or_master(auth.uid()));
CREATE POLICY "Admins/Master can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (private.is_admin_or_master(auth.uid()));
CREATE POLICY "Admins/Master can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (private.is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins/Master can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Master can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage vendedor roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete vendedor roles" ON public.user_roles;
CREATE POLICY "Admins/Master can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (private.is_admin_or_master(auth.uid()));
CREATE POLICY "Master can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (private.has_role(auth.uid(), 'master'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'master'::public.app_role));
CREATE POLICY "Admins can manage vendedor roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) AND role = 'vendedor'::public.app_role);
CREATE POLICY "Admins can delete vendedor roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role) AND role = 'vendedor'::public.app_role);

DROP POLICY IF EXISTS "Admin/master can insert photos" ON public.photos;
DROP POLICY IF EXISTS "Admin/master can update photos" ON public.photos;
DROP POLICY IF EXISTS "Admin/master can delete photos" ON public.photos;
CREATE POLICY "Admin/master can insert photos"
ON public.photos
FOR INSERT
TO authenticated
WITH CHECK (private.is_admin_or_master(auth.uid()));
CREATE POLICY "Admin/master can update photos"
ON public.photos
FOR UPDATE
TO authenticated
USING (private.is_admin_or_master(auth.uid()))
WITH CHECK (private.is_admin_or_master(auth.uid()));
CREATE POLICY "Admin/master can delete photos"
ON public.photos
FOR DELETE
TO authenticated
USING (private.is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admin/master can upload product photos" ON storage.objects;
DROP POLICY IF EXISTS "Admin/master can update product photos" ON storage.objects;
DROP POLICY IF EXISTS "Admin/master can delete product photos" ON storage.objects;
CREATE POLICY "Admin/master can upload product photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-photos' AND private.is_admin_or_master(auth.uid()));
CREATE POLICY "Admin/master can update product photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'product-photos' AND private.is_admin_or_master(auth.uid()))
WITH CHECK (bucket_id = 'product-photos' AND private.is_admin_or_master(auth.uid()));
CREATE POLICY "Admin/master can delete product photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'product-photos' AND private.is_admin_or_master(auth.uid()));