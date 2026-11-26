-- Allow past dates so earlier days' requests and orders can be entered after the fact.
-- Required date (on send) and agreed delivery date must now be within 12 months either side
-- of today (Asia/Dubai); a mistyped year is still caught.

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
  -- (date range is checked by the purchase_requests_send_limits trigger)
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
  if p_delivery_date is null then
    perform public._fail('Choose the agreed delivery date.');
  end if;
  -- (date range is checked by the procurement_details_limits trigger)

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

create or replace function public.tg_pr_send_limits()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if new.status = 'pending_procurement' and old.status is distinct from 'pending_procurement' then
    if new.required_date < public._today_dubai() - 365 or new.required_date > public._today_dubai() + 365 then
      raise exception 'The required date must be within 12 months of today.' using errcode = 'P0001';
    end if;
    if (select count(*) from public.request_lines where request_id = new.id) > 50 then
      raise exception 'A request can have at most 50 lines.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$fn$;

create or replace function public.tg_order_limits()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if new.agreed_delivery_date < public._today_dubai() - 365 or new.agreed_delivery_date > public._today_dubai() + 365 then
    raise exception 'The delivery date must be within 12 months of today.' using errcode = 'P0001';
  end if;
  return new;
end;
$fn$;

-- Same privileges as before: only the rpc_* entry points are callable by users.
revoke execute on function public.rpc_send_request(uuid) from public, anon;
revoke execute on function public.rpc_record_order(uuid, uuid, date, text) from public, anon;
grant execute on function public.rpc_send_request(uuid), public.rpc_record_order(uuid, uuid, date, text) to authenticated;
