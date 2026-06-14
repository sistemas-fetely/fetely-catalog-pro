
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_login_at  timestamptz,
  ADD COLUMN IF NOT EXISTS login_count    integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.record_login()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.profiles
     SET first_login_at = COALESCE(first_login_at, now()),
         last_login_at  = now(),
         login_count    = COALESCE(login_count, 0) + 1
   WHERE id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_login() TO authenticated;
