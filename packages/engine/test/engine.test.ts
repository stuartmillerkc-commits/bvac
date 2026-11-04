import { describe, expect, it } from 'vitest';
import {
  defaultDivisionSettings,
  fitsAvailability,
  indexSeason,
  type DivisionSettings,
  type Placement,
  type PlacementRunInput,
  type PlacementRunResult,
  type SeasonData,
} from '@bvac/core';
import { generateSeason } from '@bvac/seed';
import { placeDivision, priorityFor, satisfactionTotal } from '../src';
import { blockingPairs, emptyAssignment } from '../src/assign';
import { buildContext } from '../src/context';
import { lockedTeamOf } from '../src/preferences';
import { buildUnits } from '../src/units';

const data = generateSeason();
const index = indexSeason(data);
const rankedDivisions = data.divisions.filter((d) => d.settings.model !== 'fcfs');

function run(divisionId: string, extra: Partial<PlacementRunInput> = {}): PlacementRunResult {
  return placeDivision({ data, divisionId, round: 2, fixed: [], ...extra });
}

function teamSizes(result: PlacementRunResult): Map<string, number> {
  const sizes = new Map<string, number>();
  for (const p of result.placements) if (p.teamId) sizes.set(p.teamId, (sizes.get(p.teamId) ?? 0) + 1);
  return sizes;
}

/** A copy of the season with one division's settings changed. */
function withSettings(divisionCode: string, patch: Partial<DivisionSettings>): SeasonData {
  return {
    ...data,
    divisions: data.divisions.map((d) => (d.code === divisionCode ? { ...d, settings: { ...d.settings, ...patch } } : d)),
  };
}

describe('caps and hard rules', () => {
  for (const d of data.divisions) {
    it(`${d.code}: never exceeds max, and round 1 fills only to preferred`, () => {
      for (const n of teamSizes(run(d.id)).values()) expect(n).toBeLessThanOrEqual(d.settings.teamSize.max);
      const r1 = placeDivision({ data, divisionId: d.id, round: 1, fixed: [] });
      // Locked coach picks can push a team past preferred; the engine itself never does.
      const locked = new Map<string, number>();
      for (const p of r1.placements) if (p.locked && p.teamId) locked.set(p.teamId, (locked.get(p.teamId) ?? 0) + 1);
      for (const [team, n] of teamSizes(r1)) expect(n).toBeLessThanOrEqual(Math.max(d.settings.teamSize.preferred, locked.get(team) ?? 0));
    });

    it(`${d.code}: never places a required-days family outside its days`, () => {
      for (const p of run(d.id).placements) {
        if (!p.teamId || p.locked) continue;
        const reg = index.registration.get(p.registrationId)!;
        if (!reg.availabilityRequired) continue;
        const slot = index.practiceSlot.get(index.team.get(p.teamId)!.practiceSlotId)!;
        expect(fitsAvailability(slot.window, reg.availability)).toBe(true);
      }
    });
  }

  it('round 1 places only early-window registrations', () => {
    const d = rankedDivisions[0]!;
    const r1 = placeDivision({ data, divisionId: d.id, round: 1, fixed: [] });
    for (const p of r1.placements) expect(index.registration.get(p.registrationId)!.window).toBe('early');
  });

  it('keeps coach protected picks (incl. own kids) on the coach team', () => {
    for (const d of data.divisions) {
      const result = run(d.id);
      for (const ca of data.coachAssignments) {
        if (index.team.get(ca.teamId)?.divisionId !== d.id) continue;
        for (const playerId of ca.protectedPlayerIds) {
          const reg = index.registrationByPlayer.get(playerId)!;
          const p = result.placements.find((x) => x.registrationId === reg.id)!;
          expect(p.teamId).toBe(ca.teamId);
          expect(p.locked).toBe(true);
        }
      }
    }
  });

  it('returns fixed placements exactly and builds around them', () => {
    const d = rankedDivisions[1]!;
    const regs = index.registrationsByDivision.get(d.id)!.filter((r) => r.choices.length > 0).slice(0, 3);
    const team = index.teamsByDivision.get(d.id)!.at(-1)!;
    const fixed: Placement[] = regs.map((r) => ({
      registrationId: r.id,
      teamId: team.id,
      round: 1,
      state: 'published',
      locked: true,
      choiceRankMet: null,
      reasons: [{ code: 'adminLocked', text: 'Moved by admin' }],
    }));
    const result = run(d.id, { fixed });
    for (const f of fixed) expect(result.placements.find((p) => p.registrationId === f.registrationId)).toEqual(f);
    expect(teamSizes(result).get(team.id)!).toBeLessThanOrEqual(d.settings.teamSize.max);
  });

  it('returns one placement per registration in scope, honoring asOf', () => {
    const d = rankedDivisions[2]!;
    const asOf = '2027-01-20T00:00:00-06:00';
    const result = run(d.id, { asOf });
    const expected = index.registrationsByDivision.get(d.id)!.filter((r) => r.submittedAt <= asOf);
    expect(result.placements.map((p) => p.registrationId).sort()).toEqual(expected.map((r) => r.id).sort());
  });
});

describe('siblings', () => {
  it('keeps same-division siblings together unless the family opted out', () => {
    for (const d of rankedDivisions) {
      const result = run(d.id);
      const team = new Map(result.placements.map((p) => [p.registrationId, p.teamId]));
      const byHousehold = new Map<string, string[]>();
      for (const r of index.registrationsByDivision.get(d.id)!) {
        const hh = index.player.get(r.playerId)!.householdId;
        byHousehold.set(hh, [...(byHousehold.get(hh) ?? []), r.id]);
      }
      for (const ids of byHousehold.values()) {
        if (ids.length < 2 || ids.some((id) => index.registration.get(id)!.siblingsTogetherOptOut)) continue;
        const placed = ids.map((id) => team.get(id));
        // Together on one team, or together on the waitlist; split only with a flag.
        if (new Set(placed).size > 1) {
          expect(result.flags.some((f) => f.code === 'requestUnmet' && f.message.startsWith('Siblings'))).toBe(true);
        }
      }
    }
  });

  it('splits siblings when BVAC turns the rule off', () => {
    const d = rankedDivisions[0]!;
    const off = withSettings(d.code, { keepSiblingsTogether: false });
    const ctx = buildContext({ data: off, divisionId: d.id, round: 2, fixed: [] });
    expect(buildUnits(ctx, ctx.mainPool).every((u) => u.size === 1)).toBe(true);
  });
});

describe('stability (priority-first)', () => {
  for (const d of rankedDivisions) {
    it(`${d.code}: no family is passed over for a lower-priority kid on a team they prefer`, () => {
      const input: PlacementRunInput = { data, divisionId: d.id, round: 2, fixed: [] };
      const result = placeDivision(input);
      const ctx = buildContext(input);
      const units = buildUnits(ctx, ctx.mainPool);
      const lockedLoad = new Map<string, number>();
      for (const r of ctx.registrations) {
        const t = lockedTeamOf(ctx, r.id);
        if (t) lockedLoad.set(t, (lockedLoad.get(t) ?? 0) + 1);
      }
      const a = emptyAssignment(ctx, lockedLoad);
      const lateIds = new Set(ctx.latePool.map((r) => r.id));
      const byReg = new Map(result.placements.map((p) => [p.registrationId, p.teamId]));
      for (const u of units) {
        const t = byReg.get(u.regs[0]!.id) ?? null;
        a.team.set(u.key, t);
        if (t) a.load.set(t, (a.load.get(t) ?? 0) + u.size);
      }
      // Late registrations hold leftover seats; count them as load.
      for (const r of ctx.latePool) {
        const t = byReg.get(r.id);
        if (t && lateIds.has(r.id)) a.load.set(t, (a.load.get(t) ?? 0) + 1);
      }
      expect(blockingPairs(ctx, units, a)).toEqual([]);
    });
  }
});

describe('models and methods', () => {
  it('fcfs: anyone who missed their 1st choice missed it because that team filled up', () => {
    const d = data.divisions.find((x) => x.settings.model === 'fcfs')!;
    const result = run(d.id);
    const sizes = teamSizes(result);
    for (const p of result.placements) {
      if (p.locked || p.choiceRankMet === 1) continue;
      const reg = index.registration.get(p.registrationId)!;
      const first = reg.choices[0];
      if (!first) continue;
      const slot = index.practiceSlot.get(index.team.get(first.teamId)!.practiceSlotId)!;
      if (reg.availabilityRequired && !fitsAvailability(slot.window, reg.availability)) continue;
      // Seats only fill up in fcfs, so the 1st choice must be full (or one seat short for a sibling pair).
      expect(sizes.get(first.teamId) ?? 0).toBeGreaterThanOrEqual(d.settings.teamSize.max - 1);
    }
    // Earlier registrations get their 1st choice at least as often as later ones.
    const placed = result.placements.filter((p) => !p.locked && index.registration.get(p.registrationId)!.choices.length > 0);
    const half = Math.floor(placed.length / 2);
    const rate = (xs: typeof placed) => xs.filter((p) => p.choiceRankMet === 1).length / Math.max(1, xs.length);
    expect(rate(placed.slice(0, half))).toBeGreaterThanOrEqual(rate(placed.slice(half)));
  });

  it('coachSelect leaves placements proposed for coach approval', () => {
    const d = rankedDivisions[0]!;
    const result = placeDivision({ data: withSettings(d.code, { model: 'coachSelect' }), divisionId: d.id, round: 2, fixed: [] });
    const unlocked = result.placements.filter((p) => p.teamId && !p.locked);
    expect(unlocked.length).toBeGreaterThan(0);
    for (const p of unlocked) expect(p.state).toBe('proposed');
  });

  it('maxSatisfaction scores at least as high as priority-first on its own objective', () => {
    for (const d of rankedDivisions) {
      const base: PlacementRunInput = { data, divisionId: d.id, round: 2, fixed: [] };
      const max: PlacementRunInput = { ...base, settingsOverride: { placementMethod: 'maxSatisfaction' } };
      expect(satisfactionTotal(max, placeDivision(max))).toBeGreaterThanOrEqual(satisfactionTotal(base, placeDivision(base)));
    }
  });

  it('is deterministic', () => {
    for (const d of data.divisions) expect(JSON.stringify(run(d.id))).toBe(JSON.stringify(run(d.id)));
  });

  it('runs all five sample divisions in under 200 ms', () => {
    const t0 = performance.now();
    for (const d of data.divisions) run(d.id);
    expect(performance.now() - t0).toBeLessThan(200);
  });
});

describe('explanations, flags and stats', () => {
  it('gives every placement at least one reason', () => {
    for (const d of data.divisions) for (const p of run(d.id).placements) expect(p.reasons.length).toBeGreaterThan(0);
  });

  it('explains ranked placements with the choice met', () => {
    const d = rankedDivisions[0]!;
    const p = run(d.id).placements.find((x) => x.choiceRankMet === 1 && !x.locked)!;
    expect(p.reasons[0]!.text).toBe('1st choice');
  });

  it('flags a division that has more kids than seats', () => {
    const over = data.divisions.find(
      (d) => index.registrationsByDivision.get(d.id)!.length > index.teamsByDivision.get(d.id)!.length * d.settings.teamSize.max,
    )!;
    const flag = run(over.id).flags.find((f) => f.code === 'demandExceedsCapacity')!;
    expect(flag.message).toMatch(/Needs \d+ more team/);
  });

  it('fills every stats field with sane values', () => {
    for (const d of data.divisions) {
      const s = run(d.id).stats;
      expect(s.placed + s.waitlisted).toBe(s.registrations);
      for (const rate of [s.firstChoiceRate, s.anyChoiceRate, s.friendRequestRate, s.siblingTogetherRate, s.coachRequestRate]) {
        expect(rate).toBeGreaterThanOrEqual(0);
        expect(rate).toBeLessThanOrEqual(1);
      }
      expect(s.smallestTeam).toBeLessThanOrEqual(s.largestTeam);
    }
  });

  it('priorityFor applies team-specific points', () => {
    const reg = data.registrations.find((r) => {
      const last = index.historyByPlayer.get(r.playerId)?.find((h) => h.seasonOrder === index.lastSeasonOrder);
      return last && index.teamsByDivision.get(r.divisionId)!.some((t) => index.coachesByTeam.get(t.id)?.some((c) => c.role === 'head' && c.personId === last.coachPersonId));
    })!;
    const last = index.historyByPlayer.get(reg.playerId)!.find((h) => h.seasonOrder === index.lastSeasonOrder)!;
    const teams = index.teamsByDivision.get(reg.divisionId)!;
    const coachTeam = teams.find((t) => index.coachesByTeam.get(t.id)?.some((c) => c.role === 'head' && c.personId === last.coachPersonId))!;
    const other = teams.find((t) => t !== coachTeam)!;
    const settings = defaultDivisionSettings({ min: 1, preferred: 2, max: 3 });
    const onCoach = priorityFor(index, reg, coachTeam, { settings });
    const elsewhere = priorityFor(index, reg, other, { settings });
    expect(onCoach.points - elsewhere.points).toBeGreaterThanOrEqual(settings.priority.playedForCoachLastSeason);
  });
});
