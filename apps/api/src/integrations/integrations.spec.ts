import 'reflect-metadata';
import { integrationStatus } from '../platform/system.js';
import {
  IntegrationRegistry,
  NoopNotificationChannel,
  NoopPaymentProvider,
  integrationRegistry,
} from './registry.js';
import {
  IntegrationNotConfiguredError,
  type NotificationChannel,
  type PaymentProvider,
} from './ports.js';

const message = {
  to: 'customer@example.test',
  template: 'portal.access' as const,
  variables: {},
};

describe('integration ports without a provider', () => {
  it('defaults to Noop: nothing is delivered and payments refuse loudly', async () => {
    const registry = new IntegrationRegistry();
    const notifier = registry.notification({});
    expect(notifier).toBeInstanceOf(NoopNotificationChannel);
    expect(await notifier.send(message)).toEqual({ delivered: false });
    const payments = registry.payment({ PAYMENTS_PROVIDER: ' ' });
    expect(payments).toBeInstanceOf(NoopPaymentProvider);
    expect(() =>
      payments.createCheckout({
        businessId: 'b', rentalId: 'r', amount: '1000', currency: 'VND', idempotencyKey: 'k',
      }),
    ).toThrow(IntegrationNotConfiguredError);
    expect(() => payments.parseWebhook({}, Buffer.from('{}'))).toThrow(
      /not configured/,
    );
  });
  it('lets a future adapter register and be selected by name, rejecting unknown names', async () => {
    const registry = new IntegrationRegistry();
    const sent: string[] = [];
    const fake: NotificationChannel = {
      provider: 'fake',
      send: async (m) => {
        sent.push(m.template);
        return { delivered: true, reference: 'ref-1' };
      },
    };
    registry.registerNotification('fake', () => fake);
    expect(await registry.notification({ NOTIFICATIONS_PROVIDER: 'fake' }).send(message)).toEqual({
      delivered: true,
      reference: 'ref-1',
    });
    expect(sent).toEqual(['portal.access']);
    const payment: PaymentProvider = {
      provider: 'fake',
      createCheckout: async () => ({ reference: 'p1' }),
      parseWebhook: () => ({ reference: 'p1', status: 'PAID', amount: '1000', currency: 'VND' }),
    };
    registry.registerPayment('fake', () => payment);
    expect(registry.payment({ PAYMENTS_PROVIDER: 'fake' })).toBe(payment);
    expect(() => registry.notification({ NOTIFICATIONS_PROVIDER: 'mystery' })).toThrow();
    expect(() => registry.payment({ PAYMENTS_PROVIDER: 'mystery' })).toThrow();
    expect(registry.names().notifications).toEqual(['none', 'fake']);
  });
});

describe('integration status for Superadmin', () => {
  it('reports no provider as not configured and an unregistered name as misconfigured, never connected', () => {
    const byKey = (env: Record<string, string | undefined>) =>
      Object.fromEntries(integrationStatus(env).map((i) => [i.key, i]));
    expect(byKey({}).notifications.status).toBe('NOT_CONFIGURED');
    expect(byKey({}).payments.detail).toContain('Chưa nối nhà cung cấp');
    const wrong = byKey({ NOTIFICATIONS_PROVIDER: 'sendgrid', PAYMENTS_PROVIDER: 'stripe' });
    expect(wrong.notifications.status).toBe('NOT_CONFIGURED');
    expect(wrong.payments.status).toBe('NOT_CONFIGURED');
    expect(integrationRegistry.names().notifications).toEqual(['none']);
    // An unregistered name is never echoed back into the UI.
    expect(JSON.stringify(wrong)).not.toMatch(/sendgrid|stripe/);
  });
});
