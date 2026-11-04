import type { Game, GameSlot, ScheduleBuildResult, SeasonData } from '@bvac/core';
import { generateSeason } from '@bvac/seed';

let cached: SeasonData | undefined;

/** A fresh deep copy of the sample season, safe to mutate in a test. */
export function sample(): SeasonData {
  cached ??= generateSeason();
  return structuredClone(cached);
}

/** The sample season with every coach game-time limit and blackout removed. */
export function unconstrained(): SeasonData {
  const data = sample();
  data.coachAvailability = data.coachAvailability.map((a) => ({
    personId: a.personId,
    practiceWindows: a.practiceWindows,
    blackoutDates: [],
  }));
  return data;
}

export function slotMap(data: SeasonData): Map<string, GameSlot> {
  return new Map(data.gameSlots.map((s) => [s.id, s]));
}

/** Per track id: start time -> number of games. */
export function timeCounts(data: SeasonData, games: readonly Game[]): Map<string, Map<number, number>> {
  const slots = slotMap(data);
  const out = new Map<string, Map<number, number>>();
  for (const g of games) {
    const start = slots.get(g.gameSlotId)!.start;
    for (const t of [g.homeTrackId, g.awayTrackId]) {
      const row = out.get(t) ?? new Map<number, number>();
      row.set(start, (row.get(start) ?? 0) + 1);
      out.set(t, row);
    }
  }
  return out;
}

export function activeTrackIds(result: ScheduleBuildResult): string[] {
  const ids = new Set<string>();
  for (const g of result.games) ids.add(g.homeTrackId).add(g.awayTrackId);
  return [...ids];
}

/** Head coach person id per game track id. */
export function headCoachByTrack(data: SeasonData): Map<string, string> {
  const out = new Map<string, string>();
  for (const team of data.teams) {
    if (!team.gameTrackId || team.status === 'cancelled') continue;
    const head = data.coachAssignments.find((c) => c.teamId === team.id && c.role === 'head');
    if (head) out.set(team.gameTrackId, head.personId);
  }
  return out;
}
