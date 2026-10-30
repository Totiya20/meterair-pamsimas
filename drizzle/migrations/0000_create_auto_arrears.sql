-- Rumus tagihan Pamsimas sebagai fungsi SQL (identik dengan src/lib/billing.ts)
create or replace function public.bill_total(p_usage numeric, p_tariff numeric)
returns numeric
language sql
immutable
as $$
  select case
    when p_usage >= 50
      then round(p_usage * p_tariff * 0.5)
    else least(round(p_usage * p_tariff), 100000)
  end + 5000;
$$;

-- Buat tunggakan otomatis dari tagihan bulan-bulan lampau yang belum dibayar
create or replace function public.auto_generate_arrears()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  created_count integer;
begin
  insert into public.arrears (customer_id, month, year, amount, paid, notes, created_by)
  select s.customer_id, s.m, s.y,
         public.bill_total(s.usage_sum, s.tariff),
         false,
         'Otomatis dari tagihan bulan ' || s.m || '/' || s.y,
         s.last_read_by
  from (
    select
      r.customer_id,
      extract(month from r.created_at)::int as m,
      extract(year from r.created_at)::int as y,
      sum(r.usage) as usage_sum,
      max(c.tariff) as tariff,
      (array_agg(r.read_by order by r.created_at desc nulls last))[1] as last_read_by,
      bool_or(r.paid) as any_paid
    from public.readings r
    join public.customers c on c.id = r.customer_id
    where (extract(year from r.created_at), extract(month from r.created_at))
            < (extract(year from now()), extract(month from now()))
    group by r.customer_id, extract(year from r.created_at), extract(month from r.created_at)
  ) s
  where s.any_paid = false
    and not exists (
      select 1 from public.arrears a
      where a.customer_id = s.customer_id and a.month = s.m and a.year = s.y
    );
  get diagnostics created_count = row_count;
  return created_count;
end;
$$;

revoke execute on function public.auto_generate_arrears() from anon, authenticated;

-- Sinkronkan status tunggakan saat tagihan (pembacaan) ditandai lunas / dibatalkan
create or replace function public.sync_arrears_with_reading()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.paid is not distinct from old.paid then
    return new;
  end if;
  update public.arrears a
     set paid = new.paid
   where a.customer_id = new.customer_id
     and a.month = extract(month from new.created_at)::int
     and a.year = extract(year from new.created_at)::int;
  return new;
end;
$$;

drop trigger if exists readings_sync_arrears on public.readings;
create trigger readings_sync_arrears
after update on public.readings
for each row execute function public.sync_arrears_with_reading();

-- Kunci agar tidak ada entri tunggakan ganda per pelanggan/bulan/tahun
create unique index if not exists arrears_customer_month_year_key
  on public.arrears (customer_id, month, year);
