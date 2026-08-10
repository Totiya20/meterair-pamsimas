-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'petugas');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.admin_emails (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_emails TO service_role;
ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;

INSERT INTO public.admin_emails (email) VALUES ('adminpamsimas@gmail.com');

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM auth.users u
    JOIN public.admin_emails a ON lower(u.email) = lower(a.email)
    WHERE u.id = _user_id
  );
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- Login activity log (no passwords stored)
CREATE TABLE public.login_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  status text NOT NULL CHECK (status IN ('berhasil', 'gagal')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.login_logs TO anon, authenticated;
GRANT SELECT ON public.login_logs TO authenticated;
GRANT ALL ON public.login_logs TO service_role;
ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record a login attempt" ON public.login_logs
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Admins can view login logs" ON public.login_logs
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- Only admins may delete meter readings
DROP POLICY IF EXISTS "Authenticated can delete readings" ON public.readings;
CREATE POLICY "Admins can delete readings" ON public.readings
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
