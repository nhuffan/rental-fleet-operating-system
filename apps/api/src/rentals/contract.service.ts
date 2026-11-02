import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, max, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { Database } from '../database/database.js';
import {
  auditLogs,
  businesses,
  customers,
  memberships,
  profiles,
  rentalContractDocuments,
  rentalQuoteSnapshots,
  rentals,
  vehicles,
} from '../database/schema.js';
import { denied, type TenantContext } from '../auth/guards.js';
import { permissionsFor, type Permission } from '../auth/permissions.js';
import { presentPricingSnapshot } from '../pricing/pricing.service.js';
import { DEFAULT_CONTRACT_TERMS_VI } from './contract-terms.js';
import type {
  ContractDocumentResponse,
  ContractDocumentsResponse,
  ContractSnapshotResponse,
} from './contract-responses.js';

type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];
const notFound = () =>
  new NotFoundException({
    code: 'CONTRACT_NOT_FOUND',
    message: 'Rental contract not found',
  });
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b, 'en'))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
export function contractContentHash(snapshot: ContractSnapshotResponse) {
  return createHash('sha256')
    .update(JSON.stringify(canonical(snapshot)))
    .digest('hex');
}
const exactMoney = (value: string) =>
  value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value;
const document = (
  row: typeof rentalContractDocuments.$inferSelect,
): ContractDocumentResponse => ({
  ...row,
  issuedAt: row.issuedAt.toISOString(),
});
@Injectable()
export class ContractService {
  constructor(@Inject(Database) private readonly database: Database) {}
  private async access(
    tx: Tx,
    c: TenantContext,
    permission: Permission,
    lock = false,
  ) {
    const query = tx
      .select()
      .from(businesses)
      .where(eq(businesses.id, c.businessId));
    const [business] = await (lock ? query.for('update') : query);
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
    return business;
  }
  private async rental(tx: Tx, c: TenantContext, id: string) {
    const [row] = await tx
      .select({
        rental: rentals,
        customer: customers,
        vehicle: vehicles,
        pricing: rentalQuoteSnapshots,
      })
      .from(rentals)
      .innerJoin(
        customers,
        and(
          eq(customers.businessId, c.businessId),
          eq(customers.id, rentals.customerId),
        ),
      )
      .innerJoin(
        vehicles,
        and(
          eq(vehicles.businessId, c.businessId),
          eq(vehicles.id, rentals.vehicleId),
        ),
      )
      .leftJoin(
        rentalQuoteSnapshots,
        and(
          eq(rentalQuoteSnapshots.businessId, c.businessId),
          eq(rentalQuoteSnapshots.rentalId, rentals.id),
        ),
      )
      .where(and(eq(rentals.businessId, c.businessId), eq(rentals.id, id)));
    if (!row) throw notFound();
    return row;
  }
  private snapshot(
    b: typeof businesses.$inferSelect,
    row: Awaited<ReturnType<ContractService['rental']>>,
  ): ContractSnapshotResponse {
    const { rental: r, customer: c, vehicle: v, pricing } = row;
    const missing = [
      [b.legalName, 'Tên pháp lý doanh nghiệp'],
      [b.address, 'Địa chỉ doanh nghiệp'],
      [b.phone, 'Số điện thoại doanh nghiệp'],
      [b.taxCode, 'Mã số thuế'],
      [b.representativeName, 'Người đại diện'],
      [b.representativeTitle, 'Chức danh đại diện'],
      [c.idNumber, 'CCCD của khách'],
      [c.address, 'Địa chỉ khách'],
      [c.driverLicenseNumber, 'Số giấy phép lái xe'],
      [c.driverLicenseClass, 'Hạng giấy phép lái xe'],
    ]
      .filter(([value]) => !value)
      .map(([, label]) => label);
    return {
      schemaVersion: 1,
      business: {
        legalName: b.legalName,
        name: b.name,
        address: b.address,
        phone: b.phone,
        taxCode: b.taxCode,
        representativeName: b.representativeName,
        representativeTitle: b.representativeTitle,
        timezone: b.timezone,
        currency: b.currency,
      },
      customer: {
        name: c.name,
        phone: c.phone,
        email: c.email,
        idNumber: c.idNumber,
        address: c.address,
        driverLicenseNumber: c.driverLicenseNumber,
        driverLicenseClass: c.driverLicenseClass,
      },
      vehicle: { licensePlate: v.licensePlate, make: v.make, model: v.model },
      rental: {
        id: r.id,
        startAt: r.startAt.toISOString(),
        endAt: r.endAt.toISOString(),
        status: r.status,
        rentalAmount: exactMoney(r.rentalAmount),
        depositRequiredAmount: exactMoney(r.depositRequiredAmount),
        depositReceived: r.depositReceived,
        notes: r.notes,
      },
      pricing: presentPricingSnapshot(pricing),
      terms: b.contractTerms || DEFAULT_CONTRACT_TERMS_VI,
      missing,
    };
  }
  private async latest(tx: Tx, c: TenantContext, id: string) {
    const [row] = await tx
      .select()
      .from(rentalContractDocuments)
      .where(
        and(
          eq(rentalContractDocuments.businessId, c.businessId),
          eq(rentalContractDocuments.rentalId, id),
        ),
      )
      .orderBy(desc(rentalContractDocuments.version))
      .limit(1);
    return row;
  }
  async list(c: TenantContext, id: string): Promise<ContractDocumentsResponse> {
    return this.database.db.transaction(async (tx) => {
      const business = await this.access(tx, c, 'rental.read');
      const rental = await this.rental(tx, c, id);
      const latest = await this.latest(tx, c, id);
      const versions = await tx
        .select({
          version: rentalContractDocuments.version,
          docNumber: rentalContractDocuments.docNumber,
          issuedAt: rentalContractDocuments.issuedAt,
        })
        .from(rentalContractDocuments)
        .where(
          and(
            eq(rentalContractDocuments.businessId, c.businessId),
            eq(rentalContractDocuments.rentalId, id),
          ),
        )
        .orderBy(desc(rentalContractDocuments.version))
        .limit(100);
      const [{ total }] = await tx
        .select({ total: count() })
        .from(rentalContractDocuments)
        .where(
          and(
            eq(rentalContractDocuments.businessId, c.businessId),
            eq(rentalContractDocuments.rentalId, id),
          ),
        );
      const eligible = ['RESERVED', 'ACTIVE', 'COMPLETED'].includes(
        rental.rental.status,
      );
      return {
        latest: latest ? document(latest) : null,
        versions: versions.map((v) => ({
          ...v,
          issuedAt: v.issuedAt.toISOString(),
        })),
        versionCount: total,
        dataChanged:
          eligible &&
          (!latest ||
            latest.contentHash !==
              contractContentHash(this.snapshot(business, rental))),
      };
    });
  }
  async version(
    c: TenantContext,
    id: string,
    version: number,
  ): Promise<ContractDocumentResponse> {
    return this.database.db.transaction(async (tx) => {
      await this.access(tx, c, 'rental.read');
      const [row] = await tx
        .select()
        .from(rentalContractDocuments)
        .where(
          and(
            eq(rentalContractDocuments.businessId, c.businessId),
            eq(rentalContractDocuments.rentalId, id),
            eq(rentalContractDocuments.version, version),
          ),
        );
      if (!row) throw notFound();
      return document(row);
    });
  }
  async issue(
    c: TenantContext,
    id: string,
    requestId: string,
  ): Promise<{ created: boolean; document: ContractDocumentResponse }> {
    return this.database.db.transaction(async (tx) => {
      const business = await this.access(tx, c, 'rental.manage', true);
      const rental = await this.rental(tx, c, id);
      if (!['RESERVED', 'ACTIVE', 'COMPLETED'].includes(rental.rental.status))
        throw new ConflictException({
          code: 'CONTRACT_NOT_READY',
          message:
            'Reserve the rental before issuing a contract; cancelled rentals cannot be issued',
        });
      const snapshot = this.snapshot(business, rental);
      // JSONB adds whitespace; leave a small envelope margin under the database's 64KiB cap.
      if (Buffer.byteLength(JSON.stringify(snapshot), 'utf8') > 60000)
        throw new ConflictException({
          code: 'CONTRACT_TOO_LARGE',
          message: 'The contract exceeds its document size limit',
        });
      const hash = contractContentHash(snapshot);
      const latest = await this.latest(tx, c, id);
      if (latest?.contentHash === hash)
        return { created: false, document: document(latest) };
      const [{ last }] = await tx
        .select({ last: max(rentalContractDocuments.seq) })
        .from(rentalContractDocuments)
        .where(eq(rentalContractDocuments.businessId, c.businessId));
      const seq = (last ?? 0) + 1,
        version = (latest?.version ?? 0) + 1;
      if (seq > 999999 || version > 2147483647)
        throw new ConflictException({
          code: 'CONTRACT_NUMBER_EXHAUSTED',
          message: 'Contract numbering limit reached',
        });
      const { rows } = await tx.execute<{ now: string }>(
        sql`select clock_timestamp()::text as now`,
      );
      const now = new Date(rows[0].now);
      const year = new Intl.DateTimeFormat('en', {
        year: 'numeric',
        timeZone: business.timezone,
      }).format(now);
      const docNumber = `HD-${year}-${String(seq).padStart(6, '0')}`;
      const [saved] = await tx
        .insert(rentalContractDocuments)
        .values({
          businessId: c.businessId,
          rentalId: id,
          seq,
          docNumber,
          version,
          contentHash: hash,
          snapshot,
          issuedBy: c.userId,
          issuedAt: now,
        })
        .returning();
      await tx
        .insert(auditLogs)
        .values({
          businessId: c.businessId,
          actorUserId: c.userId,
          action: 'rental.contract.issue',
          entityType: 'rental',
          entityId: id,
          metadata: { requestId, rentalId: id, version, docNumber },
        });
      return { created: true, document: document(saved) };
    });
  }
}
