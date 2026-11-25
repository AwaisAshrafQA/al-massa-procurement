-- Al Massa Procurement MVP: workflow functions
-- The ONLY way a request changes status. Each function locks the request, checks the
-- caller's role, the current status and required comments, then writes approvals,
-- activity_log and side tables in one transaction.
-- Errors are raised with readable messages; the app shows them to the user as-is.

-- ---------- Internal helpers (not callable by app users) ----------
create or replace function public._today_dubai()
returns date
language sql stable
as $$ select (now() at time zone 'Asia/Dubai')::date $$;

create or replace function public._fail(msg text)
returns void
language plpgsql
as $$ begin raise exception '%', msg using errcode = 'P0001'; end; $$;

-- Lock a request the caller is allowed to see; anything else looks like "not found".
create or replace function public._lock_request(p_id uuid)
returns public.purchase_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.purchase_requests;
begin
  if auth.uid() is null then
    perform public._fail('You must be signed in.');
  end if;
  select * into r from public.purchase_requests where id = p_id for update;
  if not found
     or r.company_id is distinct from public.auth_company()
     or not (public.can_see_project(r.project_id) or r.requested_by = auth.uid()) then
    perform public._fail('Request not found.');
  end if;
  return r;
end;
$$;

create or replace function public._require_comment(p_comment text, p_what text)
returns text
language plpgsql
as $$
begin
  if coalesce(btrim(p_comment), '') = '' then
    perform public._fail('A comment is required to ' || p_what || '.');
  end if;
  return btrim(p_comment);
end;
$$;

create or replace function public._require_status(r public.purchase_requests, allowed public.request_status[], p_what text)
returns void
language plpgsql
as $$
begin
  if not (r.status = any (allowed)) then
    perform public._fail(format('Cannot %s: the request is currently "%s".', p_what, replace(r.status::text, '_', ' ')));
  end if;
end;
$$;

create or replace function public._not_own_request(r public.purchase_requests, p_what text)
returns void
language plpgsql
as $$
begin
  if r.requested_by = auth.uid() then
    perform public._fail(format('You cannot %s a request you raised yourself.', p_what));
  end if;
end;
$$;

create or replace function public._set_status(
  r public.purchase_requests,
  p_to public.request_status,
  p_action text,
  p_as public.app_role,
  p_comment text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.purchase_requests set status = p_to where id = r.id;
  insert into public.activity_log (request_id, company_id, actor, acted_as, action, from_status, to_status, comment)
  values (r.id, r.company_id, auth.uid(), p_as, p_action, r.status, p_to, nullif(btrim(p_comment), ''));
  return jsonb_build_object('id', r.id, 'status', p_to, 'request_no', (select request_no from public.purchase_requests where id = r.id));
end;
$$;

-- Role used for a Procurement step: procurement if held, otherwise admin; null = not allowed.
create or replace function public._procurement_role()
returns public.app_role
language sql stable security definer
set search_path = public
as $$
  select case
    when public.has_role('procurement') then 'procurement'::public.app_role
    when public.has_role('admin') then 'admin'::public.app_role
  end;
$$;

-- Role used for a PM step on this project: the project's PM, otherwise admin; null = not allowed.
create or replace function public._pm_role(p_project uuid)
returns public.app_role
language sql stable security definer
set search_path = public
as $$
  select case
    when exists (select 1 from public.projects where id = p_project and pm_user_id = auth.uid())
         and public.has_role('project_manager') then 'project_manager'::public.app_role
    when public.has_role('admin') then 'admin'::public.app_role
  end;
$$;

-- ---------- Site Engineer ----------
create or replace function public.rpc_send_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.purchase_requests;
  v_year integer;
  v_no integer;
  v_action text;
begin
  r := public._lock_request(p_request_id);
  if r.requested_by <> auth.uid() then
    perform public._fail('Only the person who raised this request can send it.');
  end if;
  perform public._require_status(r, array['draft', 'returned_to_site']::public.request_status[], 'send');

  if not public.is_project_member(r.project_id) then
    perform public._fail('You are no longer assigned to this project.');
  end if;
  if not exists (select 1 from public.projects where id = r.project_id and status = 'active') then
    perform public._fail('This project is closed.');
  end if;
  if not exists (select 1 from public.request_lines where request_id = r.id) then
    perform public._fail('Add at least one line before sending.');
  end if;
  if r.required_date < public._today_dubai() then
    perform public._fail('The required date cannot be in the past.');
  end if;
  if r.urgency = 'urgent' and coalesce(btrim(r.urgency_reason), '') = '' then
    perform public._fail('Urgent requests need a reason.');
  end if;

  if r.request_no is null then
    v_year := extract(year from public._today_dubai())::integer;
    insert into public.number_sequences (company_id, kind, year, last_value)
    values (r.company_id, 'PR', v_year, 1)
    on conflict (company_id, kind, year)
      do update set last_value = public.number_sequences.last_value + 1
    returning last_value into v_no;
    update public.purchase_requests
       set request_no = format('PR-%s-%s', v_year, lpad(v_no::text, 4, '0')),
           sent_at = now()
     where id = r.id;
    v_action := 'sent';
  else
    v_action := 'resent';
  end if;

  return public._set_status(r, 'pending_procurement', v_action, 'site_engineer', null);
end;
$$;

create or replace function public.rpc_delete_draft(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.purchase_requests;
begin
  r := public._lock_request(p_request_id);
  if r.requested_by <> auth.uid() then
    perform public._fail('Only the person who raised this draft can delete it.');
  end if;
  if r.status <> 'draft' or r.request_no is not null then
    perform public._fail('Only unsent drafts can be deleted. Cancel the request instead.');
  end if;
  delete from public.purchase_requests where id = r.id;
  return jsonb_build_object('id', r.id, 'deleted', true);
end;
$$;

create or replace function public.rpc_confirm_receipt(p_request_id uuid, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.purchase_requests;
  v_as public.app_role;
begin
  r := public._lock_request(p_request_id);
  if public.has_role('site_engineer') and public.is_project_member(r.project_id) then
    v_as := 'site_engineer';
  elsif public.has_role('admin') then
    v_as := 'admin';
  else
    perform public._fail('Only a site engineer on this project can confirm receipt.');
  end if;
  perform public._require_status(r, array['ordered']::public.request_status[], 'confirm receipt');

  insert into public.receipts (request_id, company_id, confirmed_by, notes)
  values (r.id, r.company_id, auth.uid(), nullif(btrim(p_notes), ''));

  return public._set_status(r, 'received', 'receipt_confirmed', v_as, p_notes);
end;
$$;

-- ---------- Procurement ----------
create or replace function public.rpc_forward_to_pm(p_request_id uuid, p_comment text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.purchase_requests;
  v_as public.app_role := public._procurement_role();
begin
  r := public._lock_request(p_request_id);
  if v_as is null then
    perform public._fail('Only Procurement can forward requests to the Project Manager.');
  end if;
  perform public._not_own_request(r, 'forward');
  perform public._require_status(r, array['pending_procurement', 'returned_to_procurement']::public.request_status[], 'forward to PM');
  if not exists (
    select 1 from public.projects pr join public.profiles pf on pf.id = pr.pm_user_id and pf.active
    where pr.id = r.project_id
  ) then
    perform public._fail('This project has no active Project Manager. Ask Admin to assign one.');
  end if;

  insert into public.approvals (request_id, company_id, step, decision, decided_by, comment)
  values (r.id, r.company_id, 'procurement_review', 'forward', auth.uid(), nullif(btrim(p_comment), ''));

  return public._set_status(r, 'pending_pm', 'forwarded_to_pm', v_as, p_comment);
end;
$$;

create or replace function public.rpc_return_to_site(p_request_id uuid, p_comment text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.purchase_requests;
  v_as public.app_role := public._procurement_role();
  v_comment text;
begin
  r := public._lock_request(p_request_id);
  if v_as is null then
    perform public._fail('Only Procurement can return requests to site.');
  end if;
  perform public._not_own_request(r, 'return');
  perform public._require_status(r, array['pending_procurement', 'returned_to_procurement']::public.request_status[], 'return to site');
  v_comment := public._require_comment(p_comment, 'return a request');

  insert into public.approvals (request_id, company_id, step, decision, decided_by, comment)
  values (r.id, r.company_id, 'procurement_review', 'return', auth.uid(), v_comment);

  return public._set_status(r, 'returned_to_site', 'returned_to_site', v_as, v_comment);
end;
$$;

create or replace function public.rpc_record_order(
  p_request_id uuid,
  p_supplier_id uuid,
  p_delivery_date date,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.purchase_requests;
  v_as public.app_role := public._procurement_role();
  v_supplier text;
  v_action text;
  v_note text;
begin
  r := public._lock_request(p_request_id);
  if v_as is null then
    perform public._fail('Only Procurement can record the supplier and delivery date.');
  end if;
  perform public._require_status(r, array['approved_sourcing', 'ordered']::public.request_status[], 'record the order');

  select name into v_supplier from public.suppliers
   where id = p_supplier_id and company_id = r.company_id and active;
  if v_supplier is null then
    perform public._fail('Choose an active supplier.');
  end if;
  if p_delivery_date is null or p_delivery_date < public._today_dubai() then
    perform public._fail('The delivery date cannot be in the past.');
  end if;

  insert into public.procurement_details (request_id, company_id, supplier_id, agreed_delivery_date, recorded_by, recorded_at)
  values (r.id, r.company_id, p_supplier_id, p_delivery_date, auth.uid(), now())
  on conflict (request_id) do update
    set supplier_id = excluded.supplier_id,
        agreed_delivery_date = excluded.agreed_delivery_date,
        recorded_by = excluded.recorded_by,
        recorded_at = excluded.recorded_at;

  v_action := case when r.status = 'ordered' then 'order_updated' else 'order_recorded' end;
  v_note := format('Supplier: %s · Delivery: %s', v_supplier, to_char(p_delivery_date, 'DD Mon YYYY'));
  if coalesce(btrim(p_comment), '') <> '' then
    v_note := v_note || ' · ' || btrim(p_comment);
  end if;

  return public._set_status(r, 'ordered', v_action, v_as, v_note);
end;
$$;

-- ---------- Project Manager ----------
create or replace function public.rpc_pm_approve(p_request_id uuid, p_comment text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.purchase_requests;
  v_as public.app_role;
begin
  r := public._lock_request(p_request_id);
  v_as := public._pm_role(r.project_id);
  if v_as is null then
    perform public._fail('Only this project''s Project Manager can approve.');
  end if;
  perform public._not_own_request(r, 'approve');
  perform public._require_status(r, array['pending_pm']::public.request_status[], 'approve');

  insert into public.approvals (request_id, company_id, step, decision, decided_by, comment)
  values (r.id, r.company_id, 'pm_approval', 'approve', auth.uid(), nullif(btrim(p_comment), ''));

  return public._set_status(r, 'approved_sourcing', 'approved', v_as, p_comment);
end;
$$;

create or replace function public.rpc_pm_return(p_request_id uuid, p_comment text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.purchase_requests;
  v_as public.app_role;
  v_comment text;
begin
  r := public._lock_request(p_request_id);
  v_as := public._pm_role(r.project_id);
  if v_as is null then
    perform public._fail('Only this project''s Project Manager can return it to Procurement.');
  end if;
  perform public._not_own_request(r, 'return');
  perform public._require_status(r, array['pending_pm']::public.request_status[], 'return to Procurement');
  v_comment := public._require_comment(p_comment, 'return a request');

  insert into public.approvals (request_id, company_id, step, decision, decided_by, comment)
  values (r.id, r.company_id, 'pm_approval', 'return', auth.uid(), v_comment);

  return public._set_status(r, 'returned_to_procurement', 'returned_to_procurement', v_as, v_comment);
end;
$$;

create or replace function public.rpc_pm_reject(p_request_id uuid, p_comment text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.purchase_requests;
  v_as public.app_role;
  v_comment text;
begin
  r := public._lock_request(p_request_id);
  v_as := public._pm_role(r.project_id);
  if v_as is null then
    perform public._fail('Only this project''s Project Manager can reject.');
  end if;
  perform public._not_own_request(r, 'reject');
  perform public._require_status(r, array['pending_pm']::public.request_status[], 'reject');
  v_comment := public._require_comment(p_comment, 'reject a request');

  insert into public.approvals (request_id, company_id, step, decision, decided_by, comment)
  values (r.id, r.company_id, 'pm_approval', 'reject', auth.uid(), v_comment);

  return public._set_status(r, 'rejected', 'rejected', v_as, v_comment);
end;
$$;

-- ---------- Cancel ----------
create or replace function public.rpc_cancel_request(p_request_id uuid, p_comment text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.purchase_requests;
  v_as public.app_role;
  v_comment text;
begin
  r := public._lock_request(p_request_id);
  if public.has_role('admin') then
    v_as := 'admin';
    perform public._require_status(r,
      array['pending_procurement', 'pending_pm', 'approved_sourcing', 'ordered',
            'returned_to_site', 'returned_to_procurement']::public.request_status[], 'cancel');
  elsif r.requested_by = auth.uid() then
    v_as := 'site_engineer';
    perform public._require_status(r,
      array['pending_procurement', 'returned_to_site']::public.request_status[], 'cancel');
  else
    perform public._fail('Only the requester or Admin can cancel a request.');
  end if;
  v_comment := public._require_comment(p_comment, 'cancel a request');

  return public._set_status(r, 'cancelled', 'cancelled', v_as, v_comment);
end;
$$;

-- ---------- Privileges ----------
-- Internal helpers stay private; only the rpc_* entry points (and the read helpers that
-- RLS policies call) are callable by signed-in users. Revoke from authenticated explicitly
-- in case the platform's default privileges granted it on creation.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.auth_company(), public.has_role(public.app_role), public.is_project_member(uuid),
  public.can_see_project(uuid), public.can_see_request(uuid), public.can_edit_request(uuid)
to authenticated;
grant execute on function
  public.rpc_send_request(uuid),
  public.rpc_delete_draft(uuid),
  public.rpc_confirm_receipt(uuid, text),
  public.rpc_forward_to_pm(uuid, text),
  public.rpc_return_to_site(uuid, text),
  public.rpc_record_order(uuid, uuid, date, text),
  public.rpc_pm_approve(uuid, text),
  public.rpc_pm_return(uuid, text),
  public.rpc_pm_reject(uuid, text),
  public.rpc_cancel_request(uuid, text)
to authenticated;
grant execute on all functions in schema public to service_role;
