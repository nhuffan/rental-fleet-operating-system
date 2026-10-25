export const PRICING_TIME_ZONE = "Asia/Ho_Chi_Minh";
export type BillingMode = "HOURLY" | "DAILY";
export function quoteRequestKey(input: {
  businessId: string;
  vehicleId: string;
  startAt: string;
  endAt: string;
  billingMode?: BillingMode;
}) {
  return JSON.stringify([
    input.businessId,
    input.vehicleId,
    input.startAt,
    input.endAt,
    input.billingMode ?? "AUTO",
  ]);
}
export function validVnd(value: string) {
  return /^(0|[1-9]\d{0,8})$/.test(value);
}
export function formatVnd(value: string) {
  return /^\d+$/.test(value)
    ? `${BigInt(value).toLocaleString("vi-VN")} ₫`
    : "—";
}

export function currentQuoteSnapshot<T extends { key: string }>(
  snapshot: T | null,
  requestKey: string,
): T | null {
  return snapshot?.key === requestKey ? snapshot : null;
}
// An older request may resolve after abort (including a cached session lookup).
// Do not commit either its quote or its error after selection has changed.
export async function settleQuoteRequest<T>(
  signal: AbortSignal,
  load: () => Promise<T>,
  onResult: (value: T) => void,
  onError: (cause: unknown) => void,
) {
  try {
    const value = await load();
    if (!signal.aborted) onResult(value);
  } catch (cause) {
    if (!signal.aborted) onError(cause);
  }
}
