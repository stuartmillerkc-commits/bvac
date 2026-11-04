import { compareStrings, type Placement, type ScheduleBuildResult, type SeasonData } from '@bvac/core';
import { buildSchedule } from './build';

/**
 * Build every division in `sortOrder`, each with its division's
 * `gameTimeStyle`. Each division sees the games already built for earlier
 * divisions in `data.games`, so cross-division rules (a coach on two teams,
 * siblings in two divisions) apply between them.
 */
export function buildSeasonSchedules(
  data: SeasonData,
  options: { placements?: readonly Placement[] } = {},
): ScheduleBuildResult[] {
  const divisions = [...data.divisions].sort((a, b) => a.sortOrder - b.sortOrder || compareStrings(a.id, b.id));
  let games = data.games;
  const results: ScheduleBuildResult[] = [];
  for (const division of divisions) {
    const result = buildSchedule({
      data: { ...data, games },
      divisionId: division.id,
      style: division.settings.gameTimeStyle,
      ...(options.placements ? { placements: options.placements } : {}),
    });
    games = [...games.filter((g) => g.divisionId !== division.id), ...result.games];
    results.push(result);
  }
  return results;
}
