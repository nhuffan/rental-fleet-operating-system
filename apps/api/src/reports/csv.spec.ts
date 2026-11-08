import { csvCell, toCsv } from './csv.js';

describe('CSV export encoding', () => {
  it('neutralizes spreadsheet formulas', () => {
    for (const value of ['=1+1', '+84901', '-5', '@SUM(A1)', '\tcmd'])
      expect(csvCell(value).replace(/^"/, '').startsWith("'")).toBe(true);
  });
  it('quotes delimiters, quotes and newlines and keeps plain text', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
    expect(csvCell('Toyota')).toBe('Toyota');
    expect(csvCell(null)).toBe('');
    expect(csvCell(true)).toBe('true');
  });
  it('writes BOM, header and CRLF rows', () => {
    expect(toCsv(['a', 'b'], [[1, 'x,y']])).toBe('﻿a,b\r\n1,"x,y"\r\n');
  });
});
