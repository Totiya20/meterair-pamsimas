CREATE OR REPLACE FUNCTION public.sync_reading_with_arrear()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  if new.paid is not distinct from old.paid then return new; end if;
  update public.readings r set paid = new.paid
   where r.customer_id = new.customer_id
     and extract(month from r.created_at)::int = new.month
     and extract(year from r.created_at)::int = new.year
     and r.paid is distinct from new.paid;
  return new;
end; $$;

DROP TRIGGER IF EXISTS arrears_sync_readings ON public.arrears;
CREATE TRIGGER arrears_sync_readings AFTER UPDATE OF paid ON public.arrears
FOR EACH ROW EXECUTE FUNCTION public.sync_reading_with_arrear();

CREATE OR REPLACE FUNCTION public.sync_arrears_with_reading()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  if new.paid is not distinct from old.paid then return new; end if;
  update public.arrears a set paid = new.paid
   where a.customer_id = new.customer_id
     and a.month = extract(month from new.created_at)::int
     and a.year = extract(year from new.created_at)::int
     and a.paid is distinct from new.paid;
  return new;
end; $$;

UPDATE public.arrears a SET paid = s.all_paid
FROM (
  SELECT customer_id, extract(month from created_at)::int m, extract(year from created_at)::int y, bool_and(paid) all_paid
  FROM public.readings GROUP BY 1,2,3
) s
WHERE a.customer_id = s.customer_id AND a.month = s.m AND a.year = s.y AND a.paid IS DISTINCT FROM s.all_paid;