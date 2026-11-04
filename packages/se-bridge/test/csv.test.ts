import { describe, expect, it } from 'vitest';
import { csvField, parseCsv, parseCsvRecords, recordsToCsv, toCsv } from '../src';

describe('parseCsv (RFC 4180)', () => {
  it('reads plain rows with CRLF and a final line break', () => {
    expect(parseCsv('a,b,c\r\n1,2,3\r\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('accepts LF and lone CR line endings and no final line break', () => {
    expect(parseCsv('a,b\n1,2\r3,4')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('handles quoted fields with commas, escaped quotes and embedded newlines', () => {
    const text = 'name,note\r\n"Miller, Jake","He said ""hi""\r\nthen left"\r\n"",x\r\n';
    expect(parseCsv(text)).toEqual([
      ['name', 'note'],
      ['Miller, Jake', 'He said "hi"\r\nthen left'],
      ['', 'x'],
    ]);
  });

  it('strips a UTF-8 byte-order mark', () => {
    expect(parseCsv('﻿Player First Name,Last\r\nAva,Lee\r\n')[0]).toEqual(['Player First Name', 'Last']);
  });

  it('keeps empty fields, including a trailing empty field', () => {
    expect(parseCsv('a,,c,\r\n')).toEqual([['a', '', 'c', '']]);
  });

  it('keeps blank lines as one empty field and adds no row for the final line break', () => {
    expect(parseCsv('a\r\n\r\nb\r\n')).toEqual([['a'], [''], ['b']]);
    expect(parseCsv('')).toEqual([]);
  });

  it('reads an unterminated quote to the end instead of failing', () => {
    expect(parseCsv('a,"b\r\nc')).toEqual([['a', 'b\r\nc']]);
  });

  it('keeps non-ASCII text', () => {
    expect(parseCsv('Option C · Tue 5:30–6:30pm · Field 3,José\r\n')).toEqual([['Option C · Tue 5:30–6:30pm · Field 3', 'José']]);
  });
});

describe('parseCsvRecords', () => {
  it('keys rows by trimmed header, drops blank rows and reports spreadsheet row numbers', () => {
    const { headers, rows, lineNumbers } = parseCsvRecords(' First , Last \r\nAva,Lee\r\n,\r\nBen,\r\n');
    expect(headers).toEqual(['First', 'Last']);
    expect(rows).toEqual([
      { First: 'Ava', Last: 'Lee' },
      { First: 'Ben', Last: '' },
    ]);
    expect(lineNumbers).toEqual([2, 4]);
  });

  it('fills missing trailing cells with empty strings', () => {
    expect(parseCsvRecords('a,b,c\r\n1\r\n').rows).toEqual([{ a: '1', b: '', c: '' }]);
  });

  it('combines columns that share a header (one per division), taking the first answer given', () => {
    const text = '1st choice team,1st choice team,Name\r\n,Option B,Ava\r\nOption A,,Ben\r\n';
    const { headers, rows } = parseCsvRecords(text);
    expect(headers).toEqual(['1st choice team', 'Name']);
    expect(rows.map((r) => r['1st choice team'])).toEqual(['Option B', 'Option A']);
  });
});

describe('writing CSV', () => {
  it('quotes only fields that need it', () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('two\nlines')).toBe('"two\nlines"');
    expect(csvField(' padded')).toBe('" padded"');
  });

  it('round-trips through the parser', () => {
    const rows = [
      ['Name', 'Note', 'Days'],
      ['Miller, Jake', 'He said "hi"\r\nthen left', 'Mon, Tue'],
      ['', ' space', '—'],
    ];
    const text = toCsv(rows);
    expect(text.endsWith('\r\n')).toBe(true);
    expect(parseCsv(text)).toEqual(rows);
  });

  it('writes records in header order', () => {
    expect(recordsToCsv(['b', 'a'], [{ a: '1', b: '2' }, { a: '3' }])).toBe('b,a\r\n2,1\r\n,3\r\n');
  });
});
