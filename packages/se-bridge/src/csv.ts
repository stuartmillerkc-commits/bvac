/**
 * RFC 4180 CSV without dependencies.
 *
 * Parsing accepts quoted fields with embedded commas, quotes ("") and
 * newlines, a UTF-8 byte-order mark, and CRLF, LF or lone CR line endings.
 * An unterminated quote runs to the end of the text rather than failing.
 * Writing uses CRLF and quotes only the fields that need it.
 */

/** Parse CSV text into rows of fields. Blank lines are kept as `['']`; a final line break adds no row. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const n = text.length;
  let rowHasContent = false;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
    rowHasContent = false;
  };

  while (i < n) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      quoted = true;
      rowHasContent = true;
      i++;
    } else if (c === ',') {
      endField();
      rowHasContent = true;
      i++;
    } else if (c === '\r' || c === '\n') {
      endRow();
      i += c === '\r' && text[i + 1] === '\n' ? 2 : 1;
    } else {
      field += c;
      rowHasContent = true;
      i++;
    }
  }
  if (rowHasContent || field !== '' || row.length > 0) endRow();
  return rows;
}

export interface CsvRecords {
  headers: string[];
  /** One object per data row, keyed by header. Fully blank rows are dropped. */
  rows: Record<string, string>[];
  /** CSV line number (1-based, header = 1) of each entry in `rows`. */
  lineNumbers: number[];
}

/**
 * Parse CSV with a header row into records.
 *
 * Headers are trimmed. When several columns share a header (SportsEngine
 * gives each division's copy of a conditional question its own column), the
 * record holds the first non-blank value among them.
 */
export function parseCsvRecords(text: string): CsvRecords {
  const table = parseCsv(text);
  const headerRow = table[0] ?? [];
  const headers: string[] = [];
  for (const h of headerRow) {
    const name = h.trim();
    if (!headers.includes(name)) headers.push(name);
  }
  const rows: Record<string, string>[] = [];
  const lineNumbers: number[] = [];
  // Line numbers count physical rows, so embedded newlines inside quotes are
  // not counted. That matches what a spreadsheet shows as the row number.
  for (let r = 1; r < table.length; r++) {
    const cells = table[r]!;
    if (cells.every((c) => c.trim() === '')) continue;
    const record: Record<string, string> = {};
    for (const h of headers) record[h] = '';
    headerRow.forEach((h, idx) => {
      const name = h.trim();
      const value = cells[idx] ?? '';
      if (record[name] === '' && value.trim() !== '') record[name] = value;
    });
    rows.push(record);
    lineNumbers.push(r + 1);
  }
  return { headers, rows, lineNumbers };
}

function needsQuotes(value: string): boolean {
  return /[",\r\n]/.test(value) || value !== value.trim();
}

/** One CSV field, quoted when needed. */
export function csvField(value: string): string {
  return needsQuotes(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** Rows to CSV text with CRLF line endings and a final CRLF. */
export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n';
}

/** Records to CSV, columns in `headers` order. */
export function recordsToCsv(headers: readonly string[], records: readonly Record<string, string>[]): string {
  return toCsv([headers, ...records.map((r) => headers.map((h) => r[h] ?? ''))]);
}
