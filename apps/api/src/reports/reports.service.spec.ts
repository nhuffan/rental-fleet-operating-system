import 'reflect-metadata';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { drizzle } from 'drizzle-orm/pglite';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import * as schema from '../database/schema.js';
import type { Database } from '../database/database.js';
import type { TenantContext } from '../auth/guards.js';
import { CommercialService } from '../commercial/commercial.service.js';
import { ReportsService } from './reports.service.js';

let pg: PGlite, service: ReportsService;
type Fixture = TenantContext & { v: string };
let a: Fixture, b: Fixture;
const q = { from: '2026-10-01T00:00:00+07:00', until: '2026-11-01T00:00:00+07:00' };

async function tenant(name: string): Promise<Fixture> {
  const businessId = randomUUID(),
    userId = randomUUID(),
    v = randomUUID(),
    customer = randomUUID(),
    membershipId = randomUUID();
  await pg.query('insert into auth.users(id) values($1)', [userId]);
  await pg.query(
    "insert into user_profiles(user_id,display_name) values($1,'Owner')",
    [userId],
  );
  await pg.query("insert into businesses(id,name) values($1,$2)", [
    businessId,
    name,
  ]);
  await pg.query(
    "insert into business_memberships(id,business_id,user_id,role_key) values($1,$2,$3,'OWNER')",
    [membershipId, businessId, userId],
  );
  await pg.query(
    "insert into vehicles(id,business_id,license_plate,make,model) values($1,$2,$3,'Toyota','=Vios')",
    [v, businessId, 'T' + businessId.slice(0, 6).toUpperCase().replace(/-/g, '0')],
  );
  await pg.query(
    "insert into customers(id,business_id,name,phone,id_number) values($1,$2,'Khach','0900000000','0123456789')",
    [customer, businessId],
  );
  // Completed rental occupying 10 of the 31 days; payment 1,000,000 and expense 200,000.
  const rental = randomUUID();
  await pg.query(
    "insert into rentals(id,business_id,customer_id,vehicle_id,start_at,end_at,status,reserved_at,handed_over_at,returned_at,odometer_start,odometer_end,rental_amount) values($1,$2,$3,$4,'2026-10-05T00:00:00+07:00','2026-10-15T00:00:00+07:00','COMPLETED','2026-10-01T00:00:00+07:00','2026-10-05T00:00:00+07:00','2026-10-15T00:00:00+07:00',100,200,1000000)",
    [rental, businessId, customer, v],
  );
  const movement = (kind: string, category: string, amount: number) =>
    pg.query(
      "insert into commercial_movements(business_id,vehicle_id,rental_id,kind,category,amount,occurred_at,created_by) values($1,$2,$3,$4,$5,$6,'2026-10-10T00:00:00+07:00',$7)",
      [
        businessId,
        v,
        kind === 'EXPENSE' ? null : rental,
        kind,
        category,
        amount,
        userId,
      ],
    );
  await movement('RENTAL_PAYMENT', 'RENTAL', 1000000);
  await movement('EXPENSE', 'FUEL', 200000);
  return {
    businessId,
    userId,
    membershipId,
    role: 'OWNER',
    email: '',
    businessName: name,
    v,
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
  const database = { db: drizzle(pg, { schema }) } as unknown as Database;
  service = new ReportsService(database, new CommercialService(database));
  a = await tenant('A');
  b = await tenant('B');
}, 60000);
afterAll(async () => pg?.close());

describe('ReportsService against the replayed schema', () => {
  it('summarizes exact VND, monthly series, utilization and scopes to the tenant', async () => {
    const s = await service.summary(a, q);
    expect(s).toMatchObject({
      recordedRevenue: '1000000',
      operatingExpenses: '200000',
      estimatedProfit: '800000',
      activeVehicles: 1,
    });
    expect(s.months).toEqual([
      {
        month: '2026-10',
        revenue: '1000000',
        expenses: '200000',
        estimatedProfit: '800000',
      },
    ]);
    expect(s.rentalsByStatus).toEqual([{ status: 'COMPLETED', count: 1 }]);
    expect(s.vehicles).toHaveLength(1);
    expect(s.vehicles[0]).toMatchObject({
      revenue: '1000000',
      rentedHours: 240,
      utilizationPercent: 32.3,
    });
    expect(s.fleetUtilizationPercent).toBe(32.3);
    expect(s.vehicles[0].vehicleId).toBe(a.v);
  });
  it('exports tenant-scoped CSV without identity numbers and neutralizes formulas', async () => {
    const vehicles = await service.exportCsv(a, 'vehicles', {}, 'req');
    expect(vehicles).toContain("'=Vios");
    expect(vehicles.match(/Toyota/g)).toHaveLength(1);
    const customers = await service.exportCsv(a, 'customers', {}, 'req');
    expect(customers).toContain('Khach');
    expect(customers).not.toContain('0123456789');
    const rentals = await service.exportCsv(a, 'rentals', q, 'req');
    expect(rentals).toContain('COMPLETED');
    const movements = await service.exportCsv(a, 'movements', q, 'req');
    expect(movements.split('\r\n').filter(Boolean)).toHaveLength(3);
    expect(movements).not.toContain(b.businessId);
  });
  it('audits exports with the field name only and denies a disabled business', async () => {
    const audit = await pg.query<{ metadata: { fields: string[] } }>(
      "select metadata from audit_logs where business_id=$1 and action='report.export'",
      [a.businessId],
    );
    expect(audit.rows.length).toBeGreaterThanOrEqual(4);
    expect(JSON.stringify(audit.rows)).not.toContain('Khach');
    await pg.query("update businesses set status='DISABLED' where id=$1", [
      b.businessId,
    ]);
    await expect(service.exportCsv(b, 'vehicles', {}, 'req')).rejects.toThrow();
    await pg.query("update businesses set status='ACTIVE' where id=$1", [
      b.businessId,
    ]);
  });
  it('rejects non-Owner roles', async () => {
    await expect(
      service.summary({ ...a, role: 'CUSTOMER' }, q),
    ).rejects.toThrow();
  });
});
