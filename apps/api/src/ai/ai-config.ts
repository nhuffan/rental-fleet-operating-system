export type AiConfig = {
  enabled: boolean;
  provider: 'none' | 'fake' | 'anthropic';
  model: string;
  apiKey?: string;
  timeoutMs: number;
  ratePerMinute: number;
};

function integer(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = value === undefined ? fallback : Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max
    ? parsed
    : fallback;
}

// Everything is off unless explicitly enabled. The deterministic `fake` provider
// is for development/tests only and never runs in staging/production.
export function aiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig {
  const requested = env.AI_PROVIDER ?? 'none';
  const hosted = ['staging', 'production'].includes(env.APP_ENV ?? '');
  let provider: AiConfig['provider'] = 'none';
  if (requested === 'fake' && !hosted) provider = 'fake';
  if (requested === 'anthropic' && env.ANTHROPIC_API_KEY)
    provider = 'anthropic';
  return {
    enabled: env.AI_COPILOT_ENABLED === 'true' && provider !== 'none',
    provider,
    model: env.AI_MODEL || 'claude-sonnet-5-5',
    apiKey: env.ANTHROPIC_API_KEY || undefined,
    timeoutMs: integer(env.AI_TIMEOUT_MS, 20_000, 1_000, 60_000),
    ratePerMinute: integer(env.AI_RATE_LIMIT_PER_MINUTE, 10, 1, 120),
  };
}
