import { describe, expect, it } from 'vitest';
import { weekdayOf } from '@bvac/core';
import { circleRounds, minCostAssignment, practiceEvents } from '../src';
import { sample } from './helpers';

describe('circleRounds', () => {
  it.each([2, 3, 4, 5, 6, 7, 8, 9, 10])('pairs everyone exactly once per cycle (%i teams)', (n) => {
    const rounds = circleRounds(n);
    expect(rounds.length).toBe(n % 2 ? n : n - 1);
    const seen = new Map<string, number>();
    const byes = new Map<number, number>();
    for (const r of rounds) {
      const playing = r.pairs.flatMap((p) => [p.a, p.b]);
      expect(new Set(playing).size).toBe(playing.length);
      expect(r.pairs.length).toBe(Math.floor(n / 2));
      if (n % 2) {
        expect(r.bye).not.toBeNull();
        byes.set(r.bye!, (byes.get(r.bye!) ?? 0) + 1);
      } else expect(r.bye).toBeNull();
      for (const p of r.pairs) seen.set(`${p.a}:${p.b}`, (seen.get(`${p.a}:${p.b}`) ?? 0) + 1);
    }
    expect(seen.size).toBe((n * (n - 1)) / 2);
    for (const c of seen.values()) expect(c).toBe(1);
    if (n % 2) for (let i = 0; i < n; i++) expect(byes.get(i)).toBe(1);
  });

  it('returns no rounds for fewer than two teams', () => {
    expect(circleRounds(0)).toEqual([]);
    expect(circleRounds(1)).toEqual([]);
  });
});

describe('minCostAssignment', () => {
  const brute = (cost: number[][]): number => {
    const rows = cost.length;
    const cols = cost[0]!.length;
    let best = Infinity;
    const go = (i: number, used: Set<number>, sum: number) => {
      if (i === rows) {
        best = Math.min(best, sum);
        return;
      }
      for (let j = 0; j < cols; j++) {
        if (used.has(j)) continue;
        used.add(j);
        go(i + 1, used, sum + cost[i]![j]!);
        used.delete(j);
      }
    };
    go(0, new Set(), 0);
    return best;
  };

  it('finds the optimum on small matrices', () => {
    // Deterministic pseudo-random matrices (no Math.random in tests either).
    let x = 12345;
    const next = () => {
      x = (x * 1103515245 + 12345) % 2147483648;
      return x % 50;
    };
    for (let trial = 0; trial < 40; trial++) {
      const rows = 1 + (trial % 4);
      const cols = rows + (trial % 3);
      const cost = Array.from({ length: rows }, () => Array.from({ length: cols }, next));
      const result = minCostAssignment(cost);
      expect(new Set(result).size).toBe(rows);
      expect(result.reduce((s, j, i) => s + cost[i]![j]!, 0)).toBe(brute(cost));
    }
  });

  it('leaves extra rows unassigned', () => {
    const result = minCostAssignment([[5], [1], [3]]);
    expect(result.filter((j) => j === 0).length).toBe(1);
    expect(result[1]).toBe(0);
    expect(result.filter((j) => j === -1).length).toBe(2);
  });
});

describe('practiceEvents', () => {
  it('lists one practice a week per team inside the practice season', () => {
    const data = sample();
    const events = practiceEvents(data, data.teams);
    const { start, end } = data.season.practices;
    const slots = new Map(data.practiceSlots.map((s) => [s.id, s]));
    expect(events.length).toBeGreaterThan(0);
    for (const team of data.teams) {
      const mine = events.filter((e) => e.teamId === team.id);
      const slot = slots.get(team.practiceSlotId)!;
      // Mar 22 - May 22, 2027 is 9 weeks: 9 of each weekday.
      expect(mine.length).toBe(9);
      for (const e of mine) {
        expect(weekdayOf(e.date)).toBe(slot.window.day);
        expect(e.date >= start && e.date <= end).toBe(true);
        expect(e.start).toBe(slot.window.start);
        expect(e.end).toBe(slot.window.end);
        expect(e.fieldId).toBe(slot.fieldId);
        expect(e.divisionId).toBe(team.divisionId);
      }
    }
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
    const sorted = [...events].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.start - b.start));
    expect(events.map((e) => e.date + e.start)).toEqual(sorted.map((e) => e.date + e.start));
  });

  it('skips cancelled teams and honors the date range', () => {
    const data = sample();
    const [a, b] = data.teams;
    data.season.practices = { start: '2027-03-22', end: '2027-03-28' };
    const events = practiceEvents(data, [{ ...a!, status: 'cancelled' }, b!]);
    expect(events.map((e) => e.teamId)).toEqual([b!.id]);
  });
});
