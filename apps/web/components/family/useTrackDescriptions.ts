'use client';

import type { ID } from '@bvac/core';
import { useSeason } from '@/lib/season-store';

/** Shown until a division has a game schedule. */
export const GAMES_TBA = 'Game times to be announced';

/**
 * Plain-words game pattern per game track ("Mostly 9am · 2 games at 10am"),
 * from the season schedule the store builds once with the schedule builder.
 */
export function useTrackDescriptions(): Map<ID, string> {
  return useSeason().trackDescriptions;
}
