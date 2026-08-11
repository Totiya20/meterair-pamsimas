CREATE TABLE public.arrears (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  month int NOT NULL,
  year int NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  paid boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, month, year)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.arrears TO authenticated;
GRANT ALL ON public.arrears TO service_role;

ALTER TABLE public.arrears ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view arrears" ON public.arrears FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert arrears" ON public.arrears FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update arrears" ON public.arrears FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins can delete arrears" ON public.arrears FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER arrears_updated_at BEFORE UPDATE ON public.arrears FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();