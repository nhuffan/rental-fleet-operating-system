import 'reflect-metadata';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { drizzle } from 'drizzle-orm/pglite';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { AuthGuard, PermissionGuard, TenantGuard } from '../auth/guards.js';
import type { TenantContext } from '../auth/guards.js';
import { permissionsFor } from '../auth/permissions.js';
import { PageQuery } from '../core/dto.js';
import * as schema from '../database/schema.js';
import type { Database } from '../database/database.js';
import type { AuthAdminService } from '../platform/auth-admin.service.js';
import { CustomerGuard } from './guards.js';
import { PortalAccessController } from './portal-access.controller.js';
import { PortalAccessService } from './portal-access.service.js';
import { PortalController } from './portal.controller.js';
import { PortalService } from './portal.service.js';

let pg: PGlite, portal: PortalService, access: PortalAccessService;
let guard: CustomerGuard;
const NIL = '00000000-0000-0000-0000-000000000000';
const rid = () => randomUUID();

type Tenant = TenantContext & {
  vehicleId: string;
  customerId: string;
  noEmailCustomerId: string;
};
async function tenant(name: string): Promise<Tenant> {
  const businessId = rid(),
    userId = rid(),
    membershipId = rid(),
    vehicleId = rid();
  await pg.query('insert into auth.users(id,email) values($1,$2)', [
    userId,
    `owner-${userId}@example.test`,
  ]);
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
  const customerId = rid(),
    noEmailCustomerId = rid();
  await pg.query(
    "insert into customers(id,business_id,name,phone,email) values($1,$2,'Khách A','0900000000',$3),($4,$2,'Khách B','0900000001','')",
    [customerId, businessId, `khach-${customerId}@example.test`, noEmailCustomerId],
  );
  return {
    businessId,
    userId,
    membershipId,
    role: 'OWNER',
    email: '',
    businessName: name,
    vehicleId,
    customerId,
    noEmailCustomerId,
  };
}
async function rental(
  t: Tenant,
  customerId: string,
  status: 'DRAFT' | 'RESERVED' | 'CANCELLED',
  day: number,
) {
  const id = rid();
  const reserved = status === 'RESERVED' ? "'2026-01-01T00:00:00Z'" : 'null';
  const cancelled = status === 'CANCELLED' ? "'2026-01-01T00:00:00Z'" : 'null';
  await pg.query(
    `insert into rentals(id,business_id,customer_id,vehicle_id,start_at,end_at,status,reserved_at,cancelled_at,notes)
     values($1,$2,$3,$4,$5,$6,$7,${reserved},${cancelled},'internal note')`,
    [
      id,
      t.businessId,
      customerId,
      t.vehicleId,
      `2027-0${day}-01T00:00:00Z`,
      `2027-0${day}-02T00:00:00Z`,
      status,
    ],
  );
  return id;
}
async function contract(t: Tenant, rentalId: string, seq: number) {
  const snapshot = {
    schemaVersion: 1,
    business: { name: 'B', currency: 'VND' },
    customer: { name: 'Khách A' },
    vehicle: { licensePlate: 'AB1234' },
    rental: { id: rentalId },
    pricing: {
      id: rid(),
      mode: 'OVERRIDE',
      createdBy: rid(),
      overrideReason: 'secret reason',
      agreedAmount: '1000000',
    },
    terms: '',
    missing: [],
  };
  await pg.query(
    `insert into rental_contract_documents(business_id,rental_id,seq,doc_number,version,content_hash,snapshot,issued_by)
     values($1,$2,$3,$4,1,$5,$6,$7)`,
    [
      t.businessId,
      rentalId,
      seq,
      `HD-2027-${String(seq).padStart(6, '0')}`,
      'a'.repeat(64),
      JSON.stringify(snapshot),
      t.userId,
    ],
  );
}
// A portal identity exactly as the Owner flow would create it.
async function portalUser(t: Tenant, customerId: string) {
  const userId = rid();
  await pg.query('insert into auth.users(id,email) values($1,$2)', [
    userId,
    `portal-${userId}@example.test`,
  ]);
  await pg.query(
    "insert into user_profiles(user_id,display_name) values($1,'Customer')",
    [userId],
  );
  await pg.query(
    'insert into customer_portal_accounts(business_id,customer_id,user_id,created_by) values($1,$2,$3,$4)',
    [t.businessId, customerId, userId, t.userId],
  );
  return userId;
}

let a: Tenant, b: Tenant;
beforeAll(async () => {
  pg = new PGlite({ extensions: { btree_gist } });
  await pg.exec(
    "create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;",
  );
  for (const f of readdirSync('../../supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await pg.exec(readFileSync('../../supabase/migrations/' + f, 'utf8'));
  const pool = {
    query: (text: string, values?: unknown[]) => pg.query(text, values),
    connect: async () => ({
      query: (text: string, values?: unknown[]) => pg.query(text, values),
      release: () => undefined,
    }),
  };
  const database = { pool, db: drizzle(pg, { schema }) } as unknown as Database;
  const authAdmin = {
    createConfirmedUser: async (email: string) => {
      const id = rid();
      await pg.query('insert into auth.users(id,email) values($1,$2)', [
        id,
        email,
      ]);
      return { id };
    },
    issueRecoveryToken: async () => ({ hashedToken: 'h'.repeat(40) }),
    deleteUser: async (id: string) => {
      await pg.query('delete from auth.users where id=$1', [id]);
    },
    accessUrl: (token: string) =>
      `https://web.example.test/auth/confirm?token_hash=${token}&type=recovery`,
  } as unknown as AuthAdminService;
  portal = new PortalService(database);
  access = new PortalAccessService(database, authAdmin);
  guard = new CustomerGuard(database);
}, 60000);
beforeEach(async () => {
  a = await tenant('A');
  b = await tenant('B');
});
afterAll(async () => pg?.close());

describe('customer portal reads', () => {
  it('shows only the linked customer rentals, excluding drafts and other customers/tenants', async () => {
    const user = await portalUser(a, a.customerId);
    const mine = await rental(a, a.customerId, 'RESERVED', 3);
    const cancelled = await rental(a, a.customerId, 'CANCELLED', 4);
    const draft = await rental(a, a.customerId, 'DRAFT', 5);
    const colleague = await rental(a, a.noEmailCustomerId, 'RESERVED', 6);
    const foreign = await rental(b, b.customerId, 'RESERVED', 7);
    const page = await portal.rentals(user, new PageQuery());
    expect(page.total).toBe(2);
    expect(page.data.map((r) => r.id)).toEqual([cancelled, mine]);
    const text = JSON.stringify(page);
    for (const hidden of [draft, colleague, foreign, 'internal note'])
      expect(text).not.toContain(hidden);
    expect(await portal.me(user)).toMatchObject({
      customerId: a.customerId,
      businessId: a.businessId,
    });
    await expect(portal.rental(user, colleague)).rejects.toMatchObject({
      response: { code: 'PORTAL_RENTAL_NOT_FOUND' },
    });
    await expect(portal.rental(user, foreign)).rejects.toMatchObject({
      response: { code: 'PORTAL_RENTAL_NOT_FOUND' },
    });
    await expect(portal.rental(user, draft)).rejects.toMatchObject({
      response: { code: 'PORTAL_RENTAL_NOT_FOUND' },
    });
  });
  it('returns own contract versions without staff identity or override reasons and denies foreign ones', async () => {
    const user = await portalUser(a, a.customerId);
    const mine = await rental(a, a.customerId, 'RESERVED', 3);
    const colleague = await rental(a, a.noEmailCustomerId, 'RESERVED', 4);
    await contract(a, mine, 1);
    await contract(a, colleague, 2);
    const detail = await portal.rental(user, mine);
    expect(detail.contracts).toHaveLength(1);
    expect(detail).not.toHaveProperty('notes');
    const doc = await portal.contract(user, mine, 1);
    expect(doc.issuedBy).toBe(NIL);
    expect(doc.snapshot.pricing).toMatchObject({
      createdBy: NIL,
      overrideReason: null,
      agreedAmount: '1000000',
    });
    expect(JSON.stringify(doc)).not.toContain('secret reason');
    await expect(portal.contract(user, colleague, 1)).rejects.toMatchObject({
      response: { code: 'CONTRACT_NOT_FOUND' },
    });
    await expect(portal.contract(user, mine, 2)).rejects.toMatchObject({
      response: { code: 'CONTRACT_NOT_FOUND' },
    });
  });
});

describe('customer principal boundaries', () => {
  const ctx = (id: string) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ identity: { id } }) }),
    }) as never;
  it('denies Owners, unlinked users and stale customer/profile/business states', async () => {
    await expect(guard.canActivate(ctx(a.userId))).rejects.toMatchObject({
      response: { code: 'CUSTOMER_ACCESS_DENIED' },
    });
    await expect(guard.canActivate(ctx(rid()))).rejects.toThrow();
    const user = await portalUser(a, a.customerId);
    await expect(guard.canActivate(ctx(user))).resolves.toBe(true);
    for (const [sql, restore] of [
      [
        "update customers set status='INACTIVE' where id=$1",
        "update customers set status='ACTIVE' where id=$1",
        a.customerId,
      ],
      [
        "update user_profiles set status='DISABLED' where user_id=$1",
        "update user_profiles set status='ACTIVE' where user_id=$1",
        user,
      ],
      [
        "update businesses set status='DISABLED' where id=$1",
        "update businesses set status='ACTIVE' where id=$1",
        a.businessId,
      ],
    ] as const) {
      const key = sql.includes('customers')
        ? a.customerId
        : sql.includes('user_profiles')
          ? user
          : a.businessId;
      await pg.query(sql, [key]);
      await expect(portal.me(user)).rejects.toMatchObject({
        response: { code: 'CUSTOMER_ACCESS_DENIED' },
      });
      await pg.query(restore, [key]);
    }
    await expect(portal.me(user)).resolves.toBeDefined();
  });
  it('uses independent guards and gives Owner permissions no portal grant', () => {
    expect(Reflect.getMetadata('__guards__', PortalController)).toEqual([
      AuthGuard,
      CustomerGuard,
    ]);
    expect(Reflect.getMetadata('__guards__', PortalAccessController)).toEqual([
      AuthGuard,
      TenantGuard,
      PermissionGuard,
    ]);
    expect(permissionsFor('CUSTOMER')).toEqual([]);
  });
});

describe('Owner-issued portal access', () => {
  it('creates a new identity, links it, audits without email or link, and reissues the same identity', async () => {
    const first = await access.issue(a, a.customerId, 'req');
    expect(first.created).toBe(true);
    expect(first.accessUrl).toContain('/auth/confirm?token_hash=');
    expect(first.accessUrl).not.toContain('business=');
    const link = await pg.query<{ user_id: string }>(
      'select user_id from customer_portal_accounts where customer_id=$1',
      [a.customerId],
    );
    expect(link.rows).toHaveLength(1);
    expect(await access.status(a, a.customerId)).toMatchObject({ enabled: true });
    expect(await portal.me(link.rows[0].user_id)).toMatchObject({
      customerId: a.customerId,
    });
    const again = await access.issue(a, a.customerId, 'req');
    expect(again.created).toBe(false);
    const audit = await pg.query<{ metadata: unknown }>(
      "select metadata from audit_logs where business_id=$1 and action='customer.portal_access.issue'",
      [a.businessId],
    );
    expect(audit.rows).toHaveLength(2);
    const text = JSON.stringify(audit.rows);
    expect(text).not.toContain('example.test');
    expect(text).not.toContain('token_hash');
  });
  it('never takes over an existing account or a customer without a valid email', async () => {
    const email = `khach-${a.customerId}@example.test`;
    await pg.query('insert into auth.users(id,email) values($1,$2)', [rid(), email]);
    await expect(access.issue(a, a.customerId, 'req')).rejects.toMatchObject({
      response: { code: 'PORTAL_EMAIL_IN_USE' },
    });
    await expect(
      access.issue(a, a.noEmailCustomerId, 'req'),
    ).rejects.toMatchObject({ response: { code: 'PORTAL_EMAIL_REQUIRED' } });
    expect(
      (await pg.query('select 1 from customer_portal_accounts where business_id=$1', [a.businessId])).rows,
    ).toHaveLength(0);
  });
  it('refuses reissue when the linked identity also holds a business membership', async () => {
    await access.issue(a, a.customerId, 'req');
    const user = (
      await pg.query<{ user_id: string }>(
        'select user_id from customer_portal_accounts where customer_id=$1',
        [a.customerId],
      )
    ).rows[0].user_id;
    await pg.query(
      "insert into business_memberships(business_id,user_id,role_key) values($1,$2,'OWNER')",
      [b.businessId, user],
    );
    await expect(access.issue(a, a.customerId, 'req')).rejects.toMatchObject({
      response: { code: 'PORTAL_IDENTITY_UNAVAILABLE' },
    });
  });
  it('is tenant-scoped and rechecks the Owner under the tenant lock', async () => {
    await expect(access.issue(b, a.customerId, 'req')).rejects.toMatchObject({
      response: { code: 'CUSTOMER_NOT_FOUND' },
    });
    await pg.query("update business_memberships set status='DISABLED' where id=$1", [
      a.membershipId,
    ]);
    await expect(access.issue(a, a.customerId, 'req')).rejects.toThrow();
    // The unlinked identity created before the failed transaction is removed.
    expect(
      (
        await pg.query(
          "select 1 from auth.users where email like 'khach-%' and email like $1",
          [`%${a.customerId}%`],
        )
      ).rows,
    ).toHaveLength(0);
  });
  it('denies browser Data API access to portal accounts', async () => {
    await access.issue(a, a.customerId, 'req');
    await pg.exec('set role authenticated');
    await expect(
      pg.query('select * from public.customer_portal_accounts'),
    ).rejects.toThrow();
    await pg.exec('reset role');
  });
});
