import { describe, expect, it } from 'vitest';
import { generateSeason } from '@bvac/seed';
import { buildSchedule } from '../src';

describe('buildSchedule contract', () => {
  it('returns a track description for every position', () => {
    const data = generateSeason();
    const division = data.divisions[0]!;
    const result = buildSchedule({ data, divisionId: division.id, style: 'anchored' });
    expect(result.tracks.length).toBe(data.gameTracks.filter((t) => t.divisionId === division.id).length);
    for (const t of result.tracks) expect(t.description.length).toBeGreaterThan(0);
  });
});
