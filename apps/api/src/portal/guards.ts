import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { AuthRequest } from '../auth/guards.js';
import { Database } from '../database/database.js';
import { findCustomerPrincipal, type CustomerPrincipal } from './principal.js';

export type CustomerRequest = Omit<AuthRequest, 'tenant'> & {
  customer: CustomerPrincipal;
};
export const customerDenied = () =>
  new ForbiddenException({
    code: 'CUSTOMER_ACCESS_DENIED',
    message: 'Customer portal access is not available',
  });

@Injectable()
export class CustomerGuard implements CanActivate {
  constructor(@Inject(Database) private readonly database: Database) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<CustomerRequest>();
    const principal = await findCustomerPrincipal(
      this.database.pool,
      request.identity.id,
    );
    if (!principal) throw customerDenied();
    request.customer = principal;
    return true;
  }
}
