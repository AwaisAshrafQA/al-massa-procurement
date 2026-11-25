-- Treat text that is only whitespace (newlines, tabs, non-breaking or zero-width spaces) as
-- empty. btrim() only strips plain spaces, so a comment of "\n" used to pass the
-- mandatory-comment check, and an urgent reason or line description of "\t" counted as filled.

-- Trim every kind of whitespace from both ends; null when nothing is left.
create or replace function public._clean(t text)
returns text
language sql immutable
as $fn$
  select nullif(regexp_replace(t, '^[\s ​  ﻿]+|[\s ​  ﻿]+$', '', 'g'), '')
$fn$;

create or replace function public._require_comment(p_comment text, p_what text)
returns text
language plpgsql
as $fn$
declare
  v text := public._clean(p_comment);
begin
  if v is null then
    perform public._fail('A comment is required to ' || p_what || '.');
  end if;
  return v;
end;
$fn$;

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
as $fn$
begin
  update public.purchase_requests set status = p_to where id = r.id;
  insert into public.activity_log (request_id, company_id, actor, acted_as, action, from_status, to_status, comment)
  values (r.id, r.company_id, auth.uid(), p_as, p_action, r.status, p_to, public._clean(p_comment));
  return jsonb_build_object('id', r.id, 'status', p_to, 'request_no', (select request_no from public.purchase_requests where id = r.id));
end;
$fn$;

-- Clean free text as it is written, so every later check (urgent reason on send, the
-- line "item or description" constraint) sees blank-looking text as missing.
create or replace function public.tg_pr_clean_text()
returns trigger
language plpgsql
as $fn$
begin
  new.purpose := public._clean(new.purpose);
  new.urgency_reason := public._clean(new.urgency_reason);
  return new;
end;
$fn$;
create trigger purchase_requests_clean_text
before insert or update of purpose, urgency_reason on public.purchase_requests
for each row execute function public.tg_pr_clean_text();

create or replace function public.tg_line_clean_text()
returns trigger
language plpgsql
as $fn$
begin
  new.description := public._clean(new.description);
  new.size_spec := public._clean(new.size_spec);
  new.notes := public._clean(new.notes);
  return new;
end;
$fn$;
create trigger request_lines_clean_text
before insert or update on public.request_lines
for each row execute function public.tg_line_clean_text();

create or replace function public.tg_comment_clean()
returns trigger
language plpgsql
as $fn$
begin
  new.comment := public._clean(new.comment);
  return new;
end;
$fn$;
create trigger approvals_clean_text before insert on public.approvals
for each row execute function public.tg_comment_clean();

create or replace function public.tg_notes_clean()
returns trigger
language plpgsql
as $fn$
begin
  new.notes := public._clean(new.notes);
  return new;
end;
$fn$;
create trigger receipts_clean_text before insert on public.receipts
for each row execute function public.tg_notes_clean();

-- Keep the workflow helpers private (same rule as the workflow migration). _clean stays
-- callable because the text triggers run as the signed-in user; it only trims text.
revoke execute on function public._require_comment(text, text) from public, anon, authenticated;
revoke execute on function public._set_status(public.purchase_requests, public.request_status, text, public.app_role, text) from public, anon, authenticated;
revoke execute on function public._clean(text) from public, anon;
grant execute on function public._clean(text) to authenticated, service_role;
