import { createHash } from 'node:crypto';
export const MAX_PRICING_AMOUNT = '999999999';
export type BillingMode = 'HOURLY' | 'DAILY';
export type RateInput = {
  id: string;
  version: number;
  scope: 'VEHICLE' | 'BUSINESS';
  name: string;
  hourlyRate: string | null;
  dailyRate: string | null;
  minimumCharge: string;
  extraHourRate: string | null;
  effectiveFrom: Date | string;
  effectiveUntil: Date | string | null;
};
export type QuoteInput = {
  vehicleId: string;
  startAt: string;
  endAt: string;
  billingMode?: BillingMode;
};
export type QuoteLine = {
  kind: 'HOUR' | 'DAY' | 'EXTRA_HOUR' | 'DAY_CAP' | 'MINIMUM';
  units: string;
  unitPrice: string;
  amount: string;
};
export type QuoteBreakdown = {
  currency: 'VND';
  timeZone: 'Asia/Ho_Chi_Minh';
  vehicleId: string;
  startAt: string;
  endAt: string;
  durationSeconds: string;
  billingMode: BillingMode;
  rateCardId: string;
  rateVersion: number;
  rateName: string;
  rateSource: 'VEHICLE' | 'BUSINESS';
  hourlyRate: string | null;
  dailyRate: string | null;
  minimumCharge: string;
  extraHourRate: string | null;
  effectiveFrom: string;
  effectiveUntil: string | null;
  lines: QuoteLine[];
  calculatedAmount: string;
  quoteHash: string;
};
export class PricingInputError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'PricingInputError';
  }
}
/** Calendar and offset checks prevent Date from silently normalizing invalid days. */
export function parsePricingInstant(value: string): Date {
  const m =
    typeof value === 'string'
      ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|([+-])(\d{2}):(\d{2}))$/.exec(
          value,
        )
      : null;
  if (!m) throw new PricingInputError('INVALID_PRICING_TIME');
  const [y, mo, d, h, mi, se] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? '0'].map(
    Number,
  );
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const oh = Number(m[10] ?? 0),
    om = Number(m[11] ?? 0);
  if (
    y < 1 ||
    mo < 1 ||
    mo > 12 ||
    d < 1 ||
    d > days[mo - 1] ||
    h > 23 ||
    mi > 59 ||
    se > 59 ||
    oh > 14 ||
    om > 59 ||
    (oh === 14 && om !== 0)
  )
    throw new PricingInputError('INVALID_PRICING_TIME');
  const date = new Date(value);
  if (
    !Number.isFinite(date.getTime()) ||
    date.getUTCFullYear() < 1 ||
    date.getUTCFullYear() > 9999
  )
    throw new PricingInputError('INVALID_PRICING_TIME');
  return date;
}
function rateInstant(value: Date | string): Date {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime()))
      throw new PricingInputError('INVALID_PRICING_RATE');
    return value;
  }
  return parsePricingInstant(value);
}
function money(value: string, positive: boolean): bigint {
  if (!/^(0|[1-9][0-9]{0,8})$/.test(value) || (positive && value === '0'))
    throw new PricingInputError('INVALID_PRICING_RATE');
  return BigInt(value);
}
export function createQuoteHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
const HOUR = 3600000n,
  DAY = 24n * HOUR;
const ceil = (v: bigint, d: bigint) => (v + d - 1n) / d;
/** Daily rates use elapsed 24-hour units; partial extra hours are capped at one daily unit. */
export function calculateQuote(
  rate: RateInput,
  input: QuoteInput,
): QuoteBreakdown {
  const start = parsePricingInstant(input.startAt),
    end = parsePricingInstant(input.endAt);
  const duration = BigInt(end.getTime()) - BigInt(start.getTime());
  if (duration <= 0n) throw new PricingInputError('INVALID_PRICING_TIME');
  const from = rateInstant(rate.effectiveFrom),
    until =
      rate.effectiveUntil === null ? null : rateInstant(rate.effectiveUntil);
  if (
    !Number.isInteger(rate.version) ||
    rate.version < 1 ||
    !['VEHICLE', 'BUSINESS'].includes(rate.scope) ||
    (!rate.hourlyRate && !rate.dailyRate) ||
    (rate.extraHourRate !== null && rate.dailyRate === null) ||
    (until !== null && until <= from)
  )
    throw new PricingInputError('INVALID_PRICING_RATE');
  if (start < from || (until && start >= until))
    throw new PricingInputError('RATE_NOT_EFFECTIVE');
  const hourly = rate.hourlyRate === null ? null : money(rate.hourlyRate, true),
    daily = rate.dailyRate === null ? null : money(rate.dailyRate, true),
    extra =
      rate.extraHourRate === null ? null : money(rate.extraHourRate, true),
    minimum = money(rate.minimumCharge, false);
  const mode = input.billingMode ?? (daily === null ? 'HOURLY' : 'DAILY');
  if (
    !['HOURLY', 'DAILY'].includes(mode) ||
    (mode === 'HOURLY' && hourly === null) ||
    (mode === 'DAILY' && daily === null)
  )
    throw new PricingInputError('BILLING_MODE_UNAVAILABLE');
  const lines: QuoteLine[] = [];
  let total = 0n;
  const add = (kind: QuoteLine['kind'], units: bigint, price: bigint) => {
    if (units > 0n) {
      const amount = units * price;
      lines.push({
        kind,
        units: units.toString(),
        unitPrice: price.toString(),
        amount: amount.toString(),
      });
      total += amount;
    }
  };
  if (mode === 'HOURLY') add('HOUR', ceil(duration, HOUR), hourly!);
  else if (extra === null) add('DAY', ceil(duration, DAY), daily!);
  else {
    add('DAY', duration / DAY, daily!);
    const remainder = duration % DAY;
    if (remainder > 0n) {
      const hours = ceil(remainder, HOUR);
      if (hours * extra >= daily!) add('DAY_CAP', 1n, daily!);
      else add('EXTRA_HOUR', hours, extra);
    }
  }
  if (minimum > total) add('MINIMUM', 1n, minimum - total);
  if (total > BigInt(MAX_PRICING_AMOUNT))
    throw new PricingInputError('PRICING_AMOUNT_EXCEEDED');
  const quote: Omit<QuoteBreakdown, 'quoteHash'> = {
    currency: 'VND',
    timeZone: 'Asia/Ho_Chi_Minh',
    vehicleId: input.vehicleId,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    durationSeconds: `${duration / 1000n}${duration % 1000n ? `.${(duration % 1000n).toString().padStart(3, '0').replace(/0+$/, '')}` : ''}`,
    billingMode: mode,
    rateCardId: rate.id,
    rateVersion: rate.version,
    rateName: rate.name,
    rateSource: rate.scope,
    hourlyRate: rate.hourlyRate,
    dailyRate: rate.dailyRate,
    minimumCharge: rate.minimumCharge,
    extraHourRate: rate.extraHourRate,
    effectiveFrom: from.toISOString(),
    effectiveUntil: until?.toISOString() ?? null,
    lines,
    calculatedAmount: total.toString(),
  };
  return { ...quote, quoteHash: createQuoteHash(quote) };
}
