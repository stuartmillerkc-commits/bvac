/**
 * Minimum-cost assignment (Hungarian algorithm, O(n^3)).
 *
 * `cost[i][j]` is the cost of giving row i column j. Rows may outnumber
 * columns or the other way round; the matrix is padded internally. Returns,
 * for each row, its column or -1 when the row got a padding column.
 * Ties resolve the same way on every run, so results are deterministic.
 */
export function minCostAssignment(cost: readonly (readonly number[])[], padCost = 0): number[] {
  const rows = cost.length;
  if (rows === 0) return [];
  const cols = cost[0]!.length;
  const n = Math.max(rows, cols);
  const at = (i: number, j: number): number => (i < rows && j < cols ? cost[i]![j]! : padCost);

  // 1-indexed potentials, standard e-maxx formulation.
  const u = new Float64Array(n + 1);
  const v = new Float64Array(n + 1);
  const p = new Int32Array(n + 1); // p[j] = row matched to column j
  const way = new Int32Array(n + 1);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Float64Array(n + 1).fill(Infinity);
    const used = new Uint8Array(n + 1);
    do {
      used[j0] = 1;
      const i0 = p[j0]!;
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = at(i0 - 1, j - 1) - u[i0]! - v[j]!;
        if (cur < minv[j]!) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j]! < delta) {
          delta = minv[j]!;
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          const row = p[j]!;
          u[row] = u[row]! + delta;
          v[j] = v[j]! - delta;
        } else {
          minv[j] = minv[j]! - delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0]!;
      p[j0] = p[j1]!;
      j0 = j1;
    } while (j0 !== 0);
  }
  const result = new Array<number>(rows).fill(-1);
  for (let j = 1; j <= n; j++) {
    const row = p[j]! - 1;
    if (row >= 0 && row < rows && j - 1 < cols) result[row] = j - 1;
  }
  return result;
}
