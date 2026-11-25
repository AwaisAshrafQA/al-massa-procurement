-- Al Massa Procurement MVP: access control
-- Principle: deny by default. Signed-in users can READ what their role and project
-- assignments allow, can EDIT only their own draft/returned requests, and can change
-- a request's status ONLY through the workflow functions (next migration).

-- ---------- Helper functions (SECURITY DEFINER so policies don't recurse) ----------
create or replace function public.auth_company()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid() and active;
$$;

create or replace function public.has_role(r public.app_role)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id and p.active
    where ur.user_id = auth.uid() and ur.role = r
  );
$$;

create or replace function public.is_project_member(p_project uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project and user_id = auth.uid()
  );
$$;

-- Procurement and Admin see every project; others see projects they are members of or manage.
create or replace function public.can_see_project(p_project uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.has_role('procurement') or public.has_role('admin')
      or public.is_project_member(p_project)
      or exists (select 1 from public.projects where id = p_project and pm_user_id = auth.uid());
$$;

create or replace function public.can_see_request(p_request uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.purchase_requests r
    where r.id = p_request
      and r.company_id = public.auth_company()
      and (public.can_see_project(r.project_id) or r.requested_by = auth.uid())
  );
$$;

create or replace function public.can_edit_request(p_request uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.purchase_requests r
    where r.id = p_request
      and r.company_id = public.auth_company()
      and r.requested_by = auth.uid()
      and r.status in ('draft', 'returned_to_site')
  );
$$;

-- ---------- Triggers that force server-controlled values ----------
-- New requests always start as the caller's own draft, in the caller's company, with no number.
create or replace function public.tg_pr_before_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.company_id   := public.auth_company();
    new.requested_by := auth.uid();
  end if;
  new.status     := 'draft';
  new.request_no := null;
  new.sent_at    := null;
  new.created_at := now();
  return new;
end;
$$;

create trigger purchase_requests_before_insert
before insert on public.purchase_requests
for each row execute function public.tg_pr_before_insert();

-- Lines inherit the company of their request.
create or replace function public.tg_line_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select company_id into new.company_id from public.purchase_requests where id = new.request_id;
  return new;
end;
$$;

create trigger request_lines_before_write
before insert or update on public.request_lines
for each row execute function public.tg_line_before_write();

-- ---------- Table privileges ----------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Read access (rows are further limited by RLS below)
grant select on
  public.companies, public.profiles, public.user_roles, public.projects, public.project_members,
  public.units, public.items, public.suppliers,
  public.purchase_requests, public.request_lines, public.approvals,
  public.procurement_details, public.receipts, public.activity_log
to authenticated;

-- Requesters may create and edit only these header columns (never status / request_no / requester).
grant insert (project_id, required_date, urgency, urgency_reason, purpose) on public.purchase_requests to authenticated;
grant update (project_id, required_date, urgency, urgency_reason, purpose) on public.purchase_requests to authenticated;

-- Lines of their own editable requests.
grant insert (request_id, line_no, item_id, description, unit, size_spec, qty, notes) on public.request_lines to authenticated;
grant update (line_no, item_id, description, unit, size_spec, qty, notes) on public.request_lines to authenticated;
grant delete on public.request_lines to authenticated;

-- approvals, procurement_details, receipts, activity_log, number_sequences:
-- no insert/update/delete for authenticated users at all. Only workflow functions write them.

-- ---------- Row Level Security ----------
alter table public.companies           enable row level security;
alter table public.profiles            enable row level security;
alter table public.user_roles          enable row level security;
alter table public.projects            enable row level security;
alter table public.project_members     enable row level security;
alter table public.units               enable row level security;
alter table public.items               enable row level security;
alter table public.suppliers           enable row level security;
alter table public.purchase_requests   enable row level security;
alter table public.request_lines       enable row level security;
alter table public.approvals           enable row level security;
alter table public.procurement_details enable row level security;
alter table public.receipts            enable row level security;
alter table public.activity_log        enable row level security;
alter table public.number_sequences    enable row level security;   -- no policies: unreachable

create policy companies_read on public.companies
  for select to authenticated using (id = public.auth_company());

create policy profiles_read on public.profiles
  for select to authenticated using (company_id = public.auth_company());

create policy user_roles_read on public.user_roles
  for select to authenticated using (company_id = public.auth_company());

create policy projects_read on public.projects
  for select to authenticated
  using (company_id = public.auth_company() and public.can_see_project(id));

create policy project_members_read on public.project_members
  for select to authenticated
  using (company_id = public.auth_company() and public.can_see_project(project_id));

create policy units_read on public.units
  for select to authenticated using (company_id = public.auth_company());

create policy items_read on public.items
  for select to authenticated using (company_id = public.auth_company());

create policy suppliers_read on public.suppliers
  for select to authenticated using (company_id = public.auth_company());

-- Requests
create policy requests_read on public.purchase_requests
  for select to authenticated
  using (
    company_id = public.auth_company()
    and (public.can_see_project(project_id) or requested_by = auth.uid())
  );

create policy requests_insert on public.purchase_requests
  for insert to authenticated
  with check (
    company_id = public.auth_company()
    and requested_by = auth.uid()
    and status = 'draft'
    and public.has_role('site_engineer')
    and public.is_project_member(project_id)
    and exists (select 1 from public.projects p where p.id = project_id and p.status = 'active')
  );

create policy requests_update_own_editable on public.purchase_requests
  for update to authenticated
  using (
    company_id = public.auth_company()
    and requested_by = auth.uid()
    and status in ('draft', 'returned_to_site')
  )
  with check (
    company_id = public.auth_company()
    and requested_by = auth.uid()
    and status in ('draft', 'returned_to_site')
    and public.is_project_member(project_id)
  );

-- Lines
create policy lines_read on public.request_lines
  for select to authenticated using (public.can_see_request(request_id));

create policy lines_insert on public.request_lines
  for insert to authenticated with check (public.can_edit_request(request_id));

create policy lines_update on public.request_lines
  for update to authenticated
  using (public.can_edit_request(request_id))
  with check (public.can_edit_request(request_id));

create policy lines_delete on public.request_lines
  for delete to authenticated using (public.can_edit_request(request_id));

-- Workflow records: read-only, visible with the request
create policy approvals_read on public.approvals
  for select to authenticated using (public.can_see_request(request_id));

create policy procurement_details_read on public.procurement_details
  for select to authenticated using (public.can_see_request(request_id));

create policy receipts_read on public.receipts
  for select to authenticated using (public.can_see_request(request_id));

create policy activity_log_read on public.activity_log
  for select to authenticated using (public.can_see_request(request_id));

-- ---------- Function privileges ----------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.auth_company(), public.has_role(public.app_role), public.is_project_member(uuid),
  public.can_see_project(uuid), public.can_see_request(uuid), public.can_edit_request(uuid)
to authenticated;
grant execute on all functions in schema public to service_role;
