-- Customers and rentals remain tenant-scoped even for trusted database writes.
-- GiST exclusion is the final concurrency guard for half-open reservation windows.
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  name text not null,
  phone text not null default '',
  email text not null default '',
  notes text not null default '',
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_name_check check (name = trim(name) and length(name) between 1 and 120),
  constraint customers_phone_check check (phone = trim(phone) and length(phone) <= 32 and (phone = '' or phone ~ '^\+?[0-9][0-9 -]{4,31}$')),
  constraint customers_email_check check (email = lower(trim(email)) and length(email) <= 254 and (email = '' or email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')),
  constraint customers_contact_check check (phone <> '' or email <> ''),
  constraint customers_notes_check check (length(notes) <= 2000),
  constraint customers_status_check check (status in ('ACTIVE', 'INACTIVE')),
  constraint customers_business_id_id_unique unique (business_id, id)
);
-- Contact values are intentionally not unique: households may share a number/email.
create index customers_business_created on public.customers(business_id, created_at desc, id);
create index customers_business_status_name on public.customers(business_id, status, name, id);

create table public.rentals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  customer_id uuid not null,
  vehicle_id uuid not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'DRAFT',
  rental_amount numeric(14,2) not null default 0,
  deposit_required_amount numeric(14,2) not null default 0,
  deposit_received boolean not null default false,
  notes text not null default '',
  reserved_at timestamptz,
  handed_over_at timestamptz,
  returned_at timestamptz,
  cancelled_at timestamptz,
  odometer_start integer,
  odometer_end integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rentals_customer_tenant_fk foreign key (business_id, customer_id)
    references public.customers(business_id, id) on delete restrict,
  constraint rentals_vehicle_tenant_fk foreign key (business_id, vehicle_id)
    references public.vehicles(business_id, id) on delete restrict,
  constraint rentals_time_check check (isfinite(start_at) and isfinite(end_at) and end_at > start_at),
  constraint rentals_amount_check check (rental_amount >= 0 and deposit_required_amount >= 0 and rental_amount <> 'NaN'::numeric and deposit_required_amount <> 'NaN'::numeric),
  constraint rentals_notes_check check (length(notes) <= 4000),
  constraint rentals_status_check check (status in ('DRAFT', 'RESERVED', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
  constraint rentals_odometer_check check (
    (odometer_start is null or odometer_start >= 0) and
    (odometer_end is null or odometer_end >= odometer_start)
  ),
  constraint rentals_milestone_time_check check (
    (reserved_at is null or isfinite(reserved_at)) and
    (handed_over_at is null or isfinite(handed_over_at)) and
    (returned_at is null or isfinite(returned_at)) and
    (cancelled_at is null or isfinite(cancelled_at)) and
    (handed_over_at is null or handed_over_at >= reserved_at) and
    (returned_at is null or returned_at >= handed_over_at) and
    (cancelled_at is null or reserved_at is null or cancelled_at >= reserved_at)
  ),
  -- OVERDUE is derived from ACTIVE + end_at, never persisted as a workflow status.
  constraint rentals_state_milestones_check check (
    (status = 'DRAFT' and reserved_at is null and handed_over_at is null and returned_at is null and cancelled_at is null and odometer_start is null and odometer_end is null) or
    (status = 'RESERVED' and reserved_at is not null and handed_over_at is null and returned_at is null and cancelled_at is null and odometer_start is null and odometer_end is null) or
    (status = 'ACTIVE' and reserved_at is not null and handed_over_at is not null and returned_at is null and cancelled_at is null and odometer_start is not null and odometer_end is null) or
    (status = 'COMPLETED' and reserved_at is not null and handed_over_at is not null and returned_at is not null and cancelled_at is null and odometer_start is not null and odometer_end is not null) or
    (status = 'CANCELLED' and handed_over_at is null and returned_at is null and cancelled_at is not null and odometer_start is null and odometer_end is null)
  ),
  constraint rentals_blocking_vehicle_time_exclusion exclude using gist (
    business_id extensions.gist_uuid_ops with =,
    vehicle_id extensions.gist_uuid_ops with =,
    tstzrange(start_at, end_at, '[)') with &&
  ) where (status in ('RESERVED', 'ACTIVE'))
);
-- Actual possession also blocks a second handover after the first window expires.
create unique index rentals_active_vehicle_unique on public.rentals(business_id, vehicle_id) where status = 'ACTIVE';
create index rentals_business_created on public.rentals(business_id, created_at desc, id);
create index rentals_business_status_start on public.rentals(business_id, status, start_at, id);
create index rentals_customer_history on public.rentals(business_id, customer_id, start_at desc, id);
create index rentals_vehicle_history on public.rentals(business_id, vehicle_id, start_at desc, id);

alter table public.customers enable row level security;
alter table public.rentals enable row level security;
revoke all on public.customers, public.rentals from anon, authenticated;
grant select on public.customers, public.rentals to authenticated;
create policy customers_member on public.customers for select to authenticated using (
  exists (select 1 from public.businesses b
    join public.business_memberships m on m.business_id = b.id
    join public.user_profiles p on p.user_id = m.user_id
    where b.id = customers.business_id and b.status = 'ACTIVE'
      and m.user_id = (select auth.uid()) and m.status = 'ACTIVE' and p.status = 'ACTIVE')
);
create policy rentals_member on public.rentals for select to authenticated using (
  exists (select 1 from public.businesses b
    join public.business_memberships m on m.business_id = b.id
    join public.user_profiles p on p.user_id = m.user_id
    where b.id = rentals.business_id and b.status = 'ACTIVE'
      and m.user_id = (select auth.uid()) and m.status = 'ACTIVE' and p.status = 'ACTIVE')
);
