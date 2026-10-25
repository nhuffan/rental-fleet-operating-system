import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  EvidenceImportantUpdate,
  EvidenceRentalHoldUpdate,
  EvidenceRetentionSettingsUpdate,
} from './retention.dto.js';
const options = {
  whitelist: true,
  forbidNonWhitelisted: true,
  forbidUnknownValues: true,
};
it('accepts only numeric supported operational retention windows', async () => {
  for (const retentionDays of [30, 90])
    expect(
      await validate(
        plainToInstance(EvidenceRetentionSettingsUpdate, { retentionDays }),
        options,
      ),
    ).toEqual([]);
  for (const retentionDays of [0, 29, 31, 365, '30', null])
    expect(
      (
        await validate(
          plainToInstance(EvidenceRetentionSettingsUpdate, { retentionDays }),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
});
it('requires explicit hold and dispute booleans and a bounded trimmed reason', async () => {
  expect(
    await validate(
      plainToInstance(EvidenceRentalHoldUpdate, {
        active: true,
        unresolvedDispute: true,
        reason: '  evidence dispute  ',
      }),
      options,
    ),
  ).toEqual([]);
  for (const body of [
    { active: true, reason: 'case' },
    { active: 'false', unresolvedDispute: false, reason: 'case' },
    { active: false, unresolvedDispute: false, reason: '  ' },
    { active: false, unresolvedDispute: false, reason: 'x'.repeat(2001) },
  ])
    expect(
      (await validate(plainToInstance(EvidenceRentalHoldUpdate, body), options))
        .length,
    ).toBeGreaterThan(0);
});
it('requires a reason for important/release and rejects forged attribution or purge state', async () => {
  expect(
    await validate(
      plainToInstance(EvidenceImportantUpdate, {
        important: false,
        reason: 'Dispute resolved',
      }),
      options,
    ),
  ).toEqual([]);
  for (const extra of [
    { businessId: 'foreign' },
    { actorId: 'forged' },
    { status: 'PURGED' },
    { leaseId: 'forged' },
  ])
    expect(
      (
        await validate(
          plainToInstance(EvidenceImportantUpdate, {
            important: true,
            reason: 'hold',
            ...extra,
          }),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
  expect(
    (
      await validate(
        plainToInstance(EvidenceImportantUpdate, {
          important: true,
          reason: '\n ',
        }),
        options,
      )
    ).length,
  ).toBeGreaterThan(0);
});
