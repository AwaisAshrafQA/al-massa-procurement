-- Counted units (pieces, bags, rolls, trips, ...) only make sense in whole numbers; measured
-- units (ton, kg, m3, litre, square metre) may have decimals. Enforced on every line write.
alter table public.units add column if not exists whole_only boolean not null default true;
update public.units set whole_only = false where code in ('TON', 'KG', 'M3', 'LTR', 'SQM');

create or replace function public.tg_line_clean_text()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  new.description := public._clean(new.description);
  new.size_spec := public._clean(new.size_spec);
  new.notes := public._clean(new.notes);
  perform public._check_len(new.description, 200, 'The item description');
  perform public._check_len(new.size_spec, 100, 'Size / spec');
  perform public._check_len(new.notes, 300, 'Line notes');
  if new.qty <> trunc(new.qty) and exists (
    select 1 from public.units u where u.company_id = new.company_id and u.code = new.unit and u.whole_only
  ) then
    raise exception 'Quantity in % must be a whole number.', new.unit using errcode = 'P0001';
  end if;
  return new;
end;
$fn$;
