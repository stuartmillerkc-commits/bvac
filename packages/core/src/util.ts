/**
 * Code-unit string comparison for sorting data.
 *
 * Use this instead of `localeCompare`: locale collation differs between Node
 * and browsers (and between ICU builds), which changes sort order of ISO
 * timestamps and IDs, breaks hydration and makes results machine-dependent.
 */
export function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
