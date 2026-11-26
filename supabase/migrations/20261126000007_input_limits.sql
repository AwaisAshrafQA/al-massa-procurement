-- Input limits and cleaning, enforced in the database so nothing can bypass them by calling
-- the API directly. The app shows the same limits in its forms; these are the backstop.
--   * strip invisible control characters (keep newline and tab)
--   * length limits on every free-text field, with readable messages
--   * dates within the next 12 months; at most 50 lines per request
-- Text is stored as plain text and always displayed escaped by React, so HTML or script typed
-- into a field is shown literally and never runs; all writes go through parameterised
-- functions and row-level security, so input cannot change a query.

-- _clean now also removes control characters (keeps \n and \t), then trims all whitespace.
create or replace function public._clean(t text)
returns text
language sql immutable
as $fn$
  -- 1) control characters and bidi override/isolate characters ("Trojan Source" tricks);
  --    ordinary Arabic left/right marks (U+200E/U+200F) are kept.
  -- 2) trim every kind of whitespace from both ends; null when nothing is left.
  select nullif(
    regexp_replace(
      regexp_replace(t, '[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]', '', 'g'),
      '^[\s ​  ﻿]+|[\s ​  ﻿]+$', '', 'g'),
    '')
$fn$;

create or replace function public._check_len(v text, max_len integer, what text)
returns void
language plpgsql immutable
as $fn$
begin
  if v is not null and char_length(v) > max_len then
    raise exception '% must be % characters or fewer.', what, max_len using errcode = 'P0001';
  end if;
end;
$fn$;

-- Request header text
create or replace function public.tg_pr_clean_text()
returns trigger
language plpgsql
as $fn$
begin
  new.purpose := public._clean(new.purpose);
  new.urgency_reason := public._clean(new.urgency_reason);
  perform public._check_len(new.purpose, 200, 'Purpose');
  perform public._check_len(new.urgency_reason, 300, 'The urgent reason');
  return new;
end;
$fn$;

-- Line text
create or replace function public.tg_line_clean_text()
returns trigger
language plpgsql
as $fn$
begin
  new.description := public._clean(new.description);
  new.size_spec := public._clean(new.size_spec);
  new.notes := public._clean(new.notes);
  perform public._check_len(new.description, 200, 'The item description');
  perform public._check_len(new.size_spec, 100, 'Size / spec');
  perform public._check_len(new.notes, 300, 'Line notes');
  return new;
end;
$fn$;

-- Comments on decisions and the activity log
create or replace function public.tg_comment_clean()
returns trigger
language plpgsql
as $fn$
begin
  new.comment := public._clean(new.comment);
  perform public._check_len(new.comment, 1000, 'The comment');
  return new;
end;
$fn$;

create trigger activity_log_clean_text before insert on public.activity_log
for each row execute function public.tg_comment_clean();

-- Receipt notes
create or replace function public.tg_notes_clean()
returns trigger
language plpgsql
as $fn$
begin
  new.notes := public._clean(new.notes);
  perform public._check_len(new.notes, 1000, 'Delivery notes');
  return new;
end;
$fn$;

-- When a request is sent: required date within 12 months, at most 50 lines.
create or replace function public.tg_pr_send_limits()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if new.status = 'pending_procurement' and old.status is distinct from 'pending_procurement' then
    if new.required_date > public._today_dubai() + 365 then
      raise exception 'The required date must be within the next 12 months.' using errcode = 'P0001';
    end if;
    if (select count(*) from public.request_lines where request_id = new.id) > 50 then
      raise exception 'A request can have at most 50 lines.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$fn$;
create trigger purchase_requests_send_limits before update of status on public.purchase_requests
for each row execute function public.tg_pr_send_limits();

-- Agreed delivery date within 12 months
create or replace function public.tg_order_limits()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if new.agreed_delivery_date > public._today_dubai() + 365 then
    raise exception 'The delivery date must be within the next 12 months.' using errcode = 'P0001';
  end if;
  return new;
end;
$fn$;
create trigger procurement_details_limits before insert or update on public.procurement_details
for each row execute function public.tg_order_limits();

revoke execute on function public._check_len(text, integer, text) from public, anon;
grant execute on function public._check_len(text, integer, text) to authenticated, service_role;
