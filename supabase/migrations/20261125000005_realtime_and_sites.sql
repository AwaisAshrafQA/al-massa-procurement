-- Live updates: stream new workflow events to signed-in users.
-- Supabase Realtime applies the same RLS SELECT policy, so each user only receives
-- events for requests they are allowed to see.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activity_log'
  ) then
    alter publication supabase_realtime add table public.activity_log;
  end if;
end $$;

-- Site map: approximate coordinates per project (nullable; "all sites" projects have none).
alter table public.projects add column if not exists lat numeric(8, 5);
alter table public.projects add column if not exists lng numeric(8, 5);
