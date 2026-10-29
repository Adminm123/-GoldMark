-- GoldMark V2 anti-fraud schema draft
-- DESIGN ONLY. Do not run against production without security and migration review.
-- Assumes Supabase Auth is used. Keep DEMO, STAGING, and PRODUCTION in separate projects.
create extension if not exists pgcrypto;

create type public.evaluation_status as enum
  ('DRAFT','DISPLAYED','ACCEPTED','DECLINED','EXPIRED','CANCELLED','CONVERTED_TO_TRANSACTION');
create type public.review_status as enum ('OPEN','IN_REVIEW','RESOLVED','DISMISSED');

create table public.branches (
  branch_id uuid primary key default gen_random_uuid(),
  branch_code text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.employee_profiles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  employee_code text not null unique,
  branch_id uuid not null references public.branches(branch_id),
  role text not null check (role in ('staff','branch_manager','hq_auditor','price_manager','system_admin')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.price_snapshots (
  price_snapshot_id uuid primary key default gen_random_uuid(),
  provider text not null,
  source_reference text,
  fetched_at timestamptz not null,
  effective_at timestamptz not null,
  buy_rate numeric(14,2) not null check (buy_rate >= 0),
  status text not null check (status in ('DRAFT','PUBLISHED','EXPIRED','REVOKED')),
  published_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.formula_versions (
  formula_version_id uuid primary key default gen_random_uuid(),
  version_label text not null unique,
  description text not null,
  checksum text not null,
  approved_at timestamptz,
  status text not null check (status in ('DRAFT','APPROVED','RETIRED')),
  created_at timestamptz not null default now()
);

create table public.evaluations (
  evaluation_id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(branch_id),
  employee_id uuid not null references auth.users(id),
  status public.evaluation_status not null default 'DRAFT',
  price_snapshot_id uuid not null references public.price_snapshots(price_snapshot_id),
  current_revision_id uuid,
  created_at timestamptz not null default now(),
  displayed_at timestamptz,
  resolved_at timestamptz
);

create table public.evaluation_revisions (
  revision_id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(evaluation_id) on delete restrict,
  revision_no integer not null check (revision_no > 0),
  input_data jsonb not null,
  formula_version_id uuid not null references public.formula_versions(formula_version_id),
  calculated_amount numeric(14,2) not null check (calculated_amount >= 0),
  displayed_amount numeric(14,2) not null check (displayed_amount >= 0),
  changed_by uuid not null references auth.users(id),
  reason text,
  created_at timestamptz not null default now(),
  unique(evaluation_id, revision_no)
);

alter table public.evaluations
  add constraint evaluations_current_revision_fk
  foreign key (current_revision_id) references public.evaluation_revisions(revision_id);

create table public.transactions (
  transaction_id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null unique references public.evaluations(evaluation_id) on delete restrict,
  accepted_revision_id uuid not null references public.evaluation_revisions(revision_id),
  agreed_amount numeric(14,2) not null check (agreed_amount >= 0),
  actual_paid_amount numeric(14,2) check (actual_paid_amount >= 0),
  payment_reference text,
  paid_at timestamptz,
  confirmed_by uuid references auth.users(id),
  status text not null check (status in ('PENDING_PAYMENT','PAID','CANCELLED','REVIEW_REQUIRED')),
  created_at timestamptz not null default now()
);

create table public.audit_events (
  event_id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  branch_id uuid references public.branches(branch_id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  occurred_at timestamptz not null default now(),
  reason text,
  before_data jsonb,
  after_data jsonb,
  correlation_id uuid,
  created_at timestamptz not null default now()
);

create table public.risk_alerts (
  alert_id uuid primary key default gen_random_uuid(),
  rule_id text not null,
  evaluation_id uuid references public.evaluations(evaluation_id),
  transaction_id uuid references public.transactions(transaction_id),
  severity text not null check (severity in ('LOW','MEDIUM','HIGH')),
  status public.review_status not null default 'OPEN',
  evidence jsonb not null default '{}'::jsonb,
  assigned_to uuid references auth.users(id),
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index evaluations_branch_created_idx on public.evaluations(branch_id, created_at desc);
create index evaluations_employee_created_idx on public.evaluations(employee_id, created_at desc);
create index audit_events_entity_idx on public.audit_events(entity_type, entity_id, occurred_at desc);
create index risk_alerts_status_created_idx on public.risk_alerts(status, created_at desc);

-- Enable RLS. Policies below are intentionally not auto-generated in this draft:
-- Access must be based on a trusted server-verified role/branch claim or protected
-- employee_profiles lookup. Never trust branch_id or role supplied by the browser.
alter table public.branches enable row level security;
alter table public.employee_profiles enable row level security;
alter table public.price_snapshots enable row level security;
alter table public.formula_versions enable row level security;
alter table public.evaluations enable row level security;
alter table public.evaluation_revisions enable row level security;
alter table public.transactions enable row level security;
alter table public.audit_events enable row level security;
alter table public.risk_alerts enable row level security;

-- Important before any live use:
-- 1) Add reviewed SELECT/INSERT/UPDATE policies for each role; default deny otherwise.
-- 2) Revoke UPDATE/DELETE on audit_events and evaluation_revisions from application roles.
-- 3) Implement SECURITY DEFINER RPC/backend functions with fixed search_path for atomic
--    evaluation creation, revision append, accept/convert, payment confirmation and audit events.
-- 4) Never expose service-role credentials to the client.
-- 5) Enforce formula calculation on the server and test old formula against golden cases.
-- 6) This schema is a draft; it does not yet implement the policies or server functions.
