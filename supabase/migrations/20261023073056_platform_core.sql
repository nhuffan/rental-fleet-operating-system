-- Platform authorization is independent of tenant memberships and Auth metadata.
-- Only trusted backend code can inspect either platform table.
create table public.platform_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(user_id) on delete cascade,
  role_key text not null default 'PLATFORM_OPERATOR',
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_memberships_user_unique unique (user_id),
  constraint platform_memberships_role_check check (role_key = 'PLATFORM_OPERATOR'),
  constraint platform_memberships_status_check check (status in ('ACTIVE', 'DISABLED'))
);

create table public.platform_audit_logs (
  id uuid primary key default gen_random_uuid(),
  -- Historical identity deliberately survives Auth/profile deletion, like tenant audit.
  actor_user_id uuid not null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint platform_audit_action_check check (length(trim(action)) between 1 and 80),
  constraint platform_audit_entity_type_check check (length(trim(entity_type)) between 1 and 80),
  constraint platform_audit_metadata_check check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 4096)
);
create index platform_audit_created on public.platform_audit_logs(created_at desc, id);
create index platform_audit_actor_created on public.platform_audit_logs(actor_user_id, created_at desc, id);

alter table public.platform_memberships enable row level security;
alter table public.platform_audit_logs enable row level security;
revoke all on public.platform_memberships, public.platform_audit_logs from public, anon, authenticated;
-- No policies and no browser SELECT grant: even operators go through platform API guards.
