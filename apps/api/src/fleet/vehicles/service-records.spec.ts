import 'reflect-metadata';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { drizzle } from 'drizzle-orm/pglite';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import * as schema from '../../database/schema.js';
import type { Database } from '../../database/database.js';
import type { TenantContext } from '../../auth/guards.js';
import { PageQuery } from '../../core/dto.js';
import { ServiceRecordCreate, VehicleCreate, VehicleUpdate } from './dto.js';
import { FleetService } from './fleet.service.js';

const options = {
  whitelist: true,
  forbidNonWhitelisted: true,
  forbidUnknownValues: true,
};
let pg: PGlite, service: FleetService;
type Fixture = TenantContext & { vehicleId: string };
let a: Fixture, b: Fixture;
const today = () =>
  new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const create = (body: object) =>
  Object.assign(new ServiceRecordCreate(), body);

async function tenant(name: string): Promise<Fixture> {
  const businessId = randomUUID(),
    userId = randomUUID(),
    membershipId = randomUUID(),
    vehicleId = randomUUID();
  await pg.query('insert into auth.users(id) values($1)', [userId]);
  await pg.query(
    "insert into user_profiles(user_id,display_name) values($1,'Owner')",
    [userId],
  );
  await pg.query('insert into businesses(id,name) values($1,$2)', [
    businessId,
    name,
  ]);
  await pg.query(
    "insert into business_memberships(id,business_id,user_id,role_key) values($1,$2,$3,'OWNER')",
    [membershipId, businessId, userId],
  );
  await pg.query(
    "insert into vehicles(id,business_id,license_plate,make,model) values($1,$2,'AB1234','Kia','Seltos')",
    [vehicleId, businessId],
  );
  return {
    businessId,
    userId,
    membershipId,
    vehicleId,
    role: 'OWNER',
    email: '',
    businessName: name,
  };
}

beforeAll(async () => {
  pg = new PGlite({ extensions: { btree_gist } });
  await pg.exec(
    "create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;",
  );
  for (const f of readdirSync('../../supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await pg.exec(readFileSync('../../supabase/migrations/' + f, 'utf8'));
  service = new FleetService({
    db: drizzle(pg, { schema }),
  } as unknown as Database);
  a = await tenant('A');
  b = await tenant('B');
}, 60000);
afterAll(async () => pg?.close());

describe('vehicle compliance DTOs', () => {
  it('accepts date-only values and null clears; rejects times, bad calendar days and odometers', async () => {
    for (const body of [
      { registrationExpiresOn: '2027-03-31', nextMaintenanceOdometer: 12000 },
      { insuranceExpiresOn: null, nextMaintenanceOn: null },
    ])
      expect(
        await validate(plainToInstance(VehicleUpdate, body), options),
      ).toEqual([]);
    for (const body of [
      { registrationExpiresOn: '2027-03-31T00:00:00Z' },
      { insuranceExpiresOn: '2027-02-30' },
      { nextMaintenanceOn: '1999-12-31' },
      { nextMaintenanceOdometer: -1 },
      { nextMaintenanceOdometer: 1.5 },
    ])
      expect(
        (await validate(plainToInstance(VehicleCreate, { licensePlate: 'AB1234', make: 'x', model: 'y', ...body }), options)).length,
      ).toBeGreaterThan(0);
  });
  it('validates service record payloads strictly', async () => {
    expect(
      await validate(
        plainToInstance(ServiceRecordCreate, {
          kind: 'MAINTENANCE',
          performedOn: '2026-11-01',
          costVnd: '1500000',
          odometer: 15000,
          nextDueOn: '2027-05-01',
        }),
        options,
      ),
    ).toEqual([]);
    for (const body of [
      { kind: 'FUEL', performedOn: '2026-11-01' },
      { kind: 'INSURANCE', performedOn: 'yesterday' },
      { kind: 'INSURANCE', performedOn: '2026-11-01', costVnd: '1.5' },
      { kind: 'INSURANCE', performedOn: '2026-11-01', costVnd: '-1' },
      { kind: 'INSURANCE', performedOn: '2026-11-01', businessId: 'x' },
    ])
      expect(
        (await validate(plainToInstance(ServiceRecordCreate, body), options))
          .length,
      ).toBeGreaterThan(0);
  });
});

describe('vehicle service records', () => {
  it('records history, updates the matching due date atomically and audits field names only', async () => {
    const record = await service.createServiceRecord(
      a,
      a.vehicleId,
      create({
        kind: 'MAINTENANCE',
        performedOn: today(),
        odometer: 15000,
        costVnd: '1500000',
        notes: 'Thay dầu',
        nextDueOn: '2027-05-01',
        nextDueOdometer: 20000,
      }),
      'req',
    );
    expect(record).toMatchObject({ kind: 'MAINTENANCE', costVnd: '1500000' });
    const vehicle = await service.vehicle(a, a.vehicleId);
    expect(vehicle).toMatchObject({
      nextMaintenanceOn: '2027-05-01',
      nextMaintenanceOdometer: 20000,
      registrationExpiresOn: null,
    });
    await service.createServiceRecord(
      a,
      a.vehicleId,
      create({ kind: 'INSURANCE', performedOn: today(), nextDueOn: '2027-12-31' }),
      'req',
    );
    expect(
      (await service.vehicle(a, a.vehicleId)).insuranceExpiresOn,
    ).toBe('2027-12-31');
    const page = await service.listServiceRecords(a, a.vehicleId, new PageQuery());
    expect(page.total).toBe(2);
    const audit = await pg.query<{ metadata: unknown }>(
      "select metadata from audit_logs where business_id=$1 and action='vehicle_service.create'",
      [a.businessId],
    );
    expect(audit.rows).toHaveLength(2);
    expect(JSON.stringify(audit.rows)).not.toContain('Thay dầu');
    expect(JSON.stringify(audit.rows)).not.toContain('1500000');
    const ledger = await pg.query<{ count: number }>(
      'select count(*)::int as count from commercial_movements where business_id=$1',
      [a.businessId],
    );
    expect(ledger.rows[0].count).toBe(0);
  });
  it('rejects future dates, misplaced odometer targets and cross-tenant vehicles', async () => {
    await expect(
      service.createServiceRecord(
        a,
        a.vehicleId,
        create({ kind: 'REGISTRATION', performedOn: '2099-01-01' }),
        'req',
      ),
    ).rejects.toMatchObject({ response: { code: 'SERVICE_DATE_FUTURE' } });
    await expect(
      service.createServiceRecord(
        a,
        a.vehicleId,
        create({ kind: 'INSURANCE', performedOn: today(), nextDueOdometer: 1 }),
        'req',
      ),
    ).rejects.toMatchObject({
      response: { code: 'SERVICE_NEXT_ODOMETER_INVALID' },
    });
    await expect(
      service.createServiceRecord(
        a,
        b.vehicleId,
        create({ kind: 'INSURANCE', performedOn: today() }),
        'req',
      ),
    ).rejects.toMatchObject({ response: { code: 'VEHICLE_NOT_FOUND' } });
    await expect(
      service.listServiceRecords(a, b.vehicleId, new PageQuery()),
    ).rejects.toMatchObject({ response: { code: 'VEHICLE_NOT_FOUND' } });
  });
  it('keeps records append-only and RLS-protected at the database layer', async () => {
    await expect(
      pg.query('delete from vehicle_service_records where business_id=$1', [
        a.businessId,
      ]),
    ).rejects.toThrow();
    await expect(
      pg.query("update vehicle_service_records set notes='x' where business_id=$1", [
        a.businessId,
      ]),
    ).rejects.toThrow();
    const tables = await pg.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where relname='vehicle_service_records'",
    );
    expect(tables.rows[0].relrowsecurity).toBe(true);
    await expect(
      pg.exec('set role authenticated; insert into public.vehicle_service_records(business_id,vehicle_id,kind,performed_on,created_by) select business_id,id,\'INSURANCE\',current_date,id from public.vehicles limit 1;'),
    ).rejects.toThrow();
    await pg.exec('reset role');
  });
  it('rechecks the current membership under the tenant lock', async () => {
    await pg.query("update business_memberships set status='DISABLED' where id=$1", [
      a.membershipId,
    ]);
    await expect(
      service.createServiceRecord(
        a,
        a.vehicleId,
        create({ kind: 'INSURANCE', performedOn: today() }),
        'req',
      ),
    ).rejects.toThrow();
    await pg.query("update business_memberships set status='ACTIVE' where id=$1", [
      a.membershipId,
    ]);
  });
});
