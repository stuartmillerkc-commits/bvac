'use client';

import { useMemo } from 'react';
import type { ID } from '@bvac/core';
import { buildSeasonSchedules } from '@bvac/schedule';
import { useSeason } from '@/lib/season-store';

/** Shown until a division has a game schedule. */
export const GAMES_TBA = 'Game times to be announced';

/**
 * Plain-words game pattern per game track ("Mostly 9am · 2 games at 10am"),
 * from the schedule builder. Builds every division in a few ms; recomputed
 * only when the season data changes.
 */
export function useTrackDescriptions(): Map<ID, string> {
  const { data } = useSeason();
  return useMemo(() => {
    const out = new Map<ID, string>();
    try {
      for (const result of buildSeasonSchedules(data)) {
        for (const track of result.tracks) if (track.description) out.set(track.id, track.description);
      }
    } catch {
      // A schedule problem should never take down the family pages.
    }
    return out;
  }, [data]);
}
