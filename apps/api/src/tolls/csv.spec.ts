import { csvRecords, parseTollCsv, type TollCsvInput } from './csv.js';
const input = (
  csv = 'plate,time,amount,station,reference,description\n51A-123.45,2026-10-24T08:30:00+07:00,35000,Trạm A,TX-1,Phí qua trạm',
  extra: Partial<TollCsvInput> = {},
): TollCsvInput => ({
  source: ' Owner_CSV ',
  csv,
  delimiter: ',',
  mapping: {
    plate: 0,
    occurredAt: 1,
    amount: 2,
    station: 3,
    externalReference: 4,
    description: 5,
  },
  dateFormat: 'ISO_OFFSET',
  timezoneOffset: '+07:00',
  amountFormat: 'INTEGER',
  ...extra,
});
it('reads UTF-8/BOM, CRLF, quoted delimiters, escaped quotes and multiline descriptions', () => {
  const parsed = parseTollCsv(
    input(
      '\uFEFFplate;time;amount;station;reference;description\r\n51A-123.45;24/10/2026 08:30:00;35.000;"Trạm; A";TX-1;"Ghi ""nhận""\r\nqua trạm"\r\n',
      { delimiter: ';', dateFormat: 'DMY_LOCAL', amountFormat: 'DOT_GROUPED' },
    ),
  );
  expect(parsed.rows).toHaveLength(1);
  expect(parsed.rows[0]).toMatchObject({
    rowNumber: 2,
    errors: [],
    normalized: {
      source: 'owner_csv',
      plate: '51A12345',
      occurredAt: '2026-10-24T01:30:00.000Z',
      amount: '35000',
      station: 'Trạm; A',
      description: 'Ghi "nhận"\r\nqua trạm',
    },
  });
});
it('supports tab-separated statements and explicit comma grouping without floating-point loss', () => {
  const row = parseTollCsv(
    input(
      'plate\ttime\tamount\n51A12345\t2026-10-24 08:30\t999,999,999,999,999',
      {
        delimiter: '\t',
        mapping: { plate: 0, occurredAt: 1, amount: 2 },
        dateFormat: 'ISO_LOCAL',
        amountFormat: 'COMMA_GROUPED',
      },
    ),
  ).rows[0];
  expect(row.normalized?.amount).toBe('999999999999999');
  expect(row.errors).toEqual([]);
});
it('reports row errors without dropping valid rows or guessing an unzoned date', () => {
  const parsed = parseTollCsv(
    input(
      'p,t,a\n51A12345,2026-10-24T08:00:00Z,1000\n?,2026-10-24 08:00,12.50\n51A12345,2026-10-24T08:00:00Z,1000,extra',
      { mapping: { plate: 0, occurredAt: 1, amount: 2 } },
    ),
  );
  expect(parsed.rows[0].normalized).not.toBeNull();
  expect(parsed.rows[1].errors).toHaveLength(3);
  expect(parsed.rows[1].normalized).toBeNull();
  expect(parsed.rows[2].errors[0]).toContain('Số cột');
});
it('validates calendar dates, leap years, clock and offset bounds instead of normalizing invalid dates', () => {
  for (const date of [
    '2026-02-29T00:00:00Z',
    '2026-04-31T00:00:00Z',
    '2026-10-24T24:00:00Z',
    '2026-10-24T01:60:00Z',
    '2026-10-24T01:00:60Z',
    '2026-10-24T08:00:00+14:30',
    '2026-10-24T08:00:00+99:00',
  ])
    expect(
      parseTollCsv(
        input(`p,t,a\n51A12345,${date},1000`, {
          mapping: { plate: 0, occurredAt: 1, amount: 2 },
        }),
      ).rows[0].normalized,
    ).toBeNull();
  expect(
    parseTollCsv(
      input('p,t,a\n51A12345,2024-02-29T00:00:00Z,1000', {
        mapping: { plate: 0, occurredAt: 1, amount: 2 },
      }),
    ).rows[0].normalized?.occurredAt,
  ).toBe('2024-02-29T00:00:00.000Z');
});
it('rejects zero, negative, fractional, unsafe-sized and malformed-group money', () => {
  for (const amount of [
    '0',
    '-35000',
    '3.5',
    '1e3',
    '+35000',
    '001000',
    '1000000000000000',
    '12.34',
    '1.23.000',
  ])
    expect(
      parseTollCsv(
        input(`p;t;a\n51A12345;2026-10-24T08:00:00Z;${amount}`, {
          delimiter: ';',
          mapping: { plate: 0, occurredAt: 1, amount: 2 },
          amountFormat: 'DOT_GROUPED',
        }),
      ).rows[0].normalized,
    ).toBeNull();
});
it('uses canonical plate/time/amount/station fingerprints while preserving different external references', () => {
  const first = parseTollCsv(input()).rows[0].normalized!;
  const second = parseTollCsv(
    input(
      'p,t,a,s,r,d\n51a12345,2026-10-24T01:30:00Z,35000,TRẠM   A,OTHER,Changed note',
    ),
  ).rows[0].normalized!;
  expect(second.fingerprint).toBe(first.fingerprint);
  expect(second.externalReference).not.toBe(first.externalReference);
  const changed = parseTollCsv(
    input('p,t,a,s,r,d\n51A12345,2026-10-24T01:30:00Z,35001,Trạm A,TX-1,Note'),
  ).rows[0].normalized!;
  expect(changed.fingerprint).not.toBe(first.fingerprint);
});
it('rejects forged mappings, reused columns and incompatible source options', () => {
  for (const extra of [
    { mapping: { plate: 0, occurredAt: 0, amount: 2 } },
    { mapping: { plate: 0, occurredAt: 1, amount: 32 } },
    { timezoneOffset: 'Asia/Ho_Chi_Minh' },
    { source: '' },
    { amountFormat: 'AUTO' },
  ])
    expect(() => parseTollCsv(input(undefined, extra))).toThrow();
});
it('bounds file bytes, logical rows, columns and cells and fails malformed quoting/encoding', () => {
  for (const csv of [
    'p,t,a\n' + 'x'.repeat(65536),
    'p,t,a\n' + 'p,t,a\n'.repeat(201),
    Array(33).fill('x').join(',') + '\np,t,a',
    'p,t,a\n' + 'x'.repeat(2001),
    'p,t,a\n"unterminated',
    'p,t,a\n"value"junk,t,a',
    'p,t,a\np,\uFFFD,a',
    'p,t,a\np,\u0000,a',
    'p,t,a\np,\uD800,a',
  ])
    expect(() => csvRecords(csv, ',')).toThrow();
});
it('gives stable preview hashes for equivalent BOM/mapping key order and changes on any import interpretation change', () => {
  const original = input(),
    parsed = parseTollCsv(original);
  expect(
    parseTollCsv({ ...original, csv: '\uFEFF' + original.csv }).contentHash,
  ).toBe(parsed.contentHash);
  expect(
    parseTollCsv({
      ...original,
      mapping: {
        description: 5,
        externalReference: 4,
        station: 3,
        amount: 2,
        occurredAt: 1,
        plate: 0,
      },
    }).contentHash,
  ).toBe(parsed.contentHash);
  expect(
    parseTollCsv({ ...original, timezoneOffset: '+08:00' }).contentHash,
  ).not.toBe(parsed.contentHash);
});
