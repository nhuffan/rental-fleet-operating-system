import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PageQuery } from '../core/dto.js';
import { Database } from '../database/database.js';
import type { ContractDocumentResponse } from '../rentals/contract-responses.js';
import { customerDenied } from './guards.js';
import type { PortalRentalResponse } from './responses.js';
import { findCustomerPrincipal, type CustomerPrincipal } from './principal.js';

const NIL_UUID = '00000000-0000-0000-0000-000000000000';
const notFound = () =>
  new NotFoundException({
    code: 'PORTAL_RENTAL_NOT_FOUND',
    message: 'Rental not found',
  });
// Drafts are internal. Every query is bound to the freshly verified customer and business.
const rentalSelect = `select r.id, r.status, r.start_at as "startAt", r.end_at as "endAt",
  v.license_plate as "licensePlate", v.make, v.model,
  r.rental_amount::text as "rentalAmount", r.deposit_required_amount::text as "depositRequiredAmount",
  $3::text as currency,
  (select count(*)::int from public.rental_contract_documents d where d.business_id = r.business_id and d.rental_id = r.id) as "contractCount"
  from public.rentals r
  join public.vehicles v on v.business_id = r.business_id and v.id = r.vehicle_id
  where r.business_id = $1 and r.customer_id = $2 and r.status <> 'DRAFT'`;

@Injectable()
export class PortalService {
  constructor(@Inject(Database) private readonly database: Database) {}

  private async principal(userId: string): Promise<CustomerPrincipal> {
    const principal = await findCustomerPrincipal(this.database.pool, userId);
    if (!principal) throw customerDenied();
    return principal;
  }

  async me(userId: string) {
    const p = await this.principal(userId);
    return {
      customerId: p.customerId,
      customerName: p.customerName,
      businessId: p.businessId,
      businessName: p.businessName,
    };
  }

  async rentals(userId: string, q: PageQuery) {
    const p = await this.principal(userId);
    const [rows, total] = await Promise.all([
      this.database.pool.query(
        `${rentalSelect} order by r.start_at desc, r.id limit $4 offset $5`,
        [p.businessId, p.customerId, p.currency, q.limit, (q.page - 1) * q.limit],
      ),
      this.database.pool.query<{ total: number }>(
        `select count(*)::int as total from public.rentals r where r.business_id = $1 and r.customer_id = $2 and r.status <> 'DRAFT'`,
        [p.businessId, p.customerId],
      ),
    ]);
    return {
      data: rows.rows.map(serialize),
      page: q.page,
      limit: q.limit,
      total: total.rows[0].total,
    };
  }

  async rental(userId: string, id: string) {
    const p = await this.principal(userId);
    const rows = await this.database.pool.query(
      `${rentalSelect} and r.id = $4`,
      [p.businessId, p.customerId, p.currency, id],
    );
    if (!rows.rows[0]) throw notFound();
    const contracts = await this.database.pool.query<{
      version: number;
      docNumber: string;
      issuedAt: Date;
    }>(
      `select version, doc_number as "docNumber", issued_at as "issuedAt"
       from public.rental_contract_documents where business_id = $1 and rental_id = $2
       order by version desc limit 100`,
      [p.businessId, id],
    );
    return {
      ...serialize(rows.rows[0]),
      contracts: contracts.rows.map((c) => ({
        ...c,
        issuedAt: c.issuedAt.toISOString(),
      })),
    };
  }

  async contract(
    userId: string,
    id: string,
    version: number,
  ): Promise<ContractDocumentResponse> {
    const p = await this.principal(userId);
    // The rental join proves ownership by this customer; drafts never have contracts.
    const result = await this.database.pool.query<{
      id: string;
      businessId: string;
      rentalId: string;
      seq: number;
      docNumber: string;
      version: number;
      contentHash: string;
      snapshot: ContractDocumentResponse['snapshot'];
      issuedAt: Date;
    }>(
      `select d.id, d.business_id as "businessId", d.rental_id as "rentalId", d.seq,
         d.doc_number as "docNumber", d.version, d.content_hash as "contentHash",
         d.snapshot, d.issued_at as "issuedAt"
       from public.rental_contract_documents d
       join public.rentals r on r.business_id = d.business_id and r.id = d.rental_id
       where d.business_id = $1 and d.rental_id = $2 and d.version = $3
         and r.customer_id = $4 and r.status <> 'DRAFT'`,
      [p.businessId, id, version, p.customerId],
    );
    const row = result.rows[0];
    if (!row)
      throw new NotFoundException({
        code: 'CONTRACT_NOT_FOUND',
        message: 'Rental contract not found',
      });
    return {
      ...row,
      // Staff identities are internal and never shown to the customer.
      issuedBy: NIL_UUID,
      snapshot: {
        ...row.snapshot,
        pricing: row.snapshot.pricing
          ? { ...row.snapshot.pricing, createdBy: NIL_UUID, overrideReason: null }
          : null,
      },
      issuedAt: row.issuedAt.toISOString(),
    };
  }
}

function serialize(row: Record<string, unknown>): PortalRentalResponse {
  return {
    ...(row as unknown as PortalRentalResponse),
    startAt: (row.startAt as Date).toISOString(),
    endAt: (row.endAt as Date).toISOString(),
  };
}
