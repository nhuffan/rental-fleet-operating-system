import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { disposableFixture } from './disposable-fixture.js';
import { AppModule } from '../dist/app.module.js';
import { configureApp } from '../dist/http.js';
import { Database } from '../dist/database/database.js';
import { loadConfig } from '../dist/config.js';

const fixture = disposableFixture();
let app: INestApplication | undefined;
let vehicleA: string, vehicleB: string, rental: string;
const owned = fixture.data;
function api(actor = 'ownerA', business = owned.businessA) {
  if (!app) throw new Error('Commercial smoke app unavailable');
  const headers = {
    Authorization: 'Bearer ' + fixture.tokens[actor],
    'X-Business-Id': business,
  };
  const client = request(app.getHttpServer());
  return {
    get: (path: string) => client.get('/api/v1' + path).set(headers),
    post: (path: string, body: object) =>
      client
        .post('/api/v1' + path)
        .set(headers)
        .send(body),
    patch: (path: string, body: object) =>
      client
        .patch('/api/v1' + path)
        .set(headers)
        .send(body),
  };
}
beforeAll(async () => {
  process.env.LOG_REQUESTS = 'false';
  await fixture.start();
  app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.init();
  for (const tenant of ['A', 'B']) {
    const response = await api(
      tenant === 'A' ? 'ownerA' : 'ownerB',
      tenant === 'A' ? owned.businessA : owned.businessB,
    )
      .post('/vehicles', {
        licensePlate: randomUUID().replaceAll('-', '').slice(0, 12),
        make: 'Smoke',
        model: 'Commercial',
      })
      .expect(201);
    if (tenant === 'A') vehicleA = response.body.id as string;
    else vehicleB = response.body.id as string;
  }
  const customer = await api()
    .post('/customers', { name: 'Commercial smoke', phone: '0900000000' })
    .expect(201);
  const startAt = new Date(Date.now() + 86400000).toISOString();
  const endAt = new Date(Date.now() + 172800000).toISOString();
  const response = await api()
    .post('/rentals', {
      customerId: customer.body.id as string,
      vehicleId: vehicleA,
      startAt,
      endAt,
      rentalAmount: 5000.5,
      depositRequiredAmount: 500.5,
    })
    .expect(201);
  rental = response.body.id as string;
}, 120000);
afterAll(async () => {
  try {
    await fixture.cleanup();
  } finally {
    await app?.close();
  }
}, 60000);

it('records exact receipts, deposits, expenses and corrections without cross-tenant or platform access', async () => {
  const post = async (
    kind: string,
    category: string,
    amount: string,
    rentalId: string | undefined = rental,
  ) => {
    const response = await api()
      .post('/commercial/movements', {
        kind,
        category,
        amount,
        occurredAt: new Date(Date.now() - 2000).toISOString(),
        ...(rentalId ? { rentalId } : {}),
        reference: 'commercial-smoke',
      })
      .expect(201);
    return response.body as { id: string };
  };
  const payment = await post('RENTAL_PAYMENT', 'RENTAL', '1000');
  const deposit = await post('DEPOSIT_RECEIPT', 'DEPOSIT', '500');
  await post('DEPOSIT_REFUND', 'DEPOSIT', '100');
  await post('DEPOSIT_RETAIN', 'DEPOSIT', '150');
  const expense = await post('EXPENSE', 'TOLL', '50');
  await post('MISC_INCOME', 'OTHER_INCOME', '75');
  const summary = await api()
    .get('/commercial/summary?rentalId=' + rental)
    .expect(200);
  expect(summary.body).toMatchObject({
    currency: 'VND',
    recordedRevenue: '1225',
    cashReceived: '1075',
    operatingExpenses: '50',
    estimatedProfit: '1175',
    netOperatingCashFlow: '1025',
    depositHeld: '250',
  });
  const rentalSummary = await api()
    .get('/rentals/' + rental + '/commercial')
    .expect(200);
  expect(rentalSummary.body).toMatchObject({
    contractedAmount: '5001',
    recordedRentalPayments: '1000',
    outstandingAmount: '4001',
    overpaidAmount: '0',
    depositRequired: '501',
    depositReceived: '500',
    depositRefunded: '100',
    depositRetained: '150',
    depositBalance: '250',
  });
  const reversal = await api()
    .post('/commercial/movements/' + expense.id + '/reverse', {
      reason: 'Exact smoke correction',
    })
    .expect(201);
  expect(reversal.body).toMatchObject({
    amount: '50',
    reversalOf: expense.id,
    status: 'REVERSAL',
  });
  expect(
    (
      await api()
        .get('/commercial/summary?rentalId=' + rental)
        .expect(200)
    ).body,
  ).toMatchObject({
    operatingExpenses: '0',
    estimatedProfit: '1225',
    netOperatingCashFlow: '1075',
    depositHeld: '250',
  });
  await api()
    .post('/commercial/movements/' + expense.id + '/reverse', {
      reason: 'Duplicate',
    })
    .expect(409);
  await api()
    .post(
      '/commercial/movements/' + (reversal.body.id as string) + '/reverse',
      { reason: 'Invalid chain' },
    )
    .expect(409);
  await api()
    .post('/commercial/movements/' + deposit.id + '/reverse', {
      reason: 'Would make liability negative',
    })
    .expect(409);
  await api()
    .post('/commercial/movements', {
      kind: 'DEPOSIT_REFUND',
      category: 'DEPOSIT',
      amount: '251',
      rentalId: rental,
      occurredAt: new Date(Date.now() - 1000).toISOString(),
    })
    .expect(409);
  await api()
    .post('/commercial/movements', {
      kind: 'MISC_INCOME',
      category: 'OTHER_INCOME',
      amount: '1.5',
      occurredAt: new Date().toISOString(),
    })
    .expect(400);
  await api()
    .post('/commercial/movements', {
      kind: 'EXPENSE',
      category: 'TOLL',
      amount: '1',
      rentalId: rental,
      vehicleId: vehicleB,
      occurredAt: new Date(Date.now() - 1000).toISOString(),
    })
    .expect(400);
  await api('ownerB', owned.businessB)
    .get('/commercial/movements/' + payment.id)
    .expect(404);
  await api('ownerB', owned.businessB)
    .get('/rentals/' + rental + '/commercial')
    .expect(404);
  for (const actor of ['platformOperator', 'disabledA', 'noMembership']) {
    await api(actor).get('/commercial/summary').expect(403);
    await api(actor)
      .post('/commercial/movements', {
        kind: 'MISC_INCOME',
        category: 'OTHER_INCOME',
        amount: '1',
        occurredAt: new Date().toISOString(),
      })
      .expect(403);
  }
  const secondVehicle = await api()
    .post('/vehicles', {
      licensePlate: randomUUID().replaceAll('-', '').slice(0, 12),
      make: 'Smoke',
      model: 'Second',
    })
    .expect(201);
  const changed = await api()
    .patch('/rentals/' + rental, { vehicleId: secondVehicle.body.id as string })
    .expect(409);
  expect(changed.body.code).toBe('RENTAL_HAS_COMMERCIAL_HISTORY');
  const page = await api()
    .get('/commercial/movements?rentalId=' + rental + '&limit=2')
    .expect(200);
  expect(page.body.data).toHaveLength(2);
  expect(page.body.total).toBe(7);
  const db = app!.get(Database);
  const audit = await db.pool.query<{ metadata: Record<string, unknown> }>(
    "select metadata from public.audit_logs where business_id=$1 and action like 'commercial.%'",
    [owned.businessA],
  );
  expect(audit.rows.length).toBeGreaterThanOrEqual(7);
  for (const row of audit.rows) {
    expect(row.metadata).not.toHaveProperty('amount');
    expect(row.metadata).not.toHaveProperty('notes');
    expect(row.metadata).not.toHaveProperty('reason');
  }
  // The Data API can read only authorized rows and cannot bypass the write/audit API.
  const config = loadConfig();
  const rest = (actor: string, method = 'GET', body?: object) =>
    fetch(
      config.supabaseUrl +
        '/rest/v1/commercial_movements?business_id=eq.' +
        owned.businessA,
      {
        method,
        headers: {
          apikey: config.publishableKey,
          Authorization: 'Bearer ' + fixture.tokens[actor],
          'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
  const ownRows = await rest('ownerA');
  expect(ownRows.status).toBe(200);
  expect(((await ownRows.json()) as unknown[]).length).toBe(7);
  for (const actor of ['ownerB', 'platformOperator', 'noMembership']) {
    const denied = await rest(actor);
    expect(denied.status).toBe(200);
    expect(await denied.json()).toEqual([]);
  }
  const deniedWrite = await rest('ownerA', 'POST', {
    business_id: owned.businessA,
    kind: 'MISC_INCOME',
    category: 'OTHER_INCOME',
    amount: '1',
    occurred_at: new Date().toISOString(),
    created_by: owned.accounts.ownerA.id,
  });
  expect([401, 403]).toContain(deniedWrite.status);
}, 120000);
