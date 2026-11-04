/**
 * @bvac/schedule — Task 2 in docs/BUILD_PLAN.md.
 *
 * STUB: returns no games. Task 2 implements the round robin by schedule
 * position, rotating/anchored time balancing, conflict checks and plain-words
 * track descriptions described in docs/DESIGN.md "Game schedule builder".
 */
import type { BuildSchedule } from '@bvac/core';

export const SCHEDULE_IS_STUB = true;

export const buildSchedule: BuildSchedule = (input) => {
  const tracks = input.data.gameTracks.filter((t) => t.divisionId === input.divisionId);
  return {
    divisionId: input.divisionId,
    games: [],
    tracks: tracks.map((t) => ({ ...t, description: t.description || 'Game times to be announced' })),
    flags: [],
    changedGameIds: [],
  };
};
