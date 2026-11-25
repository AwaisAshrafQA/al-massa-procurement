-- Let updated_at be set explicitly (used by the seed to backdate demo history);
-- every normal update still stamps now().
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.updated_at is not distinct from old.updated_at then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.tg_set_updated_at() from public, anon, authenticated;
