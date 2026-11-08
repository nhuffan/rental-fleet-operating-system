import type { Pool, PoolClient } from 'pg';

export type CustomerPrincipal = {
  userId: string;
  customerId: string;
  businessId: string;
  customerName: string;
  businessName: string;
  currency: string;
};

// The only grant a Customer has: an ACTIVE profile linked to an ACTIVE customer of an
// ACTIVE business. Business/platform memberships, user_metadata, headers and the business
// cookie never create or widen it.
export async function findCustomerPrincipal(
  db: Pick<Pool | PoolClient, 'query'>,
  userId: string,
): Promise<CustomerPrincipal | null> {
  const result = await db.query<CustomerPrincipal>(
    `select a.user_id as "userId", c.id as "customerId", c.business_id as "businessId",
       c.name as "customerName", b.name as "businessName", b.currency
     from public.customer_portal_accounts a
     join public.customers c on c.business_id = a.business_id and c.id = a.customer_id
     join public.businesses b on b.id = a.business_id
     join public.user_profiles p on p.user_id = a.user_id
     where a.user_id = $1 and c.status = 'ACTIVE' and b.status = 'ACTIVE' and p.status = 'ACTIVE'`,
    [userId],
  );
  return result.rows[0] ?? null;
}
