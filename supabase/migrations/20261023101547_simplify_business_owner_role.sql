-- OWNER is the sole business role. PLATFORM_OPERATOR remains an independent grant;
-- a future Customer account receives neither business nor platform membership.
-- Legacy memberships must be explicitly reviewed/removed before this migration.
-- Never promote ADMIN/OPERATIONS or erase domain/audit history implicitly.
do $migration$
begin
  lock table public.business_memberships in access exclusive mode;
  if exists (
    select 1 from public.business_memberships where role_key <> 'OWNER'
  ) then
    raise exception using
      errcode = '23514',
      message = 'Owner-only migration blocked: explicitly resolve all legacy business memberships first';
  end if;

  alter table public.business_memberships
    drop constraint business_memberships_role_key_check;
  alter table public.business_memberships
    add constraint business_memberships_role_key_check check (role_key = 'OWNER');

  drop policy audit_admin on public.audit_logs;
  create policy audit_owner on public.audit_logs for select to authenticated using (
    exists (
      select 1 from public.businesses b
      join public.business_memberships m on m.business_id = b.id
      join public.user_profiles p on p.user_id = m.user_id
      where b.id = audit_logs.business_id and b.status = 'ACTIVE'
        and m.user_id = (select auth.uid()) and m.status = 'ACTIVE'
        and m.role_key = 'OWNER' and p.status = 'ACTIVE'
    )
  );
end
$migration$;
