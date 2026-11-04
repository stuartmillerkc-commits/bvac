/**
 * @bvac/engine — the placement engine (docs/DESIGN.md "Placement engine",
 * docs/BUILD_PLAN.md Task 1).
 *
 * Run order for one division:
 * 1. Lock fixed placements (admin locks, published rounds) and coach
 *    protected picks (which include coaches' own kids).
 * 2. Build units: same-division siblings move together unless opted out.
 * 3. Place the main pool with the division's model:
 *    - ranked / hybrid / coachSelect: priority-first deferred acceptance,
 *      then a friend pass and a vacancy fill. coachSelect leaves placements
 *      "proposed" for coach approval.
 *    - fcfs: submission order, first acceptable team with room.
 *    - placementMethod "maxSatisfaction": local search on total utility,
 *      starting from the priority-first result.
 * 4. Late-window registrations take leftover seats in submission order.
 * 5. Report placements with reasons, flags and stats.
 */
import type { ID, PlaceDivision, PlacementRunInput, PlacementRunResult } from '@bvac/core';
import {
  deferredAcceptance,
  emptyAssignment,
  fillVacancies,
  firstComeFirstServed,
  friendPass,
  maximizeSatisfaction,
  unitUtility,
  type Assignment,
} from './assign';
import { buildContext } from './context';
import { lockedTeamOf } from './preferences';
import { buildOutcome } from './report';
import { buildUnits } from './units';

export const ENGINE_IS_STUB = false;

export { priorityFor, scorePriority, type PriorityFacts, type PriorityResult } from './priority';
export { fitScore } from './preferences';

export const placeDivision: PlaceDivision = (input: PlacementRunInput): PlacementRunResult => {
  const ctx = buildContext(input);

  const lockedLoad = new Map<ID, number>();
  for (const f of ctx.fixed.values()) if (f.teamId) lockedLoad.set(f.teamId, (lockedLoad.get(f.teamId) ?? 0) + 1);
  for (const p of ctx.protectedPicks.values()) lockedLoad.set(p.teamId, (lockedLoad.get(p.teamId) ?? 0) + 1);

  const units = buildUnits(ctx, ctx.mainPool);
  const lateUnits = buildUnits(ctx, ctx.latePool);
  const a = emptyAssignment(ctx, lockedLoad);

  const unitOfReg = new Map<ID, string>();
  for (const u of [...units, ...lateUnits]) for (const r of u.regs) unitOfReg.set(r.id, u.key);
  const teamOfReg = (regId: ID, x: Assignment): ID | null => {
    const locked = lockedTeamOf(ctx, regId);
    if (locked) return locked;
    const key = unitOfReg.get(regId);
    return key ? (x.team.get(key) ?? null) : null;
  };

  if (ctx.settings.model === 'fcfs') {
    firstComeFirstServed(ctx, units, a);
  } else {
    deferredAcceptance(ctx, units, a);
    // Two rounds: a move in the first can open a better friend match in the second.
    for (let i = 0; i < 2; i++) {
      friendPass(ctx, units, a, teamOfReg);
      fillVacancies(ctx, units, a);
    }
    if (ctx.settings.placementMethod === 'maxSatisfaction') maximizeSatisfaction(ctx, units, a);
  }
  firstComeFirstServed(ctx, lateUnits, a);

  const outcome = buildOutcome(ctx, units, lateUnits, a);
  return { divisionId: ctx.division.id, round: ctx.round, ...outcome };
};

/**
 * Total utility of a result under the maximize-satisfaction objective
 * (choice tier, fit and priority). Lets admins and tests compare methods.
 */
export function satisfactionTotal(input: PlacementRunInput, result: PlacementRunResult): number {
  const ctx = buildContext(input);
  const units = buildUnits(ctx, ctx.mainPool);
  const a: Assignment = { team: new Map(), load: new Map() };
  const byReg = new Map(result.placements.map((p) => [p.registrationId, p.teamId]));
  for (const u of units) a.team.set(u.key, byReg.get(u.regs[0]!.id) ?? null);
  return units.reduce((s, u) => s + unitUtility(u, a), 0);
}
