-- A Customer portal identity is a Supabase Auth user + active profile linked to exactly one
-- tenant customer record. It is deliberately NOT a business or platform membership and has
-- no Data API grants: the NestJS portal API authorizes every read against this link.
create table public.customer_portal_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  customer_id uuid not null,
  user_id uuid not null references public.user_profiles(user_id) on delete cascade,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  constraint customer_portal_accounts_customer_tenant_fk foreign key (business_id, customer_id)
    references public.customers(business_id, id) on delete restrict,
  constraint customer_portal_accounts_customer_unique unique (business_id, customer_id),
  constraint customer_portal_accounts_user_unique unique (user_id)
);
alter table public.customer_portal_accounts enable row level security;
revoke all on public.customer_portal_accounts from PUBLIC, anon, authenticated;
