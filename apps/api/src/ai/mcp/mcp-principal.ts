import { and, eq } from 'drizzle-orm';
import type { TenantContext } from '../../auth/guards.js';
import type { Database } from '../../database/database.js';
import { businesses, memberships, profiles } from '../../database/schema.js';

export class McpConfigError extends Error {}

// Local stdio only. The host process is pinned to ONE explicit user + business
// from its own environment (never from a tool argument) and the membership is
// verified as an active Owner. Remote/shared MCP needs real OAuth and is not
// provided here.
export function assertLocalMcpAllowed(env: NodeJS.ProcessEnv) {
  if (env.MCP_ENABLED !== 'true')
    throw new McpConfigError('MCP is disabled (set MCP_ENABLED=true)');
  if (['staging', 'production'].includes(env.APP_ENV ?? ''))
    throw new McpConfigError('Local MCP must not run in staging/production');
  const userId = env.MCP_USER_ID;
  const businessId = env.MCP_BUSINESS_ID;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!userId || !businessId || !uuid.test(userId) || !uuid.test(businessId))
    throw new McpConfigError('MCP_USER_ID and MCP_BUSINESS_ID must be UUIDs');
  return { userId, businessId };
}

export async function resolveLocalPrincipal(
  database: Database,
  env: NodeJS.ProcessEnv,
): Promise<TenantContext> {
  const { userId, businessId } = assertLocalMcpAllowed(env);
  const [row] = await database.db
    .select({
      membershipId: memberships.id,
      businessName: businesses.name,
    })
    .from(memberships)
    .innerJoin(businesses, eq(businesses.id, memberships.businessId))
    .innerJoin(profiles, eq(profiles.userId, memberships.userId))
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.businessId, businessId),
        eq(memberships.roleKey, 'OWNER'),
        eq(memberships.status, 'ACTIVE'),
        eq(businesses.status, 'ACTIVE'),
        eq(profiles.status, 'ACTIVE'),
      ),
    )
    .limit(1);
  if (!row) throw new McpConfigError('No active Owner membership for principal');
  return {
    userId,
    businessId,
    businessName: row.businessName,
    role: 'OWNER',
    membershipId: row.membershipId,
    email: 'mcp-local@example.invalid',
  };
}
