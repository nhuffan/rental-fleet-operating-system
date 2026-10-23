import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { PoolClient } from 'pg';
import { Database } from '../database/database.js';
import {
  platformPermissionsFor,
  type PlatformPermission,
} from './permissions.js';
export type PlatformContext = {
  userId: string;
  membershipId: string;
  displayName: string;
  role: string;
};
export type PlatformRequest = Request & {
  requestId: string;
  identity: { id: string; email: string };
  platform: PlatformContext;
};
export const RequirePlatformPermission = (permission: PlatformPermission) =>
  SetMetadata('platformPermission', permission);
export const platformDenied = () =>
  new ForbiddenException({
    code: 'PLATFORM_ACCESS_DENIED',
    message: 'Platform access is not available for this account',
  });
export async function findPlatformPrincipal(
  query: Pick<PoolClient, 'query'>,
  userId: string,
  lock = false,
): Promise<PlatformContext> {
  // Neither tenant memberships, selected-business headers nor user_metadata participate.
  const result = await query.query<{
    userId: string;
    membershipId: string;
    displayName: string;
    role: string;
  }>(
    `
    select m.user_id as "userId",m.id as "membershipId",p.display_name as "displayName",m.role_key as role
    from public.platform_memberships m join public.user_profiles p on p.user_id=m.user_id
    where m.user_id=$1 and m.status='ACTIVE' and p.status='ACTIVE'${lock ? ' for update of m,p' : ''}`,
    [userId],
  );
  const principal = result.rows[0];
  if (!principal || !platformPermissionsFor(principal.role).length)
    throw platformDenied();
  return principal;
}
@Injectable()
export class PlatformGuard implements CanActivate {
  constructor(
    @Inject(Database) private readonly database: Database,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<PlatformRequest>();
    const principal = await findPlatformPrincipal(
      this.database.pool,
      request.identity.id,
    );
    const permission = this.reflector.getAllAndOverride<PlatformPermission>(
      'platformPermission',
      [context.getHandler(), context.getClass()],
    );
    if (
      permission &&
      !platformPermissionsFor(principal.role).includes(permission)
    )
      throw platformDenied();
    request.platform = principal;
    return true;
  }
}
