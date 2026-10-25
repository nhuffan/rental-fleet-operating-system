import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import { Database } from '../database/database.js';
import {
  auditLogs,
  branches,
  businesses,
  commercialMovements,
  rentalRateCards,
  rentalQuoteSnapshots,
  rentals,
  memberships,
  profiles,
  settings,
} from '../database/schema.js';
import { denied, type TenantContext } from '../auth/guards.js';
import { permissionsFor, type Permission } from '../auth/permissions.js';
import {
  BranchCreate,
  BranchUpdate,
  BusinessUpdate,
  MemberCreate,
  MemberUpdate,
  PageQuery,
  SettingsUpdate,
} from './dto.js';
type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];
@Injectable()
export class CoreService {
  constructor(@Inject(Database) private readonly database: Database) {}
  async me(c: TenantContext) {
    const [profile] = await this.database.db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, c.userId));
    const available = await this.database.db
      .select({
        id: businesses.id,
        name: businesses.name,
        role: memberships.roleKey,
      })
      .from(memberships)
      .innerJoin(businesses, eq(businesses.id, memberships.businessId))
      .where(
        and(
          eq(memberships.userId, c.userId),
          eq(memberships.status, 'ACTIVE'),
          eq(memberships.roleKey, 'OWNER'),
          eq(businesses.status, 'ACTIVE'),
        ),
      )
      .orderBy(asc(businesses.name));
    return {
      user: {
        id: c.userId,
        email: c.email,
        displayName: profile?.displayName ?? '',
      },
      business: await this.business(c),
      role: c.role,
      permissions: permissionsFor(c.role),
      businesses: available,
    };
  }
  async business(c: TenantContext) {
    const [row] = await this.database.db
      .select()
      .from(businesses)
      .where(eq(businesses.id, c.businessId));
    if (!row) throw new NotFoundException();
    return row;
  }
  private async mutate<T>(
    c: TenantContext,
    permission: Permission,
    requestId: string,
    action: string,
    type: string,
    operation: (tx: Tx) => Promise<{ value: T; id: string; fields?: string[] }>,
  ) {
    return this.database.db.transaction(async (tx) => {
      // Serialize tenant admin writes, then recheck membership/permission so concurrent revocation cannot be bypassed.
      const [business] = await tx
        .select()
        .from(businesses)
        .where(eq(businesses.id, c.businessId))
        .for('update');
      const [member] = await tx
        .select({ role: memberships.roleKey })
        .from(memberships)
        .innerJoin(profiles, eq(profiles.userId, memberships.userId))
        .where(
          and(
            eq(memberships.id, c.membershipId),
            eq(memberships.businessId, c.businessId),
            eq(memberships.userId, c.userId),
            eq(memberships.status, 'ACTIVE'),
            eq(profiles.status, 'ACTIVE'),
          ),
        );
      if (!member || business?.status !== 'ACTIVE') throw denied();
      if (!permissionsFor(member.role).includes(permission))
        throw new ForbiddenException({
          code: 'PERMISSION_DENIED',
          message: 'Permission denied',
        });
      const result = await operation(tx);
      await tx.insert(auditLogs).values({
        businessId: c.businessId,
        actorUserId: c.userId,
        action,
        entityType: type,
        entityId: result.id,
        metadata: { requestId, fields: result.fields ?? [] },
      });
      return result.value;
    });
  }
  async updateBusiness(
    c: TenantContext,
    body: BusinessUpdate,
    requestId: string,
  ) {
    if (body.timezone) {
      try {
        new Intl.DateTimeFormat('en', { timeZone: body.timezone });
      } catch {
        throw new BadRequestException('Invalid IANA timezone');
      }
    }
    return this.mutate(
      c,
      'business.update',
      requestId,
      'business.update',
      'business',
      async (tx) => {
        if (body.currency) {
          const [business] = await tx
            .select({ currency: businesses.currency })
            .from(businesses)
            .where(eq(businesses.id, c.businessId));
          if (business && body.currency !== business.currency) {
            const pricing = await tx.execute<{ present: boolean }>(sql`
              select exists (
                select 1 from ${rentalRateCards} where ${rentalRateCards.businessId} = ${c.businessId}
                union all select 1 from ${rentalQuoteSnapshots} where ${rentalQuoteSnapshots.businessId} = ${c.businessId}
                union all select 1 from ${rentals} where ${rentals.businessId} = ${c.businessId} and ${rentals.pricingDraft} is not null
              ) as present
            `);
            if (pricing.rows[0].present)
              throw new ConflictException({
                code: 'BUSINESS_HAS_PRICING_HISTORY',
                message:
                  'Business currency cannot change while VND rates or quoted rentals exist',
              });
            const [movement] = await tx
              .select({ id: commercialMovements.id })
              .from(commercialMovements)
              .where(eq(commercialMovements.businessId, c.businessId))
              .limit(1);
            if (movement)
              throw new ConflictException({
                code: 'BUSINESS_HAS_COMMERCIAL_HISTORY',
                message:
                  'Business currency cannot change after financial movements have been recorded',
              });
          }
        }
        const [value] = await tx
          .update(businesses)
          .set({
            name: body.name,
            timezone: body.timezone,
            currency: body.currency,
            updatedAt: new Date(),
          })
          .where(eq(businesses.id, c.businessId))
          .returning();
        return { value, id: c.businessId, fields: Object.keys(body) };
      },
    );
  }
  async listBranches(c: TenantContext, q: PageQuery) {
    const where = eq(branches.businessId, c.businessId);
    const [data, totals] = await Promise.all([
      this.database.db
        .select()
        .from(branches)
        .where(where)
        .orderBy(asc(branches.createdAt), asc(branches.id))
        .limit(q.limit)
        .offset((q.page - 1) * q.limit),
      this.database.db.select({ total: count() }).from(branches).where(where),
    ]);
    return { data, page: q.page, limit: q.limit, total: totals[0].total };
  }
  async branch(c: TenantContext, id: string) {
    const [row] = await this.database.db
      .select()
      .from(branches)
      .where(and(eq(branches.id, id), eq(branches.businessId, c.businessId)));
    if (!row)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Branch not found',
      });
    return row;
  }
  async createBranch(c: TenantContext, body: BranchCreate, requestId: string) {
    return this.mutate(
      c,
      'branch.manage',
      requestId,
      'branch.create',
      'branch',
      async (tx) => {
        const [value] = await tx
          .insert(branches)
          .values({
            name: body.name,
            address: body.address,
            businessId: c.businessId,
          })
          .returning();
        return { value, id: value.id, fields: Object.keys(body) };
      },
    );
  }
  async updateBranch(
    c: TenantContext,
    id: string,
    body: BranchUpdate,
    requestId: string,
  ) {
    return this.mutate(
      c,
      'branch.manage',
      requestId,
      'branch.update',
      'branch',
      async (tx) => {
        const [value] = await tx
          .update(branches)
          .set({
            name: body.name,
            address: body.address,
            status: body.status,
            updatedAt: new Date(),
          })
          .where(
            and(eq(branches.id, id), eq(branches.businessId, c.businessId)),
          )
          .returning();
        if (!value)
          throw new NotFoundException({
            code: 'NOT_FOUND',
            message: 'Branch not found',
          });
        return { value, id, fields: Object.keys(body) };
      },
    );
  }
  async listMembers(c: TenantContext, q: PageQuery) {
    const where = and(
      eq(memberships.businessId, c.businessId),
      eq(memberships.roleKey, 'OWNER'),
    );
    const [data, totals] = await Promise.all([
      this.database.db
        .select({
          id: memberships.id,
          userId: memberships.userId,
          businessId: memberships.businessId,
          displayName: profiles.displayName,
          roleKey: memberships.roleKey,
          status: memberships.status,
        })
        .from(memberships)
        .innerJoin(profiles, eq(profiles.userId, memberships.userId))
        .where(where)
        .orderBy(asc(memberships.createdAt), asc(memberships.id))
        .limit(q.limit)
        .offset((q.page - 1) * q.limit),
      this.database.db
        .select({ total: count() })
        .from(memberships)
        .where(where),
    ]);
    return { data, page: q.page, limit: q.limit, total: totals[0].total };
  }
  async addMember(c: TenantContext, body: MemberCreate, requestId: string) {
    return this.mutate(
      c,
      'user.manage',
      requestId,
      'membership.add',
      'membership',
      async (tx) => {
        const identity = await tx.execute(
          sql`select id from auth.users where id = ${body.userId}::uuid`,
        );
        if (!identity.rows.length)
          throw new BadRequestException({
            code: 'USER_NOT_FOUND',
            message: 'Create the Auth user first, then add its user ID',
          });
        await tx
          .insert(profiles)
          .values({ userId: body.userId, displayName: 'User' })
          .onConflictDoNothing();
        const [existing] = await tx
          .select()
          .from(memberships)
          .where(
            and(
              eq(memberships.businessId, c.businessId),
              eq(memberships.userId, body.userId),
            ),
          );
        if (existing)
          throw new ConflictException({
            code: 'MEMBERSHIP_EXISTS',
            message: 'Membership already exists; update it instead',
          });
        const [value] = await tx
          .insert(memberships)
          .values({
            userId: body.userId,
            roleKey: 'OWNER',
            businessId: c.businessId,
          })
          .returning();
        return { value, id: value.id, fields: ['userId', 'roleKey'] };
      },
    );
  }
  async updateMember(
    c: TenantContext,
    id: string,
    body: MemberUpdate,
    requestId: string,
  ) {
    return this.mutate(
      c,
      'user.manage',
      requestId,
      body.status === 'DISABLED' ? 'membership.disable' : 'membership.update',
      'membership',
      async (tx) => {
        const [before] = await tx
          .select()
          .from(memberships)
          .where(
            and(
              eq(memberships.id, id),
              eq(memberships.businessId, c.businessId),
            ),
          );
        if (!before)
          throw new NotFoundException({
            code: 'NOT_FOUND',
            message: 'Membership not found',
          });
        if (
          before.roleKey === 'OWNER' &&
          before.status === 'ACTIVE' &&
          body.status === 'DISABLED'
        ) {
          const [owners] = await tx
            .select({ total: count() })
            .from(memberships)
            .innerJoin(profiles, eq(profiles.userId, memberships.userId))
            .where(
              and(
                eq(memberships.businessId, c.businessId),
                eq(memberships.roleKey, 'OWNER'),
                eq(memberships.status, 'ACTIVE'),
                eq(profiles.status, 'ACTIVE'),
              ),
            );
          if (owners.total <= 1)
            throw new ConflictException({
              code: 'LAST_OWNER',
              message: 'The business must retain an active owner',
            });
        }
        const [value] = await tx
          .update(memberships)
          .set({
            status: body.status,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(memberships.id, id),
              eq(memberships.businessId, c.businessId),
            ),
          )
          .returning();
        return { value, id, fields: Object.keys(body) };
      },
    );
  }
  async getSettings(c: TenantContext) {
    const [row] = await this.database.db
      .select()
      .from(settings)
      .where(eq(settings.businessId, c.businessId));
    return row ?? { businessId: c.businessId, config: {} };
  }
  async updateSettings(
    c: TenantContext,
    body: SettingsUpdate,
    requestId: string,
  ) {
    return this.mutate(
      c,
      'settings.update',
      requestId,
      'settings.update',
      'settings',
      async (tx) => {
        const [value] = await tx
          .insert(settings)
          .values({ businessId: c.businessId, config: body.config })
          .onConflictDoUpdate({
            target: settings.businessId,
            set: { config: body.config, updatedAt: new Date() },
          })
          .returning();
        return { value, id: c.businessId, fields: Object.keys(body.config) };
      },
    );
  }
  async audit(c: TenantContext, q: PageQuery) {
    const where = eq(auditLogs.businessId, c.businessId);
    const data = await this.database.db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(q.limit)
      .offset((q.page - 1) * q.limit);
    const [row] = await this.database.db
      .select({ total: count() })
      .from(auditLogs)
      .where(where);
    return { data, page: q.page, limit: q.limit, total: row.total };
  }
}
