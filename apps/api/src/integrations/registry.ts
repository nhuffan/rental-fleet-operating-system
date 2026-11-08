import {
  IntegrationNotConfiguredError,
  type NotificationChannel,
  type NotificationMessage,
  type PaymentProvider,
} from './ports.js';

export const NOTIFICATION_CHANNEL = Symbol('NOTIFICATION_CHANNEL');
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

/** Never delivers. Callers get delivered:false and must not claim a message was sent. */
export class NoopNotificationChannel implements NotificationChannel {
  readonly provider = 'none';
  async send(_message: NotificationMessage) {
    return { delivered: false };
  }
}
/** Refuses loudly: silently pretending a payment started would be worse than failing. */
export class NoopPaymentProvider implements PaymentProvider {
  readonly provider = 'none';
  createCheckout(): never {
    throw new IntegrationNotConfiguredError('payments');
  }
  parseWebhook(): never {
    throw new IntegrationNotConfiguredError('payments');
  }
}

type Factory<T> = () => T;
export class IntegrationRegistry {
  private notifications = new Map<string, Factory<NotificationChannel>>([
    ['none', () => new NoopNotificationChannel()],
  ]);
  private payments = new Map<string, Factory<PaymentProvider>>([
    ['none', () => new NoopPaymentProvider()],
  ]);
  registerNotification(name: string, factory: Factory<NotificationChannel>) {
    this.notifications.set(name, factory);
  }
  registerPayment(name: string, factory: Factory<PaymentProvider>) {
    this.payments.set(name, factory);
  }
  /** Names a deployment may select (always includes "none"). */
  names() {
    return {
      notifications: [...this.notifications.keys()],
      payments: [...this.payments.keys()],
    };
  }
  notification(env: Record<string, string | undefined>): NotificationChannel {
    const name = (env.NOTIFICATIONS_PROVIDER ?? 'none').trim() || 'none';
    const factory = this.notifications.get(name);
    if (!factory) throw new Error('Unknown NOTIFICATIONS_PROVIDER');
    return factory();
  }
  payment(env: Record<string, string | undefined>): PaymentProvider {
    const name = (env.PAYMENTS_PROVIDER ?? 'none').trim() || 'none';
    const factory = this.payments.get(name);
    if (!factory) throw new Error('Unknown PAYMENTS_PROVIDER');
    return factory();
  }
}
/** Production registry: vendors are added here when an adapter is written. */
export const integrationRegistry = new IntegrationRegistry();
