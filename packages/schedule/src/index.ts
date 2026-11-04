/**
 * @bvac/schedule — Task 2 in docs/BUILD_PLAN.md.
 *
 * Game schedule builder by schedule position (docs/DESIGN.md "Game schedule
 * builder"): circle-method round robin, rotating or anchored time balance,
 * coach and sibling checks, plain-words track descriptions, partial rebuilds
 * from a date, and weekly practice events.
 */
export const SCHEDULE_IS_STUB = false;

export {
  buildSchedule,
  TBA_TRACK_DESCRIPTION,
  UNSCHEDULED_TRACK_DESCRIPTION,
  type ScheduleBuildOptions,
} from './build';
export { buildSeasonSchedules } from './season';
export { practiceEvents, type PracticeEvent } from './practice';
export { circleRounds, type Pairing, type RoundRobinRound } from './round-robin';
export { minCostAssignment } from './assignment';
