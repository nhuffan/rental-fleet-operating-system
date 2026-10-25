import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { normalizePlate } from '../fleet/vehicles/dto.js';
export const TOLL_CSV_LIMITS = {
  bytes: 65536,
  rows: 200,
  columns: 32,
  cell: 2000,
} as const;
export type TollCsvInput = {
  source: string;
  csv: string;
  delimiter: string;
  mapping: {
    plate: number;
    occurredAt: number;
    amount: number;
    station?: number;
    description?: number;
    externalReference?: number;
  };
  dateFormat: string;
  timezoneOffset: string;
  amountFormat: string;
};
export type TollNormalized = {
  source: string;
  plate: string;
  occurredAt: string;
  amount: string;
  station: string;
  description: string;
  externalReference: string;
  fingerprint: string;
};
const invalid = (message: string) =>
  new BadRequestException({ code: 'TOLL_CSV_INVALID', message });
const digest = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** RFC4180 quoting with explicit delimiter; never infer a delimiter from money. */
export function csvRecords(csv: string, delimiter: string) {
  if (
    typeof csv !== 'string' ||
    Buffer.byteLength(csv, 'utf8') > TOLL_CSV_LIMITS.bytes ||
    ![',', ';', '\t'].includes(delimiter)
  )
    throw invalid('CSV tối đa 64 KiB; chọn dấu phân cột hợp lệ.');
  const text = csv.replace(/^\uFEFF/, '');
  if (
    // oxlint-disable-next-line no-control-regex -- Reject binary control bytes in a text-only import.
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFD]/u.test(text) ||
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(
      text,
    )
  )
    throw invalid('File phải là UTF-8 hợp lệ, không chứa ký tự điều khiển.');
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false,
    closed = false;
  const field = () => {
    if (cell.length > TOLL_CSV_LIMITS.cell)
      throw invalid('Một ô CSV vượt 2.000 ký tự.');
    row.push(cell);
    cell = '';
    closed = false;
    if (row.length > TOLL_CSV_LIMITS.columns)
      throw invalid('CSV tối đa 32 cột.');
  };
  const record = () => {
    field();
    if (row.some((value) => value.trim())) rows.push(row);
    row = [];
    if (rows.length > TOLL_CSV_LIMITS.rows + 1)
      throw invalid('CSV tối đa 200 dòng dữ liệu.');
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += char;
    } else if (char === delimiter) field();
    else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      record();
    } else if (char === '"' && !cell && !closed) quoted = true;
    else {
      if (closed || char === '"')
        throw invalid(
          'Dấu nháy CSV không hợp lệ; dùng hai dấu nháy để escape.',
        );
      cell += char;
    }
    if (cell.length > TOLL_CSV_LIMITS.cell)
      throw invalid('Một ô CSV vượt 2.000 ký tự.');
  }
  if (quoted) throw invalid('CSV có ô chưa đóng dấu nháy.');
  if (cell || row.length || closed) record();
  if (rows.length < 2)
    throw invalid('CSV cần một dòng tiêu đề và ít nhất một dòng dữ liệu.');
  return rows;
}
function offsetMinutes(offset: string) {
  if (typeof offset !== 'string' || !/^[+-]\d{2}:\d{2}$/.test(offset))
    return null;
  const hours = Number(offset.slice(1, 3)),
    minutes = Number(offset.slice(4, 6));
  if (hours > 14 || minutes > 59 || (hours === 14 && minutes)) return null;
  return (hours * 60 + minutes) * (offset[0] === '-' ? -1 : 1);
}
function timestamp(value: string, format: string, selectedOffset: string) {
  let year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
    millis: number,
    offset: number | null;
  if (format === 'ISO_OFFSET') {
    const match =
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/.exec(
        value,
      );
    if (!match) return null;
    [year, month, day, hour, minute, second] = match
      .slice(1, 7)
      .map((part) => Number(part ?? 0));
    millis = Number((match[7] ?? '').padEnd(3, '0'));
    offset = match[8] === 'Z' ? 0 : offsetMinutes(match[8]);
  } else {
    const match =
      format === 'DMY_LOCAL'
        ? /^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
            value,
          )
        : /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
            value,
          );
    if (!match) return null;
    const parts = match.slice(1).map((part) => Number(part ?? 0));
    [year, month, day, hour, minute, second] =
      format === 'DMY_LOCAL'
        ? [parts[2], parts[1], parts[0], ...parts.slice(3)]
        : parts;
    millis = 0;
    offset = offsetMinutes(selectedOffset);
  }
  if (
    year < 2000 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offset === null
  )
    return null;
  const local = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second, millis),
  );
  if (
    local.getUTCFullYear() !== year ||
    local.getUTCMonth() !== month - 1 ||
    local.getUTCDate() !== day
  )
    return null;
  return new Date(+local - offset * 60_000).toISOString();
}
function amountVnd(value: string, format: string) {
  const pattern =
    format === 'DOT_GROUPED'
      ? /^(?:[1-9]\d{0,2}(?:\.\d{3})+|[1-9]\d*)$/
      : format === 'COMMA_GROUPED'
        ? /^(?:[1-9]\d{0,2}(?:,\d{3})+|[1-9]\d*)$/
        : /^[1-9]\d*$/;
  if (!pattern.test(value)) return null;
  const canonical = value.replace(/[.,]/g, '');
  return canonical.length <= 15 && BigInt(canonical) <= 999999999999999n
    ? canonical
    : null;
}
export function parseTollCsv(input: TollCsvInput) {
  if (
    !input ||
    typeof input.source !== 'string' ||
    !input.source.trim() ||
    input.source.trim().length > 80 ||
    !['ISO_OFFSET', 'ISO_LOCAL', 'DMY_LOCAL'].includes(input.dateFormat) ||
    !['INTEGER', 'DOT_GROUPED', 'COMMA_GROUPED'].includes(input.amountFormat) ||
    offsetMinutes(input.timezoneOffset) === null
  )
    throw invalid(
      'Chọn nguồn, định dạng thời gian, múi giờ và định dạng VND rõ ràng.',
    );
  const records = csvRecords(input.csv, input.delimiter),
    headers = records[0];
  const keys = [
    'plate',
    'occurredAt',
    'amount',
    'station',
    'description',
    'externalReference',
  ] as const;
  if (
    !input.mapping ||
    ['plate', 'occurredAt', 'amount'].some(
      (key) =>
        !Number.isInteger(input.mapping[key as keyof typeof input.mapping]),
    )
  )
    throw invalid('Map đầy đủ cột biển số, thời điểm và số tiền.');
  const indexes = keys
    .filter((key) => input.mapping[key] !== undefined)
    .map((key) => input.mapping[key]!);
  if (
    indexes.some(
      (index) =>
        !Number.isInteger(index) || index < 0 || index >= headers.length,
    ) ||
    new Set(indexes).size !== indexes.length
  )
    throw invalid(
      'Mỗi cột chỉ được map một lần và phải nằm trong tiêu đề CSV.',
    );
  const source = input.source.trim().toLowerCase();
  const rows = records.slice(1).map((cells, index) => {
    const errors: string[] = [];
    const get = (key: (typeof keys)[number]) =>
      input.mapping[key] === undefined
        ? ''
        : (cells[input.mapping[key]!] ?? '').trim().normalize('NFC');
    const plate = normalizePlate(get('plate')) as string;
    const occurredAt = timestamp(
      get('occurredAt'),
      input.dateFormat,
      input.timezoneOffset,
    );
    const amount = amountVnd(get('amount'), input.amountFormat),
      station = get('station'),
      description = get('description'),
      externalReference = get('externalReference');
    if (cells.length !== headers.length)
      errors.push('Số cột khác dòng tiêu đề.');
    if (!/^[A-Z0-9]{4,16}$/.test(plate))
      errors.push('Biển số phải có 4–16 chữ/số sau chuẩn hóa.');
    if (!occurredAt)
      errors.push(
        'Thời điểm không hợp lệ hoặc không khớp định dạng/múi giờ đã chọn.',
      );
    if (!amount)
      errors.push(
        'Số tiền phải là số nguyên VND dương, tối đa 999999999999999 và đúng dấu nhóm đã chọn.',
      );
    if (station.length > 200) errors.push('Tên trạm tối đa 200 ký tự.');
    if (externalReference.length > 160)
      errors.push('Mã tham chiếu tối đa 160 ký tự.');
    const normalized: TollNormalized | null = errors.length
      ? null
      : {
          source,
          plate,
          occurredAt: occurredAt!,
          amount: amount!,
          station,
          description,
          externalReference,
          fingerprint: digest([
            plate,
            occurredAt,
            amount,
            station.replace(/\s+/g, ' ').toLowerCase(),
          ]),
        };
    return { rowNumber: index + 2, normalized, errors };
  });
  return {
    contentHash: digest({
      source,
      csv: input.csv.replace(/^\uFEFF/, ''),
      delimiter: input.delimiter,
      mapping: Object.fromEntries(
        keys
          .filter((key) => input.mapping[key] !== undefined)
          .map((key) => [key, input.mapping[key]]),
      ),
      dateFormat: input.dateFormat,
      timezoneOffset: input.timezoneOffset,
      amountFormat: input.amountFormat,
    }),
    rows,
  };
}
