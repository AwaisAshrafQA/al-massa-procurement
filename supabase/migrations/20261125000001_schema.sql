-- Al Massa Procurement MVP: schema
-- Every table carries company_id so more companies can be added later without a redesign.

-- ---------- Enums ----------
create type public.app_role as enum ('site_engineer', 'procurement', 'project_manager', 'admin');

create type public.request_status as enum (
  'draft',
  'pending_procurement',
  'pending_pm',
  'approved_sourcing',
  'ordered',
  'received',
  'returned_to_site',
  'returned_to_procurement',
  'rejected',
  'cancelled'
);

create type public.urgency_level as enum ('normal', 'urgent');
create type public.approval_step as enum ('procurement_review', 'pm_approval');
create type public.approval_decision as enum ('forward', 'approve', 'return', 'reject');

-- ---------- Master data ----------
create table public.companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  company_id  uuid not null references public.companies (id),
  full_name   text not null,
  email       text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.user_roles (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  company_id  uuid not null references public.companies (id),
  role        public.app_role not null,
  primary key (user_id, role)
);

create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id),
  project_no  text not null,
  name        text not null,
  location    text,
  pm_user_id  uuid references public.profiles (id),
  status      text not null default 'active' check (status in ('active', 'closed')),
  created_at  timestamptz not null default now(),
  unique (company_id, project_no)
);

create table public.project_members (
  project_id  uuid not null references public.projects (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  company_id  uuid not null references public.companies (id),
  primary key (project_id, user_id)
);

create table public.units (
  company_id  uuid not null references public.companies (id),
  code        text not null,
  name        text not null,
  primary key (company_id, code)
);

create table public.items (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id),
  item_code     text not null,
  name          text not null,
  category      text,
  default_unit  text not null,
  size          text,
  active        boolean not null default true,
  unique (company_id, item_code),
  foreign key (company_id, default_unit) references public.units (company_id, code)
);

create table public.suppliers (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id),
  name        text not null,
  phone       text,
  active      boolean not null default true,
  unique (company_id, name)
);

-- ---------- Transactional data ----------
create table public.purchase_requests (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id),
  request_no      text,                       -- assigned on first send (PR-YYYY-NNNN)
  project_id      uuid not null references public.projects (id),
  requested_by    uuid not null references public.profiles (id),
  required_date   date not null,
  urgency         public.urgency_level not null default 'normal',
  urgency_reason  text,
  purpose         text,
  status          public.request_status not null default 'draft',
  created_at      timestamptz not null default now(),
  sent_at         timestamptz,
  updated_at      timestamptz not null default now(),
  unique (company_id, request_no)
);

create table public.request_lines (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.purchase_requests (id) on delete cascade,
  company_id   uuid not null references public.companies (id),
  line_no      integer not null check (line_no > 0),
  item_id      uuid references public.items (id),
  description  text,
  unit         text not null,
  size_spec    text,
  qty          numeric(12, 3) not null check (qty > 0),
  notes        text,
  constraint line_item_or_text check (item_id is not null or coalesce(btrim(description), '') <> ''),
  foreign key (company_id, unit) references public.units (company_id, code)
);

create table public.approvals (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.purchase_requests (id) on delete cascade,
  company_id  uuid not null references public.companies (id),
  step        public.approval_step not null,
  decision    public.approval_decision not null,
  decided_by  uuid not null references public.profiles (id),
  decided_at  timestamptz not null default now(),
  comment     text
);

create table public.procurement_details (
  request_id            uuid primary key references public.purchase_requests (id) on delete cascade,
  company_id            uuid not null references public.companies (id),
  supplier_id           uuid not null references public.suppliers (id),
  agreed_delivery_date  date not null,
  recorded_by           uuid not null references public.profiles (id),
  recorded_at           timestamptz not null default now()
);

create table public.receipts (
  request_id    uuid primary key references public.purchase_requests (id) on delete cascade,
  company_id    uuid not null references public.companies (id),
  confirmed_by  uuid not null references public.profiles (id),
  confirmed_at  timestamptz not null default now(),
  notes         text
);

create table public.activity_log (
  id           bigint generated always as identity primary key,
  request_id   uuid not null references public.purchase_requests (id) on delete cascade,
  company_id   uuid not null references public.companies (id),
  actor        uuid not null references public.profiles (id),
  acted_as     public.app_role,               -- role used for the action (e.g. 'admin' acting for a PM)
  action       text not null,
  from_status  public.request_status,
  to_status    public.request_status,
  comment      text,
  created_at   timestamptz not null default clock_timestamp()
);

create table public.number_sequences (
  company_id  uuid not null references public.companies (id),
  kind        text not null,
  year        integer not null,
  last_value  integer not null default 0,
  primary key (company_id, kind, year)
);

-- ---------- Indexes ----------
create index on public.project_members (user_id);
create index on public.user_roles (company_id);
create index on public.items (company_id, active);
create index on public.purchase_requests (project_id);
create index on public.purchase_requests (requested_by);
create index on public.purchase_requests (company_id, status);
create index on public.request_lines (request_id);
create index on public.approvals (request_id);
create index on public.activity_log (request_id, created_at);

-- ---------- updated_at ----------
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger purchase_requests_updated_at
before update on public.purchase_requests
for each row execute function public.tg_set_updated_at();
