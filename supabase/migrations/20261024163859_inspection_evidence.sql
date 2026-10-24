-- Binary content stays in private Storage. The API owns bounded staging,
-- verification and attachment in the milestone transaction, under a tenant lock.
-- Historical uploader UUIDs deliberately survive Auth/profile deletion.
alter table public.rental_inspections add constraint rental_inspections_evidence_identity_unique
  unique (business_id, id, rental_id, vehicle_id, type);

create table public.inspection_uploads (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  rental_id uuid not null,
  vehicle_id uuid not null,
  type text not null,
  kind text not null,
  category text not null,
  uploaded_by uuid not null,
  idempotency_key uuid not null,
  status text not null default 'PENDING',
  bucket text not null,
  pending_key text not null,
  object_key text not null,
  declared_mime text not null,
  declared_bytes integer not null,
  mime_type text,
  bytes integer,
  width integer,
  height integer,
  duration_seconds double precision,
  expires_at timestamptz not null,
  hold_until timestamptz,
  verified_at timestamptz,
  lease_until timestamptz,
  reserved_bytes integer not null,
  created_at timestamptz not null default now(),
  constraint inspection_uploads_rental_tenant_fk foreign key (business_id, rental_id, vehicle_id)
    references public.rentals(business_id, id, vehicle_id) on delete restrict,
  constraint inspection_uploads_idempotency_unique unique (business_id, uploaded_by, idempotency_key),
  constraint inspection_uploads_identity_unique unique (business_id, id, rental_id, vehicle_id, type),
  constraint inspection_uploads_pending_unique unique (bucket, pending_key),
  constraint inspection_uploads_object_unique unique (bucket, object_key),
  constraint inspection_uploads_type_check check (type in ('HANDOVER', 'RETURN')),
  constraint inspection_uploads_kind_check check (kind in ('IMAGE', 'VIDEO')),
  constraint inspection_uploads_category_check check (category in ('FRONT', 'REAR', 'LEFT', 'RIGHT', 'INTERIOR', 'DASHBOARD', 'DAMAGE', 'OTHER')),
  constraint inspection_uploads_status_check check (status in ('PENDING', 'VERIFYING', 'VERIFIED', 'ATTACHED', 'CANCELLED', 'REJECTED', 'PURGED')),
  constraint inspection_uploads_declared_check check (
    (kind = 'IMAGE' and bucket = 'inspection-images' and declared_mime in ('image/jpeg', 'image/webp') and declared_bytes between 1 and 1048576) or
    (kind = 'VIDEO' and bucket = 'inspection-videos' and declared_mime in ('video/mp4', 'video/webm') and declared_bytes between 1 and 12582912)
  ),
  constraint inspection_uploads_paths_check check (
    pending_key = 'b/' || business_id::text || '/rentals/' || rental_id::text || '/' || type || '/pending/' || id::text || '.' ||
      case declared_mime when 'image/jpeg' then 'jpg' when 'image/webp' then 'webp' when 'video/mp4' then 'mp4' when 'video/webm' then 'webm' end
    and object_key = 'b/' || business_id::text || '/rentals/' || rental_id::text || '/' || type || '/evidence/' || id::text || '.' ||
      case declared_mime when 'image/jpeg' then 'jpg' when 'image/webp' then 'webp' when 'video/mp4' then 'mp4' when 'video/webm' then 'webm' end
  ),
  constraint inspection_uploads_actual_check check (
    (mime_type is null or mime_type = declared_mime) and
    (bytes is null or (bytes > 0 and bytes <= case kind when 'IMAGE' then 1048576 else 12582912 end)) and
    (width is null or width between 1 and 1920) and (height is null or height between 1 and 1920) and
    (duration_seconds is null or (kind = 'VIDEO' and duration_seconds > 0 and duration_seconds <= 30))
  ),
  constraint inspection_uploads_verified_check check (
    status not in ('VERIFIED', 'ATTACHED') or
    (mime_type is not null and bytes is not null and width is not null and height is not null and verified_at is not null and
      ((kind = 'IMAGE' and duration_seconds is null) or (kind = 'VIDEO' and duration_seconds is not null)))
  ),
  constraint inspection_uploads_reservation_check check (reserved_bytes between 0 and 25165824),
  constraint inspection_uploads_time_check check (
    isfinite(created_at) and isfinite(expires_at) and
    (hold_until is null or isfinite(hold_until)) and
    (verified_at is null or isfinite(verified_at)) and
    (lease_until is null or isfinite(lease_until))
  )
);
create index inspection_uploads_milestone on public.inspection_uploads (business_id, rental_id, type, status);
create index inspection_uploads_cleanup on public.inspection_uploads (hold_until, id) where hold_until is not null;

create table public.inspection_evidence (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete restrict,
  rental_id uuid not null,
  vehicle_id uuid not null,
  inspection_id uuid not null,
  type text not null,
  kind text not null,
  category text not null,
  uploaded_by uuid not null,
  bucket text not null,
  object_key text not null,
  mime_type text not null,
  bytes integer not null,
  width integer not null,
  height integer not null,
  duration_seconds double precision,
  created_at timestamptz not null default now(),
  constraint inspection_evidence_inspection_tenant_fk foreign key (business_id, inspection_id, rental_id, vehicle_id, type)
    references public.rental_inspections(business_id, id, rental_id, vehicle_id, type) on delete restrict,
  constraint inspection_evidence_upload_tenant_fk foreign key (business_id, id, rental_id, vehicle_id, type)
    references public.inspection_uploads(business_id, id, rental_id, vehicle_id, type) on delete restrict,
  constraint inspection_evidence_object_unique unique (bucket, object_key),
  constraint inspection_evidence_type_check check (type in ('HANDOVER', 'RETURN')),
  constraint inspection_evidence_category_check check (category in ('FRONT', 'REAR', 'LEFT', 'RIGHT', 'INTERIOR', 'DASHBOARD', 'DAMAGE', 'OTHER')),
  constraint inspection_evidence_media_check check (
    (kind = 'IMAGE' and bucket = 'inspection-images' and mime_type in ('image/jpeg', 'image/webp') and bytes between 1 and 1048576 and duration_seconds is null) or
    (kind = 'VIDEO' and bucket = 'inspection-videos' and mime_type in ('video/mp4', 'video/webm') and bytes between 1 and 12582912 and duration_seconds is not null and duration_seconds > 0 and duration_seconds <= 30)
  ),
  constraint inspection_evidence_dimensions_check check (width between 1 and 1920 and height between 1 and 1920),
  constraint inspection_evidence_path_check check (
    object_key = 'b/' || business_id::text || '/rentals/' || rental_id::text || '/' || type || '/evidence/' || id::text || '.' ||
      case mime_type when 'image/jpeg' then 'jpg' when 'image/webp' then 'webp' when 'video/mp4' then 'mp4' when 'video/webm' then 'webm' end
  ),
  constraint inspection_evidence_time_check check (isfinite(created_at))
);
create index inspection_evidence_rental on public.inspection_evidence (business_id, rental_id, type, created_at, id);
create index inspection_evidence_vehicle on public.inspection_evidence (business_id, vehicle_id, created_at desc, id);
create index inspection_evidence_inspection on public.inspection_evidence (business_id, inspection_id, rental_id, vehicle_id, type);

create function public.prevent_inspection_evidence_mutation() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  raise exception using errcode = '23001', constraint = 'inspection_evidence_immutable',
    message = 'Inspection evidence is immutable';
end
$$;
revoke all on function public.prevent_inspection_evidence_mutation() from PUBLIC, anon, authenticated;
create trigger inspection_evidence_immutable before update or delete on public.inspection_evidence
  for each row execute function public.prevent_inspection_evidence_mutation();

alter table public.inspection_uploads enable row level security;
alter table public.inspection_evidence enable row level security;
revoke all on public.inspection_uploads, public.inspection_evidence from PUBLIC, anon, authenticated;
grant select on public.inspection_uploads, public.inspection_evidence to authenticated;
create policy inspection_uploads_owner on public.inspection_uploads for select to authenticated using (
  uploaded_by = (select auth.uid()) and exists (
    select 1 from public.businesses b
    join public.business_memberships m on m.business_id = b.id
    join public.user_profiles p on p.user_id = m.user_id
    where b.id = inspection_uploads.business_id and b.status = 'ACTIVE'
      and m.user_id = (select auth.uid()) and m.status = 'ACTIVE'
      and m.role_key = 'OWNER' and p.status = 'ACTIVE'
  )
);
create policy inspection_evidence_owner on public.inspection_evidence for select to authenticated using (
  exists (
    select 1 from public.businesses b
    join public.business_memberships m on m.business_id = b.id
    join public.user_profiles p on p.user_id = m.user_id
    where b.id = inspection_evidence.business_id and b.status = 'ACTIVE'
      and m.user_id = (select auth.uid()) and m.status = 'ACTIVE'
      and m.role_key = 'OWNER' and p.status = 'ACTIVE'
  )
);
-- Private bucket provisioning uses the Storage API, not direct storage schema DDL.
-- No browser object policies are added: only scoped signed capabilities can read/write.
