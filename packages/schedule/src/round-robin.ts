/**
 * Round robin by the circle method: position 0 stays put, the rest rotate one
 * step each round. With an odd count a phantom "bye" joins, so exactly one
 * team sits out each round and every team sits out once per cycle.
 */
export interface Pairing {
  /** Indexes into the input list. */
  a: number;
  b: number;
}

export interface RoundRobinRound {
  pairs: Pairing[];
  /** Index that sits out this round, or null for an even count. */
  bye: number | null;
}

export function circleRounds(count: number): RoundRobinRound[] {
  if (count < 2) return [];
  const BYE = -1;
  const ring: number[] = Array.from({ length: count }, (_, i) => i);
  if (count % 2 === 1) ring.push(BYE);
  const n = ring.length;
  const rounds: RoundRobinRound[] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: Pairing[] = [];
    let bye: number | null = null;
    for (let i = 0; i < n / 2; i++) {
      const x = ring[i]!;
      const y = ring[n - 1 - i]!;
      if (x === BYE) bye = y;
      else if (y === BYE) bye = x;
      else pairs.push(x < y ? { a: x, b: y } : { a: y, b: x });
    }
    rounds.push({ pairs, bye });
    // Rotate everything except index 0 one step clockwise.
    const last = ring.pop()!;
    ring.splice(1, 0, last);
  }
  return rounds;
}
