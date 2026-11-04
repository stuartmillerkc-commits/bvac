import type { SeasonData } from '@bvac/core';
import { generateSeason } from '@bvac/seed';
import { parseCsvRecords, sampleSportsEngineExport, suggestMapping } from '../src';

let cached: SeasonData | undefined;

/** A fresh deep copy of the sample season, safe to mutate in a test. */
export function sample(): SeasonData {
  cached ??= generateSeason();
  return structuredClone(cached);
}

/**
 * The season with no families: registrations, players, households, history
 * and guardian-only people removed. Coaches, teams and divisions stay.
 */
export function emptyCopy(data: SeasonData): SeasonData {
  const guardians = new Set(data.households.flatMap((h) => h.guardianIds));
  const coaches = new Set([
    ...data.coachAssignments.map((c) => c.personId),
    ...data.playerHistory.map((h) => h.coachPersonId).filter((x): x is string => !!x),
  ]);
  return {
    ...structuredClone(data),
    people: data.people.filter((p) => !guardians.has(p.id) || coaches.has(p.id)).map((p) => ({ ...p })),
    households: [],
    players: [],
    playerHistory: [],
    registrations: [],
    coachAssignments: data.coachAssignments.map((c) => ({ ...c, protectedPlayerIds: [] })),
  };
}

/** The sample Saved Report parsed into records, with the suggested mapping. */
export function sampleReport(data: SeasonData = sample()) {
  const csv = sampleSportsEngineExport(data);
  const records = parseCsvRecords(csv);
  return { csv, ...records, mapping: suggestMapping(records.headers) };
}
