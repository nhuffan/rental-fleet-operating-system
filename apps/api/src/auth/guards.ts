import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Inject,
  SetMetadata,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createClient } from '@supabase/supabase-js';
import { and, eq, asc } from 'drizzle-orm';
import type { Request } from 'express';
import { isUUID } from 'class-validator';
import { Database } from '../database/database.js';
import { businesses, memberships, profiles } from '../database/schema.js';
import { loadConfig } from '../config.js';
import { permissionsFor, type Permission } from './permissions.js';
export type TenantContext = {
  userId: string;
  email: string;
  businessId: string;
  businessName: string;
  role: string;
  membershipId: string;
};
export type AuthRequest = Request & {
  requestId: string;
  identity: { id: string; email: string };
  tenant: TenantContext;
};
export const RequirePermission = (permission: Permission) =>
  SetMetadata('permission', permission);
export const denied = () =>
  new ForbiddenException({
    code: 'TENANT_ACCESS_DENIED',
    message: 'Access denied for this business',
  });
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly client;
  constructor() {
    const c = loadConfig();
    this.client = createClient(c.supabaseUrl, c.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const match = /^Bearer ([^\s]+)$/i.exec(
      request.headers.authorization ?? '',
    );
    if (!match)
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Authentication required',
      });
    try {
      // Online verification checks the signature, expiry and current Auth user; no JWT/user_metadata authorization.
      const { data, error } = await this.client.auth.getUser(match[1]);
      if (error || !data.user || data.user.is_anonymous)
        throw new Error('Invalid session');
      request.identity = { id: data.user.id, email: data.user.email ?? '' };
      return true;
    } catch {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Invalid or expired session',
      });
    }
  }
}
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(@Inject(Database) private readonly database: Database) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const selected = req.headers['x-business-id'];
    if (
      selected !== undefined &&
      (typeof selected !== 'string' || !isUUID(selected))
    )
      throw new BadRequestException({
        code: 'INVALID_TENANT',
        message: 'X-Business-Id must be a UUID',
      });
    const rows = await this.database.db
      .select({
        id: memberships.id,
        businessId: businesses.id,
        name: businesses.name,
        role: memberships.roleKey,
      })
      .from(memberships)
      .innerJoin(businesses, eq(businesses.id, memberships.businessId))
      .innerJoin(profiles, eq(profiles.userId, memberships.userId))
      .where(
        and(
          eq(memberships.userId, req.identity.id),
          eq(memberships.status, 'ACTIVE'),
          eq(memberships.roleKey, 'OWNER'),
          eq(businesses.status, 'ACTIVE'),
          eq(profiles.status, 'ACTIVE'),
          selected ? eq(businesses.id, selected) : undefined,
        ),
      )
      .orderBy(asc(memberships.createdAt), asc(memberships.id))
      .limit(1);
    const row = rows[0];
    if (!row) throw denied();
    req.tenant = {
      userId: req.identity.id,
      email: req.identity.email,
      businessId: row.businessId,
      businessName: row.name,
      role: row.role,
      membershipId: row.id,
    };
    return true;
  }
}
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const permission = this.reflector.getAllAndOverride<Permission>(
      'permission',
      [context.getHandler(), context.getClass()],
    );
    if (
      permission &&
      !permissionsFor(
        context.switchToHttp().getRequest<AuthRequest>().tenant.role,
      ).includes(permission)
    )
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Permission denied',
      });
    return true;
  }
}
