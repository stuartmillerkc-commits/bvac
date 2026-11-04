import { describe, expect, it } from 'vitest';
import { fitsAvailability, indexSeason, validateSeasonData } from '@bvac/core';
import { generateSeason } from '../src';

const data = generateSeason();
const index = indexSeason(data);

describe('sample season', () => {
  it('is internally consistent', () => {
    expect(validateSeasonData(data)).toEqual([]);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(generateSeason())).toBe(JSON.stringify(data));
    expect(JSON.stringify(generateSeason({ seed: 7 }))).not.toBe(JSON.stringify(data));
  });

  it('matches BVAC form shape: 5 grade divisions, ~300 kids, one registration each', () => {
    expect(data.divisions.map((d) => d.code)).toEqual(['D1', 'D2', 'D3', 'D4', 'D5']);
    expect(data.players.length).toBeGreaterThanOrEqual(300);
    expect(data.players.length).toBeLessThan(305);
    expect(new Set(data.registrations.map((r) => r.playerId)).size).toBe(data.registrations.length);
    for (const r of data.registrations) {
      const p = index.player.get(r.playerId)!;
      const d = index.division.get(r.divisionId)!;
      expect(p.grade).toBeGreaterThanOrEqual(d.minGrade);
      expect(p.grade).toBeLessThanOrEqual(d.maxGrade);
    }
  });

  it('gives every team a practice slot, a game track and one head coach', () => {
    for (const t of data.teams) {
      expect(t.gameTrackId).toBeDefined();
      expect(index.coachesByTeam.get(t.id)?.filter((c) => c.role === 'head')).toHaveLength(1);
    }
  });

  it('never overbooks a practice slot', () => {
    for (const s of data.practiceSlots) {
      expect(data.teams.filter((t) => t.practiceSlotId === s.id).length).toBeLessThanOrEqual(s.teamCapacity);
    }
  });

  it('only ranks teams in the registrant division that fit their availability (coach kids excepted)', () => {
    for (const r of data.registrations) {
      for (const c of r.choices) {
        const team = index.team.get(c.teamId)!;
        expect(team.divisionId).toBe(r.divisionId);
        const window = index.practiceSlot.get(team.practiceSlotId)!.window;
        expect(fitsAvailability(window, r.availability)).toBe(true);
      }
    }
  });

  it('includes the messy cases the engine and importer must handle', () => {
    const requests = data.registrations.flatMap((r) => r.requests);
    expect(requests.some((q) => q.matchStatus === 'ambiguous')).toBe(true);
    expect(requests.some((q) => q.matchStatus === 'unmatched')).toBe(true);
    expect(requests.some((q) => q.type === 'sibling')).toBe(true);
    expect(data.registrations.some((r) => r.window === 'late')).toBe(true);
    expect(data.registrations.some((r) => r.availabilityRequired)).toBe(true);
    expect(data.coachAssignments.some((c) => c.protectedPlayerIds.length > 0)).toBe(true);
    // At least one division has more registrations than seats at max size.
    expect(
      data.divisions.some(
        (d) => (index.registrationsByDivision.get(d.id)?.length ?? 0) > (index.teamsByDivision.get(d.id)?.length ?? 0) * d.settings.teamSize.max,
      ),
    ).toBe(true);
  });

  it('keeps requests within the per-kid limit', () => {
    for (const r of data.registrations) {
      expect(r.requests.length).toBeLessThanOrEqual(index.division.get(r.divisionId)!.settings.maxPlayerRequests);
    }
  });
});
