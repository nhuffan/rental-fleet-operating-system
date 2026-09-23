-- Application writes go through the authorized NestJS API; Data API access is read-only and tenant filtered.
create table public.businesses (
 id uuid primary key default gen_random_uuid(), name text not null check (length(trim(name)) between 1 and 120),
 status text not null default 'ACTIVE' check (status in ('ACTIVE','DISABLED')),
 timezone text not null default 'Asia/Ho_Chi_Minh', currency text not null default 'VND' check (currency ~ '^[A-Z]{3}$'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade, display_name text not null default 'User',
 status text not null default 'ACTIVE' check (status in ('ACTIVE','DISABLED')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.business_memberships (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), user_id uuid not null references public.user_profiles(user_id) on delete cascade,
 role_key text not null check (role_key in ('OWNER','ADMIN','OPERATIONS')), status text not null default 'ACTIVE' check (status in ('ACTIVE','DISABLED')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(business_id,user_id)
);
create index memberships_user_business on public.business_memberships(user_id,business_id);
create table public.branches (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
 name text not null check (length(trim(name)) between 1 and 120), address text not null default '' check (length(address)<=500),
 status text not null default 'ACTIVE' check (status in ('ACTIVE','DISABLED')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index branches_business_created on public.branches(business_id,created_at,id);
create table public.business_settings (
 business_id uuid primary key references public.businesses(id), config jsonb not null default '{}'::jsonb check (jsonb_typeof(config)='object'), updated_at timestamptz not null default now()
);
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), actor_user_id uuid not null,
 action text not null, entity_type text not null, entity_id uuid not null, metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'), created_at timestamptz not null default now()
);
-- actor_user_id is a historical identity, intentionally retained if an Auth user is deleted.
create index audit_business_created on public.audit_logs(business_id,created_at desc,id);
alter table public.businesses enable row level security;
alter table public.user_profiles enable row level security;
alter table public.business_memberships enable row level security;
alter table public.branches enable row level security;
alter table public.business_settings enable row level security;
alter table public.audit_logs enable row level security;
revoke all on public.businesses,public.user_profiles,public.business_memberships,public.branches,public.business_settings,public.audit_logs from anon, authenticated;
grant select on public.businesses,public.user_profiles,public.business_memberships,public.branches,public.business_settings,public.audit_logs to authenticated;
-- No SECURITY DEFINER and no recursive membership policy. User sees only their own active membership.
create policy profile_self on public.user_profiles for select to authenticated using (user_id=(select auth.uid()) and status='ACTIVE');
create policy membership_self on public.business_memberships for select to authenticated using (user_id=(select auth.uid()) and status='ACTIVE' and exists(select 1 from public.user_profiles p where p.user_id=business_memberships.user_id and p.status='ACTIVE'));
create policy business_member on public.businesses for select to authenticated using (status='ACTIVE' and exists(select 1 from public.business_memberships m where m.business_id=businesses.id and m.user_id=(select auth.uid()) and m.status='ACTIVE'));
create policy branch_member on public.branches for select to authenticated using (exists(select 1 from public.businesses b join public.business_memberships m on m.business_id=b.id where b.id=branches.business_id and b.status='ACTIVE' and m.user_id=(select auth.uid()) and m.status='ACTIVE'));
create policy settings_member on public.business_settings for select to authenticated using (exists(select 1 from public.businesses b join public.business_memberships m on m.business_id=b.id where b.id=business_settings.business_id and b.status='ACTIVE' and m.user_id=(select auth.uid()) and m.status='ACTIVE'));
create policy audit_admin on public.audit_logs for select to authenticated using (exists(select 1 from public.businesses b join public.business_memberships m on m.business_id=b.id where b.id=audit_logs.business_id and b.status='ACTIVE' and m.user_id=(select auth.uid()) and m.status='ACTIVE' and m.role_key in ('OWNER','ADMIN')));
