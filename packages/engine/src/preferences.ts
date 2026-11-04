/**
 * Family-side preferences: which teams a registration may go to, in what
 * order, and the fit score used to order teams the family did not rank
 * (docs/DESIGN.md "Placement engine", steps 1–3).
 */
import { FACTORS, compareStrings, factorMultiplier, fitsAvailability, dayAvailable, type Factor, type ID, type Registration } from '@bvac/core';
import type { DivisionContext } from './context';
import { scorePriority, type PriorityResult } from './priority';

/**
 * One acceptable team. Lower (tier, pos) is better.
 * - tier 0: a sibling is locked on this team (keep the family together)
 * - tier 1..n: the family's ranked choices
 * - tier 100: unranked team that fits the family's days ("any fitting team is fine")
 * - tier 200: unranked team outside the family's preferred days (days not marked required)
 */
export interface TeamOption {
  teamId: ID;
  tier: number;
  pos: number;
  fit: number;
}

export const TIER_SIBLING = 0;
export const TIER_ANY_FIT = 100;
export const TIER_OUTSIDE_DAYS = 200;

export function compareOptions(a: TeamOption, b: TeamOption): number {
  return a.tier - b.tier || a.pos - b.pos || compareStrings(a.teamId, b.teamId);
}

export interface FitResult {
  score: number;
  parts: Record<Factor, number>;
}

/** fit(p,t) = Σ W_f · a_f · s_f(p,t) */
export function fitScore(ctx: DivisionContext, reg: Registration, teamId: ID): FitResult {
  const window = ctx.window.get(teamId)!;
  const coach = ctx.coachOf.get(teamId);
  const lastCoach = ctx.lastCoach.get(reg.playerId);
  const friendIds = reg.requests
    .filter((q) => q.type === 'friend' && q.targetPlayerId && (q.matchStatus === 'matched' || q.matchStatus === 'confirmed'))
    .map((q) => q.targetPlayerId!);
  const friendsHere = friendIds.filter((pid) => {
    const r = ctx.registrationByPlayer.get(pid);
    if (!r) return false;
    const lockedTeam = lockedTeamOf(ctx, r.id);
    if (lockedTeam) return lockedTeam === teamId;
    return r.choices.some((c) => c.rank === 1 && c.teamId === teamId);
  }).length;
  const s: Record<Factor, number> = {
    practiceTime: fitsAvailability(window, reg.availability) ? 1 : dayAvailable(window, reg.availability) ? 0.5 : 0,
    coach:
      !!coach && (reg.coachRequest?.coachPersonId === coach || (reg.coachRequest?.sameAsLastSeason === true && lastCoach === coach)) ? 1 : 0,
    friends: friendIds.length ? friendsHere / friendIds.length : 0,
    lastTeam: !!coach && lastCoach === coach ? 1 : 0,
  };
  let score = 0;
  for (const f of FACTORS) score += ctx.settings.factorWeights[f] * factorMultiplier(reg.factorRanking, f) * s[f];
  return { score, parts: s };
}

export function lockedTeamOf(ctx: DivisionContext, registrationId: ID): ID | null {
  const f = ctx.fixed.get(registrationId);
  if (f) return f.teamId;
  return ctx.protectedPicks.get(registrationId)?.teamId ?? null;
}

/** Hard filter: right division, team active, and inside required days. */
export function feasible(ctx: DivisionContext, reg: Registration, teamId: ID): boolean {
  if (!ctx.teamIds.has(teamId)) return false;
  if (reg.availabilityRequired && !fitsAvailability(ctx.window.get(teamId)!, reg.availability)) return false;
  return true;
}

/** Ordered acceptable teams for one registration. */
export function optionsFor(ctx: DivisionContext, reg: Registration, siblingTeams: readonly ID[] = []): TeamOption[] {
  const out = new Map<ID, TeamOption>();
  const fitCache = new Map<ID, number>();
  const fit = (teamId: ID) => {
    if (!fitCache.has(teamId)) fitCache.set(teamId, fitScore(ctx, reg, teamId).score);
    return fitCache.get(teamId)!;
  };
  for (const teamId of siblingTeams) {
    if (feasible(ctx, reg, teamId)) out.set(teamId, { teamId, tier: TIER_SIBLING, pos: 0, fit: fit(teamId) });
  }
  for (const c of [...reg.choices].sort((a, b) => a.rank - b.rank)) {
    if (out.has(c.teamId) || !feasible(ctx, reg, c.teamId)) continue;
    out.set(c.teamId, { teamId: c.teamId, tier: c.rank, pos: 0, fit: fit(c.teamId) });
  }
  if (reg.acceptAnyFittingTeam || reg.choices.length === 0) {
    const rest = ctx.teams
      .map((t) => t.id)
      .filter((id) => !out.has(id) && feasible(ctx, reg, id))
      .map((id) => ({ id, fit: fit(id), fits: fitsAvailability(ctx.window.get(id)!, reg.availability) }))
      .sort((a, b) => b.fit - a.fit || compareStrings(a.id, b.id));
    rest.forEach((r, i) => {
      out.set(r.id, { teamId: r.id, tier: r.fits ? TIER_ANY_FIT : TIER_OUTSIDE_DAYS, pos: i, fit: r.fit });
    });
  }
  return [...out.values()].sort(compareOptions);
}

/** Priority of one registration on one team. */
export function priorityOn(ctx: DivisionContext, reg: Registration, teamId: ID, siblingTeams: readonly ID[]): PriorityResult {
  const coach = ctx.coachOf.get(teamId);
  const person = coach ? ctx.index.person.get(coach) : undefined;
  return scorePriority(ctx.settings.priority, {
    earlyWindow: reg.window === 'early',
    playedLastSeason: ctx.lastCoach.has(reg.playerId) && (ctx.index.historyByPlayer.get(reg.playerId) ?? []).some((h) => h.seasonOrder === ctx.index.lastSeasonOrder),
    priorSeasons: ctx.priorSeasons.get(reg.playerId) ?? 0,
    playedForCoachLastSeason: !!coach && ctx.lastCoach.get(reg.playerId) === coach,
    seasonsWithCoach: coach ? (ctx.seasonsWithCoach.get(`${reg.playerId}|${coach}`) ?? 0) : 0,
    siblingOnTeam: siblingTeams.includes(teamId),
    coachName: person ? `Coach ${person.lastName}` : 'this coach',
  });
}
