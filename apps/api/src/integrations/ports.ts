// Ports for third-party services. No provider is connected: the defaults ("none") send
// nothing and charge nothing. A future adapter implements one port, is registered in
// registry.ts and is selected with NOTIFICATIONS_PROVIDER / PAYMENTS_PROVIDER, so business
// code never imports a vendor SDK.

export type NotificationMessage = {
  /** Recipient address; supplied by the caller from authoritative tenant data. */
  to: string;
  /** Template key owned by the application, never raw user content. */
  template: 'alert.digest' | 'portal.access' | 'password.reset';
  variables: Record<string, string>;
};
export type NotificationResult = { delivered: boolean; reference?: string };
export interface NotificationChannel {
  readonly provider: string;
  send(message: NotificationMessage): Promise<NotificationResult>;
}

export type CheckoutRequest = {
  businessId: string;
  rentalId: string;
  /** Exact whole-unit amount string; never a JS number. */
  amount: string;
  currency: string;
  /** Idempotency key so a retried request cannot double charge. */
  idempotencyKey: string;
};
export type CheckoutResult = { reference: string; redirectUrl?: string };
export type PaymentWebhookEvent = {
  reference: string;
  status: 'PAID' | 'FAILED' | 'CANCELLED';
  amount: string;
  currency: string;
};
export interface PaymentProvider {
  readonly provider: string;
  createCheckout(request: CheckoutRequest): Promise<CheckoutResult>;
  /** Must verify the provider signature itself and throw on any mismatch. */
  parseWebhook(headers: Record<string, string>, rawBody: Buffer): PaymentWebhookEvent;
}

export class IntegrationNotConfiguredError extends Error {
  readonly code = 'INTEGRATION_NOT_CONFIGURED';
  constructor(readonly integration: 'notifications' | 'payments') {
    super(`${integration} provider is not configured`);
  }
}
