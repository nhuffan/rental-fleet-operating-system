-- Immutable through the API: correction inserts one equal-and-opposite reversal.
-- VND is persisted in whole dong. API rejects fractional input rather than rounding;
-- positive amounts derive direction from kind and reversal_of, never an amount sign.
alter table public.rentals add constraint rentals_business_id_id_vehicle_unique
  unique (business_id, id, vehicle_id);

create table public.commercial_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  vehicle_id uuid,
  rental_id uuid,
  kind text not null,
  category text not null,
  amount numeric(18,0) not null,
  occurred_at timestamptz not null,
  reference text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid not null,
  reversal_of uuid,
  constraint commercial_movements_business_id_id_unique unique (business_id, id),
  constraint commercial_movements_reversal_unique unique (reversal_of),
  constraint commercial_movements_vehicle_tenant_fk foreign key (business_id, vehicle_id)
    references public.vehicles(business_id, id) on delete restrict,
  constraint commercial_movements_rental_tenant_fk foreign key (business_id, rental_id, vehicle_id)
    references public.rentals(business_id, id, vehicle_id) on delete restrict,
  constraint commercial_movements_reversal_tenant_fk foreign key (business_id, reversal_of)
    references public.commercial_movements(business_id, id) on delete restrict,
  constraint commercial_movements_kind_check check (
    kind in ('RENTAL_PAYMENT', 'MISC_INCOME', 'DEPOSIT_RECEIPT', 'DEPOSIT_REFUND', 'DEPOSIT_RETAIN', 'EXPENSE')
  ),
  constraint commercial_movements_category_check check (
    (kind = 'RENTAL_PAYMENT' and category = 'RENTAL') or
    (kind = 'MISC_INCOME' and category = 'OTHER_INCOME') or
    (kind in ('DEPOSIT_RECEIPT', 'DEPOSIT_REFUND', 'DEPOSIT_RETAIN') and category = 'DEPOSIT') or
    (kind = 'EXPENSE' and category in ('FUEL', 'MAINTENANCE', 'TOLL', 'INSURANCE', 'OTHER_EXPENSE'))
  ),
  constraint commercial_movements_amount_check check (
    amount > 0 and amount <= 999999999999999 and amount <> 'NaN'::numeric
  ),
  constraint commercial_movements_time_check check (isfinite(occurred_at) and isfinite(created_at)),
  constraint commercial_movements_reference_check check (length(reference) <= 160),
  constraint commercial_movements_notes_check check (length(notes) <= 2000),
  constraint commercial_movements_rental_vehicle_check check (rental_id is null or vehicle_id is not null),
  constraint commercial_movements_rental_required_check check (
    kind in ('MISC_INCOME', 'EXPENSE') or rental_id is not null
  ),
  constraint commercial_movements_reversal_self_check check (reversal_of is null or reversal_of <> id)
);
create index commercial_movements_business_occurred on public.commercial_movements(business_id, occurred_at desc, id);
create index commercial_movements_vehicle_occurred on public.commercial_movements(business_id, vehicle_id, occurred_at desc, id);
create index commercial_movements_rental_occurred on public.commercial_movements(business_id, rental_id, vehicle_id, occurred_at desc, id);
create index commercial_movements_category_occurred on public.commercial_movements(business_id, category, occurred_at desc, id);

-- No actor FK: historical financial attribution survives identity/profile removal.
-- No SECURITY DEFINER helper. The trigger validates accounting shape only; API guards
-- recheck authorization and rental deposit balances under the existing business lock.
create function public.validate_commercial_reversal() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  original public.commercial_movements%rowtype;
begin
  if new.reversal_of is not null then
    select * into original from public.commercial_movements
      where business_id = new.business_id and id = new.reversal_of;
    if not found then
      raise exception using errcode = '23503', constraint = 'commercial_movements_reversal_tenant_fk', message = 'Original movement unavailable';
    end if;
    if original.reversal_of is not null or
      new.kind <> original.kind or new.category <> original.category or
      new.amount <> original.amount or
      new.vehicle_id is distinct from original.vehicle_id or
      new.rental_id is distinct from original.rental_id or
      new.occurred_at < original.occurred_at then
      raise exception using errcode = '23514', constraint = 'commercial_movements_reversal_mirror_check', message = 'Invalid movement reversal';
    end if;
  end if;
  return new;
end
$$;
revoke all on function public.validate_commercial_reversal() from PUBLIC, anon, authenticated;
create trigger commercial_movements_validate_reversal before insert on public.commercial_movements
  for each row execute function public.validate_commercial_reversal();

alter table public.commercial_movements enable row level security;
revoke all on public.commercial_movements from PUBLIC, anon, authenticated;
grant select on public.commercial_movements to authenticated;
create policy commercial_movements_owner on public.commercial_movements for select to authenticated using (
  exists (
    select 1 from public.businesses b
    join public.business_memberships m on m.business_id = b.id
    join public.user_profiles p on p.user_id = m.user_id
    where b.id = commercial_movements.business_id and b.status = 'ACTIVE'
      and m.user_id = (select auth.uid()) and m.status = 'ACTIVE'
      and m.role_key = 'OWNER' and p.status = 'ACTIVE'
  )
);
