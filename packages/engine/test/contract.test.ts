import { describe, expect, it } from 'vitest';
import { generateSeason } from '@bvac/seed';
import { placeDivision } from '../src';

const data = generateSeason();

describe('placeDivision contract', () => {
  for (const division of data.divisions) {
    it(`returns one placement per registration in ${division.code}`, () => {
      const result = placeDivision({ data, divisionId: division.id, round: 2, fixed: [] });
      const regIds = data.registrations.filter((r) => r.divisionId === division.id).map((r) => r.id);
      expect(result.placements.map((p) => p.registrationId).sort()).toEqual(regIds.sort());
      expect(result.stats.placed + result.stats.waitlisted).toBe(regIds.length);
      const max = division.settings.teamSize.max;
      const counts = new Map<string, number>();
      for (const p of result.placements) if (p.teamId) counts.set(p.teamId, (counts.get(p.teamId) ?? 0) + 1);
      for (const n of counts.values()) expect(n).toBeLessThanOrEqual(max);
    });
  }

  it('keeps fixed placements exactly', () => {
    const division = data.divisions[2]!;
    const reg = data.registrations.find((r) => r.divisionId === division.id && r.choices.length > 0)!;
    const team = data.teams.find((t) => t.divisionId === division.id && t.id !== reg.choices[0]!.teamId)!;
    const fixed = [{ registrationId: reg.id, teamId: team.id, round: 1 as const, state: 'published' as const, locked: true, choiceRankMet: null, reasons: [] }];
    const result = placeDivision({ data, divisionId: division.id, round: 2, fixed });
    expect(result.placements.find((p) => p.registrationId === reg.id)).toEqual(fixed[0]);
  });

  it('respects asOf for live replays', () => {
    const division = data.divisions[0]!;
    const asOf = '2027-01-10T00:00:00-06:00';
    const result = placeDivision({ data, divisionId: division.id, round: 1, fixed: [], asOf });
    const expected = data.registrations.filter((r) => r.divisionId === division.id && r.submittedAt <= asOf).length;
    expect(result.placements).toHaveLength(expected);
  });
});
