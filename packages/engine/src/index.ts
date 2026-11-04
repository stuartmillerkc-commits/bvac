/**
 * @bvac/engine — Task 1 in docs/BUILD_PLAN.md.
 *
 * STUB: `placeDivision` currently does the simplest thing that satisfies the
 * contract (locked/protected players first, then first come, first served on
 * ranked choices) so the web app has realistic data to render. Task 1 replaces
 * it with the priority-first deferred-acceptance engine from docs/DESIGN.md.
 */
import {
  compareStrings,
  indexSeason,
  type Flag,
  type ID,
  type Placement,
  type PlaceDivision,
  type PlacementRunResult,
} from '@bvac/core';

export const ENGINE_IS_STUB = true;

export const placeDivision: PlaceDivision = (input): PlacementRunResult => {
  const { data, divisionId, round, fixed, asOf } = input;
  const index = indexSeason(data);
  const division = index.division.get(divisionId);
  if (!division) throw new Error(`Unknown division ${divisionId}`);
  const settings = { ...division.settings, ...input.settingsOverride };
  const cap = round === 1 && settings.round1Fill === 'preferred' ? settings.teamSize.preferred : settings.teamSize.max;
  const teams = (index.teamsByDivision.get(divisionId) ?? []).filter((t) => t.status !== 'cancelled');
  const size = new Map<ID, number>(teams.map((t) => [t.id, 0]));
  const regs = (index.registrationsByDivision.get(divisionId) ?? [])
    .filter((r) => !asOf || r.submittedAt <= asOf)
    .sort((a, b) => compareStrings(a.submittedAt, b.submittedAt) || compareStrings(a.id, b.id));

  const placements = new Map<ID, Placement>();
  for (const f of fixed) {
    if (!regs.some((r) => r.id === f.registrationId)) continue;
    placements.set(f.registrationId, f);
    if (f.teamId) size.set(f.teamId, (size.get(f.teamId) ?? 0) + 1);
  }
  // Coach protected picks (includes the coach's own kids).
  for (const ca of data.coachAssignments) {
    if (!size.has(ca.teamId)) continue;
    for (const playerId of ca.protectedPlayerIds) {
      const reg = index.registrationByPlayer.get(playerId);
      if (!reg || placements.has(reg.id) || !regs.includes(reg)) continue;
      placements.set(reg.id, {
        registrationId: reg.id,
        teamId: ca.teamId,
        round,
        state: 'projected',
        locked: true,
        choiceRankMet: reg.choices.find((c) => c.teamId === ca.teamId)?.rank ?? null,
        reasons: [{ code: 'protectedPick', text: 'Coach protected pick' }],
      });
      size.set(ca.teamId, (size.get(ca.teamId) ?? 0) + 1);
    }
  }
  const flags: Flag[] = [];
  for (const reg of regs) {
    if (placements.has(reg.id)) continue;
    const choice = [...reg.choices].sort((a, b) => a.rank - b.rank).find((c) => (size.get(c.teamId) ?? Infinity) < cap);
    if (choice) {
      size.set(choice.teamId, size.get(choice.teamId)! + 1);
      placements.set(reg.id, {
        registrationId: reg.id,
        teamId: choice.teamId,
        round,
        state: 'projected',
        locked: false,
        choiceRankMet: choice.rank,
        reasons: [{ code: 'choiceRank', text: `Choice #${choice.rank} (stub: first come, first served)` }],
      });
    } else {
      placements.set(reg.id, {
        registrationId: reg.id,
        teamId: null,
        round: null,
        state: 'waitlisted',
        locked: false,
        choiceRankMet: null,
        reasons: [{ code: reg.choices.length ? 'teamsFull' : 'noFittingTeam', text: reg.choices.length ? 'Ranked teams are full' : 'No ranked teams' }],
      });
      flags.push({ code: 'noFittingTeam', severity: 'warning', message: 'Could not place (stub engine)', divisionId, registrationId: reg.id });
    }
  }
  const all = [...placements.values()];
  const placed = all.filter((p) => p.teamId);
  const sizes = teams.map((t) => size.get(t.id) ?? 0);
  return {
    divisionId,
    round,
    placements: all,
    flags,
    stats: {
      registrations: regs.length,
      placed: placed.length,
      waitlisted: all.length - placed.length,
      firstChoiceRate: placed.length ? placed.filter((p) => p.choiceRankMet === 1).length / placed.length : 0,
      anyChoiceRate: placed.length ? placed.filter((p) => p.choiceRankMet !== null).length / placed.length : 0,
      friendRequestRate: 0,
      siblingTogetherRate: 0,
      coachRequestRate: 0,
      smallestTeam: sizes.length ? Math.min(...sizes) : 0,
      largestTeam: sizes.length ? Math.max(...sizes) : 0,
    },
  };
};
