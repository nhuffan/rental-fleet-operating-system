import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { denied, type TenantContext } from '../auth/guards.js';
import { permissionsFor } from '../auth/permissions.js';
import { Database } from '../database/database.js';
import {
  auditLogs,
  businesses,
  customerPortalAccounts,
  customers,
  memberships,
  profiles,
} from '../database/schema.js';
import { AuthAdminService } from '../platform/auth-admin.service.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const conflict = (code: string, message: string) =>
  new ConflictException({ code, message });

@Injectable()
export class PortalAccessService {
  constructor(
    @Inject(Database) private readonly database: Database,
    @Inject(AuthAdminService) private readonly authAdmin: AuthAdminService,
  ) {}

  private requirePermission(
    c: TenantContext,
    permission: 'customer.read' | 'customer.manage',
  ) {
    if (!permissionsFor(c.role).includes(permission))
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Permission denied',
      });
  }

  async status(c: TenantContext, customerId: string) {
    this.requirePermission(c, 'customer.read');
    const [customer] = await this.database.db
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(eq(customers.businessId, c.businessId), eq(customers.id, customerId)),
      );
    if (!customer)
      throw new NotFoundException({
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Customer not found',
      });
    const [account] = await this.database.db
      .select({ createdAt: customerPortalAccounts.createdAt })
      .from(customerPortalAccounts)
      .where(
        and(
          eq(customerPortalAccounts.businessId, c.businessId),
          eq(customerPortalAccounts.customerId, customerId),
        ),
      );
    return {
      enabled: Boolean(account),
      createdAt: account?.createdAt.toISOString() ?? null,
    };
  }

  /**
   * Issues a one-time private recovery link. A new Auth identity is only ever created for
   * an email with no existing account, and an existing identity is only reissued when it is
   * already this customer's portal account with no business/platform memberships. An Owner
   * can therefore never take over another person's account by typing their email.
   */
  async issue(c: TenantContext, customerId: string, requestId: string) {
    this.requirePermission(c, 'customer.manage');
    const pool = this.database.pool;
    const [customer] = await this.database.db
      .select()
      .from(customers)
      .where(
        and(eq(customers.businessId, c.businessId), eq(customers.id, customerId)),
      );
    if (!customer)
      throw new NotFoundException({
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Customer not found',
      });
    const email = customer.email.trim().toLowerCase();
    if (customer.status !== 'ACTIVE')
      throw conflict(
        'PORTAL_CUSTOMER_INACTIVE',
        'Activate the customer before granting portal access',
      );
    if (!EMAIL.test(email) || email.length > 254)
      throw conflict(
        'PORTAL_EMAIL_REQUIRED',
        'The customer needs a valid email address for portal access',
      );
    const serial = await pool.connect();
    let createdId: string | null = null;
    try {
      // Serializes concurrent grants for one email, including failed-request cleanup.
      await serial.query('select pg_advisory_lock(190020,hashtext($1))', [email]);
      const existing = (
        await serial.query<{ userId: string; email: string | null }>(
          `select a.user_id as "userId", u.email from public.customer_portal_accounts a
           left join auth.users u on u.id = a.user_id
           where a.business_id = $1 and a.customer_id = $2`,
          [c.businessId, customerId],
        )
      ).rows[0];
      let userId: string;
      let linkEmail: string;
      if (existing) {
        const shared = await serial.query<{ used: boolean }>(
          `select exists(select 1 from public.business_memberships where user_id = $1
             union all select 1 from public.platform_memberships where user_id = $1) as used`,
          [existing.userId],
        );
        if (!existing.email || shared.rows[0].used)
          throw conflict(
            'PORTAL_IDENTITY_UNAVAILABLE',
            'This portal identity cannot be reissued',
          );
        userId = existing.userId;
        linkEmail = existing.email;
      } else {
        const taken = await serial.query(
          'select 1 from auth.users where lower(email) = $1',
          [email],
        );
        if (taken.rows.length)
          throw conflict(
            'PORTAL_EMAIL_IN_USE',
            'This email already has an account; use a different customer email',
          );
        createdId = (await this.authAdmin.createConfirmedUser(email)).id;
        userId = createdId;
        linkEmail = email;
      }
      const { hashedToken } = await this.authAdmin.issueRecoveryToken(linkEmail);
      await this.database.db.transaction(async (tx) => {
        const [business] = await tx
          .select({ status: businesses.status })
          .from(businesses)
          .where(eq(businesses.id, c.businessId))
          .for('update');
        const [member] = await tx
          .select({ role: memberships.roleKey })
          .from(memberships)
          .innerJoin(profiles, eq(profiles.userId, memberships.userId))
          .where(
            and(
              eq(memberships.businessId, c.businessId),
              eq(memberships.id, c.membershipId),
              eq(memberships.userId, c.userId),
              eq(memberships.status, 'ACTIVE'),
              eq(profiles.status, 'ACTIVE'),
            ),
          );
        if (!member || business?.status !== 'ACTIVE') throw denied();
        if (!permissionsFor(member.role).includes('customer.manage'))
          throw new ForbiddenException({
            code: 'PERMISSION_DENIED',
            message: 'Permission denied',
          });
        const [current] = await tx
          .select({ status: customers.status, email: customers.email })
          .from(customers)
          .where(
            and(
              eq(customers.businessId, c.businessId),
              eq(customers.id, customerId),
            ),
          )
          .for('update');
        if (
          !current ||
          current.status !== 'ACTIVE' ||
          current.email.trim().toLowerCase() !== email
        )
          throw conflict(
            'PORTAL_CUSTOMER_CHANGED',
            'The customer changed while issuing access; try again',
          );
        if (!existing) {
          await tx
            .insert(profiles)
            .values({ userId, displayName: customer.name })
            .onConflictDoNothing();
          await tx.insert(customerPortalAccounts).values({
            businessId: c.businessId,
            customerId,
            userId,
            createdBy: c.userId,
          });
        }
        await tx.insert(auditLogs).values({
          businessId: c.businessId,
          actorUserId: c.userId,
          action: 'customer.portal_access.issue',
          entityType: 'customer',
          entityId: customerId,
          metadata: { requestId, fields: ['portalAccess'] },
        });
      });
      createdId = null;
      return {
        accessUrl: this.authAdmin.accessUrl(hashedToken),
        created: !existing,
      };
    } catch (error) {
      if (createdId) {
        // Remove only an unreferenced identity this request created; never log provider data.
        try {
          const refs = await serial.query<{ used: boolean }>(
            `select exists(select 1 from public.user_profiles where user_id = $1
               union all select 1 from public.business_memberships where user_id = $1
               union all select 1 from public.platform_memberships where user_id = $1
               union all select 1 from public.customer_portal_accounts where user_id = $1) as used`,
            [createdId],
          );
          if (!refs.rows[0].used) await this.authAdmin.deleteUser(createdId);
        } catch {
          /* Orphan identity has no grant and is safe to retry. */
        }
      }
      throw error;
    } finally {
      try {
        await serial.query('select pg_advisory_unlock(190020,hashtext($1))', [
          email,
        ]);
      } finally {
        serial.release();
      }
    }
  }
}
