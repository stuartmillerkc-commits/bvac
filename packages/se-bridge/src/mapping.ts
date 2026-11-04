/**
 * Guessing which uploaded column holds which import field.
 */
import { IMPORT_FIELDS, type ColumnMapping, type ImportField } from '@bvac/core';
import { HEADER_SYNONYMS, REPORT_HEADERS, SCHOOL_YEAR_TOKEN } from './formats';
import { normalize, similarity } from './text';

/** Below this score a header is left unmapped for the admin to pick. */
export const MAPPING_THRESHOLD = 0.8;

/** Header text for comparison: lowercase, no punctuation, any school year or year replaced by "yr". */
export function headerKey(header: string): string {
  return normalize(
    header
      .replace(SCHOOL_YEAR_TOKEN, ' yr ')
      .replace(/\b(19|20)\d{2}\s*[-–/]\s*(\d{2}|\d{4})\b/g, ' yr ')
      .replace(/\b(19|20)\d{2}\b/g, ' yr '),
  )
    .replace(/\b(\d+)(st|nd|rd|th)\b/g, '$1')
    // "First choice" = "1st choice", but "First Name" stays a name.
    .replace(/\bfirst (choice|most)\b/g, '1 $1')
    .replace(/\bsecond (choice|most)\b/g, '2 $1')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(key: string): Set<string> {
  return new Set(key.split(' ').filter(Boolean));
}

/** 0..1: Dice overlap of words, with numbers that must agree. */
function tokenScore(a: string, b: string): number {
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  const numsA = [...ta].filter((t) => /^\d+$/.test(t)).sort();
  const numsB = [...tb].filter((t) => /^\d+$/.test(t)).sort();
  // "Player request 1" must never match "Player request 2".
  if (numsA.join() !== numsB.join()) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return ta.size + tb.size === 0 ? 0 : (2 * shared) / (ta.size + tb.size);
}

/** How well a header fits a field, 0..1. */
export function headerScore(header: string, field: ImportField): number {
  const h = headerKey(header);
  if (!h) return 0;
  let best = 0;
  for (const name of [REPORT_HEADERS[field], ...HEADER_SYNONYMS[field]]) {
    const n = headerKey(name);
    if (h === n) return 1;
    const numsAgree = tokenScore(h, n) > 0 || ![...tokenSet(h), ...tokenSet(n)].some((t) => /^\d+$/.test(t));
    const chars = numsAgree ? similarity(h, n) : 0;
    best = Math.max(best, 0.98 * Math.max(chars, tokenScore(h, n)));
  }
  return best;
}

/**
 * Suggest a column for each field. Each header is used at most once; the best
 * pairs win first, ties go to the earlier header and then the earlier field.
 */
export function suggestMapping(headers: string[]): ColumnMapping {
  const pairs: { header: string; h: number; f: number; field: ImportField; score: number }[] = [];
  headers.forEach((header, h) => {
    IMPORT_FIELDS.forEach((field, f) => {
      const score = headerScore(header, field);
      if (score >= MAPPING_THRESHOLD) pairs.push({ header, h, f, field, score });
    });
  });
  pairs.sort((a, b) => b.score - a.score || a.h - b.h || a.f - b.f);
  const mapping: ColumnMapping = {};
  const usedHeaders = new Set<number>();
  for (const p of pairs) {
    if (mapping[p.field] !== undefined || usedHeaders.has(p.h)) continue;
    mapping[p.field] = p.header;
    usedHeaders.add(p.h);
  }
  return mapping;
}
