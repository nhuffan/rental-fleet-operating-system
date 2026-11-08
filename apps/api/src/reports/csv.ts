const UTF8_BOM = '﻿';
// Spreadsheet applications evaluate cells that start with these characters as
// formulas. A leading apostrophe keeps imported text inert (OWASP CSV injection).
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  let text =
    value === null || value === undefined
      ? ''
      : typeof value === 'string'
        ? value
        : String(value as number | boolean | bigint);
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
): string {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(','));
  return UTF8_BOM + lines.join('\r\n') + '\r\n';
}
