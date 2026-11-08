import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { AuthAdminService } from './auth-admin.service.js';
import { PageQuery } from '../core/dto.js';
import { JobScheduler } from '../jobs/job-scheduler.js';
import { FEATURE_CATALOG, integrationStatus, systemLimits } from './system.js';
import { Database } from '../database/database.js';
import {
  findPlatformPrincipal,
  platformDenied,
  type PlatformContext,
} from './guards.js';
import {
  platformPermissionsFor,
  type PlatformPermission,
} from './permissions.js';
import {
  PlatformBusinessCreate,
  PlatformBusinessStatusInput,
  PlatformOwnerLinkInput,
  type PlatformProvisioningResponse,
  type PlatformOwnerLinkResponse,
  type PlatformBusinessRecord,
  type PlatformBusinessDetail,
  type PlatformBusinessOwner,
  PlatformBusinessQuery,
  PlatformAuditQuery,
  PlatformUserQuery,
  PLATFORM_AUDIT_ACTIONS,
  type PlatformAuditPage,
  type PlatformUserPage,
  type PlatformUser,
  type PlatformUserDetail,
  type PlatformUserMembership,
  type PlatformBusiness,
  type PlatformBusinessPage,
  type PlatformMe,
  type PlatformOverview,
  type PlatformSystem,
} from './dto.js';
const counts = (alias: string) =>
  `jsonb_build_object('branches',coalesce(br.n,0),'activeBranches',coalesce(br.active,0),'memberships',coalesce(m.n,0),'activeMemberships',coalesce(m.active,0),'vehicles',coalesce(v.n,0),'activeVehicles',coalesce(v.active,0),'rentals',coalesce(r.n,0),'activeRentals',coalesce(r.active,0),'reservedRentals',coalesce(r.reserved,0)) as ${alias}`;
const gps = `jsonb_build_object('sourceMode','TEST','FRESH',coalesce(g.fresh,0),'STALE',coalesce(g.stale,0),'OFFLINE',coalesce(g.offline,0),'NO_DATA',coalesce(g.no_data,0),'UNASSIGNED',coalesce(g.unassigned,0)) as gps`;
// Aggregate each domain once for the selected business IDs; no browser tenant loops,
// no raw users, coordinates, tracker UIDs, settings, notes or credential projections.
const aggregates = `
 branches_agg as (select business_id,count(*)::int n,count(*) filter(where status='ACTIVE')::int active from public.branches where business_id in(select id from selected) group by business_id),
 memberships_agg as (select m.business_id,count(*)::int n,count(*) filter(where m.status='ACTIVE' and p.status='ACTIVE')::int active from public.business_memberships m join public.user_profiles p on p.user_id=m.user_id where m.business_id in(select id from selected) group by m.business_id),
 vehicles_agg as (select business_id,count(*)::int n,count(*) filter(where status='ACTIVE')::int active from public.vehicles where business_id in(select id from selected) group by business_id),
 rentals_agg as (select business_id,count(*)::int n,count(*) filter(where status='ACTIVE')::int active,count(*) filter(where status='RESERVED')::int reserved from public.rentals where business_id in(select id from selected) group by business_id),
 locations as (select v.business_id,case when a.id is null then 'UNASSIGNED' when p.recorded_at is null then 'NO_DATA' when p.recorded_at>=statement_timestamp()-interval '120 seconds' then 'FRESH' when p.recorded_at>=statement_timestamp()-interval '600 seconds' then 'STALE' else 'OFFLINE' end state
 from public.vehicles v left join public.device_assignments a on a.business_id=v.business_id and a.vehicle_id=v.id and a.unassigned_at is null
 left join lateral(select recorded_at from public.gps_positions p where p.business_id=v.business_id and p.assignment_id=a.id order by recorded_at desc,received_at asc,id asc limit 1)p on true where v.business_id in(select id from selected)),
 gps_agg as(select business_id,count(*) filter(where state='FRESH')::int fresh,count(*) filter(where state='STALE')::int stale,count(*) filter(where state='OFFLINE')::int offline,count(*) filter(where state='NO_DATA')::int no_data,count(*) filter(where state='UNASSIGNED')::int unassigned from locations group by business_id)`;
const joins = `left join branches_agg br on br.business_id=b.id left join memberships_agg m on m.business_id=b.id left join vehicles_agg v on v.business_id=b.id left join rentals_agg r on r.business_id=b.id left join gps_agg g on g.business_id=b.id`;
const projection = `b.id,b.name,b.status,b.timezone,b.currency,b.created_at as "createdAt",b.updated_at as "updatedAt",${counts('counts')},${gps}`;
const userProjection = `p.user_id as id,p.display_name as "displayName",p.status,p.created_at as "createdAt",p.updated_at as "updatedAt",coalesce(pm.status,'NONE') as "platformStatus",coalesce(m.n,0)::int as "membershipCount",coalesce(m.active,0)::int as "activeMembershipCount",coalesce(m.roles,'[]'::jsonb) roles`;
const userJoins = `left join public.platform_memberships pm on pm.user_id=p.user_id left join lateral(select count(*)::int n,count(*) filter(where bm.status='ACTIVE' and b.status='ACTIVE' and p.status='ACTIVE')::int active,jsonb_agg(distinct bm.role_key order by bm.role_key) roles from public.business_memberships bm join public.businesses b on b.id=bm.business_id where bm.user_id=p.user_id and bm.role_key='OWNER')m on true`;
@Injectable()
export class PlatformService {
  constructor(
    @Inject(Database) private readonly database: Database,
    @Inject(AuthAdminService) private readonly authAdmin?: AuthAdminService,
    @Optional() @Inject(JobScheduler) private readonly jobs?: JobScheduler,
  ) {}
  private async read<T>(
    c: PlatformContext,
    permission: PlatformPermission | null,
    requestId: string,
    action: string,
    entityId: string | null,
    operation: (tx: PoolClient, principal: PlatformContext) => Promise<T>,
    entityType: string = entityId ? 'business' : 'platform',
  ): Promise<T> {
    const tx = await this.database.pool.connect();
    try {
      await tx.query('begin');
      // Row locks serialize with trusted membership/profile revocation. Re-read
      // role/status inside the same transaction that produces data and audit.
      const principal = await findPlatformPrincipal(tx, c.userId, true);
      if (
        permission &&
        !platformPermissionsFor(principal.role).includes(permission)
      )
        throw platformDenied();
      const result = await operation(tx, principal);
      await tx.query(
        'insert into public.platform_audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values($1,$2,$3,$4,$5::jsonb)',
        [
          principal.userId,
          action,
          entityType,
          entityId,
          JSON.stringify({ requestId }),
        ],
      );
      await tx.query('commit');
      return result;
    } catch (error) {
      await tx.query('rollback');
      throw error;
    } finally {
      tx.release();
    }
  }
  system(c: PlatformContext, requestId: string): Promise<PlatformSystem> {
    return this.read(
      c,
      'platform.system.read',
      requestId,
      'platform.system.read',
      null,
      async (tx) => {
        const now = await tx.query<{ at: Date }>('select now() as at');
        // supabase_migrations exists only where the Supabase CLI applied history.
        const history = await tx.query<{ present: boolean }>(
          "select to_regclass('supabase_migrations.schema_migrations') is not null as present",
        );
        let latestMigration: string | null = null,
          migrationCount: number | null = null;
        if (history.rows[0].present) {
          const migrations = await tx.query<{
            latest: string | null;
            total: number;
          }>(
            'select max(version) as latest, count(*)::int as total from supabase_migrations.schema_migrations',
          );
          latestMigration = migrations.rows[0].latest;
          migrationCount = migrations.rows[0].total;
        }
        const environment = process.env.APP_ENV;
        return {
          asOf: now.rows[0].at.toISOString(),
          environment:
            environment &&
            ['development', 'test', 'staging', 'production'].includes(
              environment,
            )
              ? environment
              : 'development',
          database: { reachable: true, latestMigration, migrationCount },
          integrations: integrationStatus(process.env),
          features: [...FEATURE_CATALOG],
          limits: systemLimits(),
          jobs: this.jobs?.status() ?? { enabled: false, jobs: [] },
        };
      },
    );
  }
  me(c: PlatformContext, requestId: string): Promise<PlatformMe> {
    return this.read(
      c,
      null,
      requestId,
      'platform.me.read',
      null,
      async (_tx, p) => ({
        principal: {
          id: p.membershipId,
          userId: p.userId,
          displayName: p.displayName,
          role: p.role,
        },
        permissions: platformPermissionsFor(p.role),
        readOnly: false,
      }),
    );
  }
  businesses(
    c: PlatformContext,
    q: PlatformBusinessQuery,
    requestId: string,
  ): Promise<PlatformBusinessPage> {
    return this.read(
      c,
      'platform.business.read',
      requestId,
      'platform.businesses.read',
      null,
      async (tx) => {
        const column = q.sort === 'name' ? 'name' : 'created_at',
          direction = q.order === 'asc' ? 'asc' : 'desc';
        const pattern = '%' + (q.search ?? '').replace(/[\\%_]/g, '\\$&') + '%';
        const result = await tx.query<{
          data: PlatformBusiness[];
          total: number;
        }>(
          `with filtered as(select * from public.businesses where ($1::text is null or status=$1) and name ilike $2), selected as(select * from filtered order by ${column} ${direction},id ${direction} limit $3 offset $4),${aggregates},result as(select ${projection} from selected b ${joins}) select coalesce((select jsonb_agg(result order by ${q.sort === 'name' ? 'name' : '"createdAt"'} ${direction},id ${direction}) from result),'[]'::jsonb) data,(select count(*)::int from filtered) total`,
          [q.status ?? null, pattern, q.limit, (q.page - 1) * q.limit],
        );
        return { ...result.rows[0], page: q.page, limit: q.limit };
      },
    );
  }
  business(
    c: PlatformContext,
    id: string,
    requestId: string,
  ): Promise<PlatformBusinessDetail> {
    return this.read(
      c,
      'platform.business.read',
      requestId,
      'platform.business.read',
      id,
      async (tx) => {
        const result = await tx.query<PlatformBusiness>(
          `with selected as(select * from public.businesses where id=$1),${aggregates} select ${projection} from selected b ${joins}`,
          [id],
        );
        if (!result.rows[0])
          throw new NotFoundException({
            code: 'PLATFORM_BUSINESS_NOT_FOUND',
            message: 'Business not found',
          });
        const owners = await tx.query<PlatformBusinessOwner>(
          `select m.id as "membershipId",m.user_id as "userId",p.display_name as "displayName",m.status,p.status as "profileStatus" from public.business_memberships m join public.user_profiles p on p.user_id=m.user_id where m.business_id=$1 and m.role_key='OWNER' order by p.display_name,m.id limit 100`,
          [id],
        );
        const total = await tx.query<{ total: number }>(
          "select count(*)::int total from public.business_memberships where business_id=$1 and role_key='OWNER'",
          [id],
        );
        return {
          ...Object.assign({}, result.rows[0]),
          owners: { data: owners.rows, total: total.rows[0].total },
        };
      },
    );
  }
  async audit(
    c: PlatformContext,
    q: PlatformAuditQuery,
    requestId: string,
  ): Promise<PlatformAuditPage> {
    const until = q.until ? new Date(q.until) : new Date();
    const from = q.from
      ? new Date(q.from)
      : new Date(until.getTime() - 30 * 86400000);
    if (
      !Number.isFinite(from.getTime()) ||
      !Number.isFinite(until.getTime()) ||
      from >= until ||
      until.getTime() - from.getTime() > 366 * 86400000
    )
      throw new BadRequestException({
        code: 'INVALID_AUDIT_RANGE',
        message: 'Audit range must be positive and at most 366 days',
      });
    return this.read(
      c,
      'platform.audit.read',
      requestId,
      'platform.audit.read',
      q.businessId ?? null,
      async (tx) => {
        const column = q.sort === 'action' ? 'action' : '"createdAt"';
        const order = q.order === 'asc' ? 'asc' : 'desc';
        const result = await tx.query<{
          data: PlatformAuditPage['data'];
          total: number;
        }>(
          `
        with reviewed as(select id,actor_user_id as "actorId",
          case when action=any($1::text[]) then action else 'other' end action,
          case when entity_type in('platform','business','user','platform_membership') then entity_type else 'other' end as "entityType",
          case when entity_type in('platform','business','user','platform_membership') then entity_id else null end as "entityId",
          case when jsonb_typeof(metadata->'requestId')='string' and metadata->>'requestId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then metadata->>'requestId' else null end as "requestId",
          created_at as "createdAt" from public.platform_audit_logs
          where created_at >= $2 and created_at < $3 and ($4::uuid is null or (entity_type='business' and entity_id=$4))),
        filtered as(select * from reviewed where ($5::text is null or action=$5)),
        selected as(select * from filtered order by ${column} ${order},id ${order} limit $6 offset $7)
        select coalesce((select jsonb_agg(selected order by ${column} ${order},id ${order}) from selected),'[]'::jsonb) data,(select count(*)::int from filtered) total`,
          [
            PLATFORM_AUDIT_ACTIONS,
            from.toISOString(),
            until.toISOString(),
            q.businessId ?? null,
            q.action ?? null,
            q.limit,
            (q.page - 1) * q.limit,
          ],
        );
        return {
          ...result.rows[0],
          page: q.page,
          limit: q.limit,
          from: from.toISOString(),
          until: until.toISOString(),
        };
      },
    );
  }
  users(
    c: PlatformContext,
    q: PlatformUserQuery,
    requestId: string,
  ): Promise<PlatformUserPage> {
    return this.read(
      c,
      'platform.user.read',
      requestId,
      'platform.users.read',
      null,
      async (tx) => {
        const column = q.sort === 'name' ? 'display_name' : 'created_at';
        const outputColumn =
          q.sort === 'name' ? '"displayName"' : '"createdAt"';
        const direction = q.order === 'asc' ? 'asc' : 'desc';
        const pattern = '%' + (q.search ?? '').replace(/[\\%_]/g, '\\$&') + '%';
        const result = await tx.query<{ data: PlatformUser[]; total: number }>(
          `
        with filtered as(select p.* from public.user_profiles p where ($1::text is null or p.status=$1) and p.display_name ilike $2
          and (($3::uuid is null and $4::text is null) or exists(select 1 from public.business_memberships bm where bm.user_id=p.user_id and bm.role_key='OWNER' and ($3::uuid is null or bm.business_id=$3) and ($4::text is null or bm.status=$4)))),
        selected as(select * from filtered order by ${column} ${direction},user_id ${direction} limit $5 offset $6),
        result as(select ${userProjection} from selected p ${userJoins})
        select coalesce((select jsonb_agg(result order by ${outputColumn} ${direction},id ${direction}) from result),'[]'::jsonb) data,(select count(*)::int from filtered) total`,
          [
            q.status ?? null,
            pattern,
            q.businessId ?? null,
            q.membershipStatus ?? null,
            q.limit,
            (q.page - 1) * q.limit,
          ],
        );
        return { ...result.rows[0], page: q.page, limit: q.limit };
      },
    );
  }
  user(
    c: PlatformContext,
    id: string,
    q: PageQuery,
    requestId: string,
  ): Promise<PlatformUserDetail> {
    return this.read(
      c,
      'platform.user.read',
      requestId,
      'platform.user.read',
      id,
      async (tx) => {
        const profile = (
          await tx.query<PlatformUser>(
            `select ${userProjection} from public.user_profiles p ${userJoins} where p.user_id=$1`,
            [id],
          )
        ).rows[0];
        if (!profile)
          throw new NotFoundException({
            code: 'PLATFORM_USER_NOT_FOUND',
            message: 'User profile not found',
          });
        const rows = await tx.query<PlatformUserMembership>(
          `select m.id,m.business_id as "businessId",b.name as "businessName",b.status as "businessStatus",m.role_key as "roleKey",m.status from public.business_memberships m join public.businesses b on b.id=m.business_id where m.user_id=$1 and m.role_key='OWNER' order by b.name,m.id limit $2 offset $3`,
          [id, q.limit, (q.page - 1) * q.limit],
        );
        return {
          profile,
          memberships: {
            data: rows.rows,
            total: profile.membershipCount,
            page: q.page,
            limit: q.limit,
          },
        };
      },
      'user',
    );
  }
  overview(c: PlatformContext, requestId: string): Promise<PlatformOverview> {
    return this.read(
      c,
      'platform.overview.read',
      requestId,
      'platform.overview.read',
      null,
      async (tx) => {
        const result =
          await tx.query<PlatformOverview>(`with selected as(select * from public.businesses),${aggregates},summary as(select ${projection} from selected b ${joins})
      select statement_timestamp() as "asOf",jsonb_build_object('total',count(*),'ACTIVE',count(*)filter(where status='ACTIVE'),'DISABLED',count(*)filter(where status='DISABLED')) businesses,
      jsonb_build_object('branches',coalesce(sum((counts->>'branches')::int),0),'activeBranches',coalesce(sum((counts->>'activeBranches')::int),0),'memberships',coalesce(sum((counts->>'memberships')::int),0),'activeMemberships',coalesce(sum((counts->>'activeMemberships')::int),0),'vehicles',coalesce(sum((counts->>'vehicles')::int),0),'activeVehicles',coalesce(sum((counts->>'activeVehicles')::int),0),'rentals',coalesce(sum((counts->>'rentals')::int),0),'activeRentals',coalesce(sum((counts->>'activeRentals')::int),0),'reservedRentals',coalesce(sum((counts->>'reservedRentals')::int),0)) totals,
      jsonb_build_object('sourceMode','TEST','FRESH',coalesce(sum((gps->>'FRESH')::int),0),'STALE',coalesce(sum((gps->>'STALE')::int),0),'OFFLINE',coalesce(sum((gps->>'OFFLINE')::int),0),'NO_DATA',coalesce(sum((gps->>'NO_DATA')::int),0),'UNASSIGNED',coalesce(sum((gps->>'UNASSIGNED')::int),0)) gps from summary`);
        return result.rows[0];
      },
    );
  }
  private async principal(
    tx: Pick<PoolClient, 'query'>,
    c: PlatformContext,
    permission: PlatformPermission,
    lock = false,
  ) {
    const principal = await findPlatformPrincipal(tx, c.userId, lock);
    if (!platformPermissionsFor(principal.role).includes(permission))
      throw platformDenied();
    return principal;
  }
  private async write<T>(
    c: PlatformContext,
    permission: PlatformPermission,
    requestId: string,
    action: string,
    entityId: string | null,
    operation: (tx: PoolClient) => Promise<{
      value: T;
      entityId?: string;
      metadata?: Record<string, unknown>;
    }>,
    reusedClient?: PoolClient,
  ) {
    const tx = reusedClient ?? (await this.database.pool.connect());
    try {
      await tx.query('begin');
      const principal = await this.principal(tx, c, permission, true);
      const result = await operation(tx);
      await tx.query(
        'insert into public.platform_audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values($1,$2,$3,$4,$5::jsonb)',
        [
          principal.userId,
          action,
          'business',
          result.entityId ?? entityId,
          JSON.stringify({ requestId, ...result.metadata }),
        ],
      );
      await tx.query('commit');
      return result.value;
    } catch (error) {
      await tx.query('rollback');
      throw error;
    } finally {
      if (!reusedClient) tx.release();
    }
  }
  private async authUser(tx: Pick<PoolClient, 'query'>, email: string) {
    return (
      (
        await tx.query<{ id: string }>(
          'select id from auth.users where lower(email)=$1',
          [email],
        )
      ).rows[0]?.id ?? null
    );
  }
  private async requireActiveOwnerProfile(
    tx: Pick<PoolClient, 'query'>,
    userId: string,
    lock = false,
  ) {
    const profile = (
      await tx.query<{ status: string }>(
        'select status from public.user_profiles where user_id=$1' +
          (lock ? ' for update' : ''),
        [userId],
      )
    ).rows[0];
    if (profile && profile.status !== 'ACTIVE')
      throw new ConflictException({
        code: 'PLATFORM_OWNER_DISABLED',
        message:
          'The Owner profile is disabled; onboarding cannot reactivate it',
      });
  }
  async createBusiness(
    c: PlatformContext,
    body: PlatformBusinessCreate,
    requestId: string,
  ): Promise<PlatformProvisioningResponse> {
    // No identity capability is issued until the independent platform grant is checked.
    await this.principal(this.database.pool, c, 'platform.business.create');
    const email = body.ownerEmail.trim().toLowerCase();
    const serial = await this.database.pool.connect();
    let createdId: string | null = null;
    try {
      // Session lock spans Auth calls and the DB transaction without holding tenant locks.
      // All platform onboarding for one email is serialized, including failed-request cleanup.
      await serial.query('select pg_advisory_lock(190019,hashtext($1))', [
        email,
      ]);
      await this.principal(serial, c, 'platform.business.create');
      let userId = await this.authUser(serial, email);
      if (userId) await this.requireActiveOwnerProfile(serial, userId);
      if (!userId) {
        try {
          const created = await this.authAdmin!.createConfirmedUser(email);
          userId = created.id;
          createdId = userId;
        } catch (error) {
          userId = await this.authUser(serial, email);
          if (!userId) throw error;
        }
      }
      await this.requireActiveOwnerProfile(serial, userId);
      const { hashedToken } = await this.authAdmin!.issueRecoveryToken(email);
      const ownerUserId = userId;
      const value = await this.write(
        c,
        'platform.business.create',
        requestId,
        'platform.business.create',
        null,
        async (tx) => {
          await this.requireActiveOwnerProfile(tx, ownerUserId, true);
          const business = (
            await tx.query<PlatformBusinessRecord>(
              'insert into public.businesses(name,timezone,currency) values($1,$2,$3) returning id,name,status,timezone,currency,created_at as "createdAt",updated_at as "updatedAt"',
              [body.name, body.timezone, body.currency],
            )
          ).rows[0];
          const branch = (
            await tx.query<{ id: string; name: string }>(
              'insert into public.branches(business_id,name) values($1,$2) returning id,name',
              [business.id, body.firstBranchName],
            )
          ).rows[0];
          await tx.query(
            'insert into public.user_profiles(user_id,display_name) values($1,$2) on conflict(user_id) do nothing',
            [ownerUserId, body.ownerDisplayName],
          );
          await this.requireActiveOwnerProfile(tx, ownerUserId, true);
          await tx.query(
            "insert into public.business_memberships(business_id,user_id,role_key,status) values($1,$2,'OWNER','ACTIVE')",
            [business.id, ownerUserId],
          );
          return {
            value: {
              business,
              branch,
              owner: { userId: ownerUserId, created: createdId !== null },
              accessUrl: this.authAdmin!.accessUrl(hashedToken, business.id),
            },
            entityId: business.id,
            metadata: {
              businessId: business.id,
              ownerUserId,
              ownerCreated: createdId !== null,
            },
          };
        },
        serial,
      );
      createdId = null;
      return value;
    } catch (error) {
      if (createdId) {
        // Never delete an identity that another operation has made visible through a
        // profile/membership. Failed cleanup leaves an ungranted orphan safe to retry.
        try {
          const refs = await serial.query<{ used: boolean }>(
            `select exists(select 1 from public.user_profiles where user_id=$1 union all select 1 from public.business_memberships where user_id=$1 union all select 1 from public.platform_memberships where user_id=$1) used`,
            [createdId],
          );
          if (!refs.rows[0].used) await this.authAdmin!.deleteUser(createdId);
        } catch {
          /* No provider error, email or capability is logged. */
        }
      }
      throw error;
    } finally {
      try {
        await serial.query('select pg_advisory_unlock(190019,hashtext($1))', [
          email,
        ]);
      } finally {
        serial.release();
      }
    }
  }
  ownerLink(
    c: PlatformContext,
    id: string,
    body: PlatformOwnerLinkInput,
    requestId: string,
  ): Promise<PlatformOwnerLinkResponse> {
    return this.write(
      c,
      'platform.owner.access',
      requestId,
      'platform.owner.access_link.issue',
      id,
      async (tx) => {
        const business = (
          await tx.query<{ status: string }>(
            'select status from public.businesses where id=$1 for update',
            [id],
          )
        ).rows[0];
        if (!business)
          throw new NotFoundException({
            code: 'PLATFORM_BUSINESS_NOT_FOUND',
            message: 'Business not found',
          });
        if (business.status !== 'ACTIVE')
          throw new ConflictException({
            code: 'PLATFORM_BUSINESS_DISABLED',
            message: 'Activate the business before issuing Owner access',
          });
        const member = (
          await tx.query<{ userId: string; email: string }>(
            `select m.user_id as "userId",u.email from public.business_memberships m join public.user_profiles p on p.user_id=m.user_id join auth.users u on u.id=m.user_id where m.id=$1 and m.business_id=$2 and m.role_key='OWNER' and m.status='ACTIVE' and p.status='ACTIVE' for update of m,p`,
            [body.membershipId, id],
          )
        ).rows[0];
        if (!member?.email)
          throw new NotFoundException({
            code: 'PLATFORM_OWNER_NOT_AVAILABLE',
            message: 'Active Owner not found in this business',
          });
        const { hashedToken } = await this.authAdmin!.issueRecoveryToken(
          member.email,
        );
        return {
          value: { accessUrl: this.authAdmin!.accessUrl(hashedToken, id) },
          metadata: { businessId: id, ownerUserId: member.userId },
        };
      },
    );
  }
  businessStatus(
    c: PlatformContext,
    id: string,
    body: PlatformBusinessStatusInput,
    requestId: string,
  ): Promise<PlatformBusinessRecord> {
    return this.write(
      c,
      'platform.business.manage',
      requestId,
      'platform.business.status.update',
      id,
      async (tx) => {
        const before = (
          await tx.query<PlatformBusinessRecord>(
            'select id,status from public.businesses where id=$1 for update',
            [id],
          )
        ).rows[0];
        if (!before)
          throw new NotFoundException({
            code: 'PLATFORM_BUSINESS_NOT_FOUND',
            message: 'Business not found',
          });
        const value = (
          await tx.query<PlatformBusinessRecord>(
            'update public.businesses set status=$2,updated_at=clock_timestamp() where id=$1 returning id,name,status,timezone,currency,created_at as "createdAt",updated_at as "updatedAt"',
            [id, body.status],
          )
        ).rows[0];
        return {
          value,
          metadata: {
            from: before.status,
            to: body.status,
            fields: ['status'],
          },
        };
      },
    );
  }
}
