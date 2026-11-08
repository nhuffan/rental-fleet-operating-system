import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { denied, type TenantContext } from '../auth/guards.js';
import { permissionsFor } from '../auth/permissions.js';
import { Database } from '../database/database.js';
import { type AlertPageResponse, AlertQuery } from './dto.js';
// One database snapshot bounds both the page and counts. The lateral lookup uses
// the existing assignment/time index and transfers one real fix per assignment,
// never position history. No stored inbox state, synthetic NO_DATA event or write.
const alertSql = `
with snapshot as (select statement_timestamp() as at),
principal as (
 select m.id from public.business_memberships m
 join public.businesses b on b.id=m.business_id
 join public.user_profiles p on p.user_id=m.user_id
 where m.business_id=$1 and m.id=$2 and m.user_id=$3 and m.role_key='OWNER'
 and m.status='ACTIVE' and b.status='ACTIVE' and p.status='ACTIVE'
),
scope as (
 select exists(select 1 from principal) as authorized,
 ($4::uuid is null or exists(select 1 from public.vehicles v where v.business_id=$1 and v.id=$4))
 and ($5::uuid is null or exists(select 1 from public.rentals r where r.business_id=$1 and r.id=$5 and ($4::uuid is null or r.vehicle_id=$4))) as valid
),
rental_alerts as (
 select case when r.end_at<s.at then 'RENTAL_OVERDUE' else 'RENTAL_DUE_SOON' end||':'||r.id::text as id,
 case when r.end_at<s.at then 'RENTAL_OVERDUE' else 'RENTAL_DUE_SOON' end as kind,
 case when r.end_at<s.at then 'CRITICAL' else 'WARNING' end as severity,
 r.vehicle_id as "vehicleId",v.license_plate as "licensePlate",r.id as "rentalId",r.end_at as "dueAt",
 null::timestamptz as "lastSeenAt",null::text as "gpsState",null::text as "sourceMode",
 greatest(0,floor(extract(epoch from s.at-r.end_at)))::bigint as "ageSeconds",r.end_at as reference_at
 from public.rentals r
 join public.vehicles v on v.business_id=r.business_id and v.id=r.vehicle_id
 cross join snapshot s
 where r.business_id=$1 and r.status='ACTIVE' and r.end_at<=s.at+interval '24 hours'
 and ($4::uuid is null or r.vehicle_id=$4) and ($5::uuid is null or r.id=$5)
 and (select authorized and valid from scope)
),
gps_alerts as (
 select 'GPS_STALE:'||a.id::text as id,'GPS_STALE'::text as kind,
 case when p.recorded_at<s.at-interval '600 seconds' then 'CRITICAL' else 'WARNING' end as severity,
 v.id as "vehicleId",v.license_plate as "licensePlate",r.id as "rentalId",null::timestamptz as "dueAt",
 p.recorded_at as "lastSeenAt",
 case when p.recorded_at<s.at-interval '600 seconds' then 'OFFLINE' else 'STALE' end as "gpsState",p.source_mode as "sourceMode",
 greatest(0,floor(extract(epoch from s.at-p.recorded_at)))::bigint as "ageSeconds",p.recorded_at as reference_at
 from public.vehicles v cross join snapshot s
 join public.device_assignments a on a.business_id=v.business_id and a.vehicle_id=v.id and a.unassigned_at is null and a.assigned_at<=s.at
 join public.gps_devices d on d.business_id=v.business_id and d.id=a.device_id and d.status='ACTIVE'
 join lateral (
  select pos.recorded_at,pos.source_mode from public.gps_positions pos
  where pos.business_id=v.business_id and pos.assignment_id=a.id and pos.device_id=a.device_id and pos.vehicle_id=v.id
  and pos.recorded_at>=a.assigned_at and pos.recorded_at<=s.at and pos.source_mode='TEST'
  order by pos.recorded_at desc,pos.received_at asc,pos.id asc limit 1
 ) p on true
 left join public.rentals r on r.business_id=v.business_id and r.vehicle_id=v.id and r.status='ACTIVE'
 where v.business_id=$1 and v.status='ACTIVE' and p.recorded_at<s.at-interval '120 seconds'
 and ($4::uuid is null or v.id=$4) and ($5::uuid is null or r.id=$5)
 and (select authorized and valid from scope)
),
compliance_alerts as (
 select c.kind||':'||v.id::text as id,c.kind,
 case when c.due<(s.at at time zone 'Asia/Ho_Chi_Minh')::date then 'CRITICAL' else 'WARNING' end as severity,
 v.id as "vehicleId",v.license_plate as "licensePlate",null::uuid as "rentalId",
 (c.due::timestamp at time zone 'Asia/Ho_Chi_Minh') as "dueAt",
 null::timestamptz as "lastSeenAt",null::text as "gpsState",null::text as "sourceMode",
 greatest(0,floor(extract(epoch from s.at-(c.due::timestamp at time zone 'Asia/Ho_Chi_Minh'))))::bigint as "ageSeconds",
 (c.due::timestamp at time zone 'Asia/Ho_Chi_Minh') as reference_at
 from public.vehicles v cross join snapshot s
 cross join lateral (values
  ('VEHICLE_REGISTRATION_DUE',v.registration_expires_on),
  ('VEHICLE_INSURANCE_DUE',v.insurance_expires_on),
  ('VEHICLE_MAINTENANCE_DUE',v.next_maintenance_on)
 ) as c(kind,due)
 where v.business_id=$1 and v.status='ACTIVE' and c.due is not null
 and c.due<=(s.at at time zone 'Asia/Ho_Chi_Minh')::date+30
 and ($4::uuid is null or v.id=$4) and $5::uuid is null
 and (select authorized and valid from scope)
),
alerts as (select * from rental_alerts union all select * from gps_alerts union all select * from compliance_alerts),
filtered as (select * from alerts where ($6::text is null or kind=$6) and ($7::text is null or severity=$7)),
page as (
 select id,kind,severity,"vehicleId","licensePlate","rentalId","dueAt","lastSeenAt","gpsState","sourceMode","ageSeconds"
 from filtered order by case when severity='CRITICAL' then 0 else 1 end,reference_at,id limit $8 offset $9
)
select (select authorized from scope) as authorized,(select valid from scope) as valid,
 coalesce((select jsonb_agg(page order by case when severity='CRITICAL' then 0 else 1 end,coalesce("dueAt","lastSeenAt"),id) from page),'[]'::jsonb) as data,(select count(*)::int from filtered) as total,
 (select jsonb_build_object('total',count(*)::int,'critical',count(*) filter(where severity='CRITICAL')::int,'warning',count(*) filter(where severity='WARNING')::int,
 'rentalOverdue',count(*) filter(where kind='RENTAL_OVERDUE')::int,'rentalDueSoon',count(*) filter(where kind='RENTAL_DUE_SOON')::int,'gpsStale',count(*) filter(where kind='GPS_STALE')::int,'vehicleCompliance',count(*) filter(where kind like 'VEHICLE_%')::int) from alerts) as stats,
 (select at from snapshot) as "asOf"`;
@Injectable()
export class AlertsService {
  constructor(@Inject(Database) private readonly database: Database) {}
  async list(c: TenantContext, q: AlertQuery): Promise<AlertPageResponse> {
    if (!permissionsFor(c.role).includes('alert.read'))
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Permission denied',
      });
    const result = await this.database.pool.query<
      Pick<AlertPageResponse, 'data' | 'total' | 'stats'> & {
        asOf: Date;
        authorized: boolean;
        valid: boolean;
      }
    >(alertSql, [
      c.businessId,
      c.membershipId,
      c.userId,
      q.vehicleId ?? null,
      q.rentalId ?? null,
      q.kind ?? null,
      q.severity ?? null,
      q.limit,
      (q.page - 1) * q.limit,
    ]);
    const row = result.rows[0];
    if (!row.authorized) throw denied();
    if (!row.valid)
      throw new NotFoundException({
        code: 'ALERT_SCOPE_NOT_FOUND',
        message: 'Alert filter resource not found in this business',
      });
    return {
      data: row.data,
      total: row.total,
      stats: row.stats,
      asOf: row.asOf.toISOString(),
      page: q.page,
      limit: q.limit,
      rules: {
        dueSoonSeconds: 86400,
        complianceWarningDays: 30,
        gpsStaleAfterSeconds: 120,
        gpsOfflineAfterSeconds: 600,
      },
      pollAfterSeconds: 60,
    };
  }
}
