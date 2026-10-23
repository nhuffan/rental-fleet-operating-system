import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Database } from '../../database/database.js';
import type { TenantContext } from '../../auth/guards.js';
import { permissionsFor } from '../../auth/permissions.js';
import { HISTORY_DAYS, type NormalizedTelemetry } from './traccar.adapter.js';
import {
  LocationQuery,
  type LocationPage,
  type LocationResponse,
  type TelemetryDiagnosticsResponse,
} from './dto.js';
import { GPS_INGRESS_LIMITS } from './ingress.js';
const conflict = (code: string) =>
  new ConflictException({ code, message: 'GPS event cannot be resolved' });
@Injectable()
export class GpsService {
  constructor(@Inject(Database) private readonly database: Database) {}
  async ingest(e: NormalizedTelemetry) {
    const tx = await this.database.pool.connect();
    try {
      await tx.query('begin');
      const registered = await tx.query<{ id: string; business_id: string }>(
        'select id,business_id from public.gps_devices where provider=$1 and device_uid=$2',
        [e.provider, e.deviceUid],
      );
      const device = registered.rows[0];
      if (!device) throw conflict('GPS_DEVICE_UNKNOWN');
      // Shared tenant lock serializes with assignment/end/disable and admin mutations.
      const business = await tx.query(
        'select status from public.businesses where id=$1 for update',
        [device.business_id],
      );
      const active = await tx.query(
        'select status from public.gps_devices where business_id=$1 and id=$2',
        [device.business_id, device.id],
      );
      if (
        business.rows[0]?.status !== 'ACTIVE' ||
        active.rows[0]?.status !== 'ACTIVE'
      )
        throw conflict('GPS_DEVICE_INACTIVE');
      const now = (
        await tx.query<{ now: Date }>('select clock_timestamp() as now')
      ).rows[0].now;
      if (
        e.recordedAt.getTime() > now.getTime() + 300000 ||
        e.recordedAt.getTime() < now.getTime() - HISTORY_DAYS * 86400000
      )
        throw conflict('GPS_TIME_OUTSIDE_WINDOW');
      const assignment = await tx.query<{ id: string; vehicle_id: string }>(
        `select id,vehicle_id from public.device_assignments where business_id=$1 and device_id=$2 and assigned_at<=$3 and (unassigned_at is null or unassigned_at>$3) limit 2`,
        [device.business_id, device.id, e.recordedAt],
      );
      if (assignment.rowCount !== 1)
        throw conflict('GPS_ASSIGNMENT_UNRESOLVED');
      const a = assignment.rows[0];
      const result = await tx.query<{ id: string }>(
        `insert into public.gps_positions (business_id,assignment_id,device_id,vehicle_id,provider,device_uid,event_key,source_event_id,recorded_at,latitude,longitude,speed_kph,heading,ignition)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) on conflict (device_id,event_key) do nothing returning id`,
        [
          device.business_id,
          a.id,
          device.id,
          a.vehicle_id,
          e.provider,
          e.deviceUid,
          e.eventKey,
          e.sourceEventId,
          e.recordedAt,
          e.latitude,
          e.longitude,
          e.speedKph,
          e.heading,
          e.ignition,
        ],
      );
      const row =
        result.rows[0] ??
        (
          await tx.query<{ id: string }>(
            'select id from public.gps_positions where business_id=$1 and device_id=$2 and event_key=$3',
            [device.business_id, device.id, e.eventKey],
          )
        ).rows[0];
      await tx.query('commit');
      return { duplicate: result.rowCount === 0, positionId: row.id };
    } catch (error) {
      await tx.query('rollback');
      throw error;
    } finally {
      tx.release();
    }
  }
  async list(
    c: TenantContext,
    q: LocationQuery,
    vehicleId?: string,
  ): Promise<LocationPage> {
    // Lateral LIMIT 1 uses the assignment/time index: no full-history download or
    // arrival-time overwrite. A replacement assignment immediately hides old points.
    const base = `select v.id as "vehicleId",v.license_plate as "licensePlate",v.make,v.model,d.id as "deviceId",
   case when a.id is null then 'UNASSIGNED' when p.id is null then 'NO_DATA'
    when p.recorded_at >= statement_timestamp()-interval '120 seconds' then 'FRESH'
    when p.recorded_at >= statement_timestamp()-interval '600 seconds' then 'STALE' else 'OFFLINE' end as state,
   p.recorded_at as "lastSeenAt",
   case when p.id is null then null else jsonb_build_object('latitude',p.latitude,'longitude',p.longitude,'speedKph',p.speed_kph,'heading',p.heading,'ignition',p.ignition,'recordedAt',p.recorded_at,'receivedAt',p.received_at,'sourceMode',p.source_mode) end as location,
   (select r.id from public.rentals r where r.business_id=v.business_id and r.vehicle_id=v.id and r.status='ACTIVE' and $5::boolean limit 1) as "currentRentalId"
   from public.vehicles v
   left join public.device_assignments a on a.business_id=v.business_id and a.vehicle_id=v.id and a.unassigned_at is null
   left join public.gps_devices d on d.business_id=v.business_id and d.id=a.device_id
   left join lateral (select * from public.gps_positions pos where pos.business_id=v.business_id and pos.assignment_id=a.id order by pos.recorded_at desc,pos.received_at asc,pos.id asc limit 1) p on true
   where v.business_id=$1 and ($2::uuid is null or v.id=$2)`;
    const pattern = '%' + (q.search ?? '').replace(/[\\%_]/g, '\\$&') + '%';
    const params = [
      c.businessId,
      vehicleId ?? null,
      pattern,
      q.state ?? null,
      permissionsFor(c.role).includes('rental.read'),
    ];
    const result = await this.database.pool.query<{
      data: LocationResponse[];
      total: number;
      stats: LocationPage['stats'];
      asOf: string;
    }>(
      `with locations as (${base}), filtered as (select * from locations where ("licensePlate"||' '||make||' '||model) ilike $3 and ($4::text is null or state=$4)), page as (select * from filtered order by "licensePlate","vehicleId" limit $6 offset $7)
   select coalesce((select jsonb_agg(page) from page),'[]'::jsonb) as data,(select count(*)::int from filtered) as total,
   (select jsonb_build_object('FRESH',count(*) filter(where state='FRESH'),'STALE',count(*) filter(where state='STALE'),'OFFLINE',count(*) filter(where state='OFFLINE'),'NO_DATA',count(*) filter(where state='NO_DATA'),'UNASSIGNED',count(*) filter(where state='UNASSIGNED')) from locations) as stats,statement_timestamp() as "asOf"`,
      [...params, q.limit, (q.page - 1) * q.limit],
    );
    const row = result.rows[0];
    return { ...row, page: q.page, limit: q.limit, pollAfterSeconds: 20 };
  }
  async diagnostics(c: TenantContext): Promise<TelemetryDiagnosticsResponse> {
    const [locations, recent] = await Promise.all([
      this.list(c, Object.assign(new LocationQuery(), { limit: 1 })),
      this.database.pool.query<{
        positions: number;
        devices: number;
        lastReceivedAt: Date | null;
        lastRecordedAt: Date | null;
      }>(
        `
        select count(*)::int as positions,count(distinct device_id)::int as devices,
          max(received_at) as "lastReceivedAt",max(recorded_at) as "lastRecordedAt"
        from public.gps_positions where business_id=$1 and received_at>=statement_timestamp()-interval '15 minutes'`,
        [c.businessId],
      ),
    ]);
    const row = recent.rows[0];
    return {
      asOf: new Date().toISOString(),
      sourceMode: 'TEST',
      ingestionEnabled: (process.env.GPS_TRACCAR_TOKEN?.length ?? 0) >= 32,
      recent: {
        windowSeconds: 900,
        positions: row.positions,
        devices: row.devices,
        lastReceivedAt: row.lastReceivedAt?.toISOString() ?? null,
        lastRecordedAt: row.lastRecordedAt?.toISOString() ?? null,
      },
      freshness: locations.stats,
      limits: { ...GPS_INGRESS_LIMITS },
      limiterScope: 'PROCESS_LOCAL',
      failureReporting: 'INTERNAL_AGGREGATE_LOGS',
    };
  }
  async get(c: TenantContext, id: string) {
    const p = await this.list(
      c,
      Object.assign(new LocationQuery(), { limit: 1 }),
      id,
    );
    if (!p.data[0])
      throw new NotFoundException({
        code: 'VEHICLE_NOT_FOUND',
        message: 'Vehicle not found',
      });
    return p.data[0];
  }
}
