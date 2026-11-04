/**
 * Turns an assignment into the contract's placements, reasons, flags and stats.
 */
import {
  compareStrings,
  dayShort,
  fitsAvailability,
  formatWindow,
  type Flag,
  type ID,
  type Placement,
  type PlacementReason,
  type PlacementRunStats,
  type Registration,
  type Weekday,
} from '@bvac/core';
import type { Assignment } from './assign';
import { coachLabel, ordinal, type DivisionContext } from './context';
import { TIER_ANY_FIT, TIER_OUTSIDE_DAYS, TIER_SIBLING } from './preferences';
import { siblingGroups, type Unit } from './units';

export interface Outcome {
  placements: Placement[];
  flags: Flag[];
  stats: PlacementRunStats;
}

export function buildOutcome(ctx: DivisionContext, units: Unit[], lateUnits: Unit[], a: Assignment): Outcome {
  const placements = new Map<ID, Placement>();
  const teamOfReg = new Map<ID, ID | null>();
  const state = ctx.settings.model === 'coachSelect' ? 'proposed' : 'projected';

  // Fixed placements pass through untouched.
  for (const [regId, f] of ctx.fixed) {
    placements.set(regId, f);
    teamOfReg.set(regId, f.teamId);
  }
  // Coach protected picks.
  for (const [regId, pick] of ctx.protectedPicks) {
    const reg = ctx.index.registration.get(regId)!;
    teamOfReg.set(regId, pick.teamId);
    const reasons: PlacementReason[] = [
      pick.coachChild
        ? { code: 'coachChild', text: `Child of ${coachLabel(ctx, pick.teamId)}` }
        : { code: 'protectedPick', text: `Protected pick by ${coachLabel(ctx, pick.teamId)}` },
    ];
    reasons.push(...returningReasons(ctx, reg, pick.teamId));
    placements.set(regId, {
      registrationId: regId,
      teamId: pick.teamId,
      round: ctx.round,
      state: 'projected',
      locked: true,
      choiceRankMet: reg.choices.find((c) => c.teamId === pick.teamId)?.rank ?? null,
      reasons,
    });
  }
  for (const u of [...units, ...lateUnits]) for (const r of u.regs) teamOfReg.set(r.id, a.team.get(u.key) ?? null);

  const isLate = new Set(lateUnits.map((u) => u.key));
  for (const u of [...units, ...lateUnits]) {
    const teamId = a.team.get(u.key) ?? null;
    for (const reg of u.regs) {
      if (teamId) {
        placements.set(reg.id, {
          registrationId: reg.id,
          teamId,
          round: ctx.round,
          state,
          locked: false,
          choiceRankMet: reg.choices.find((c) => c.teamId === teamId)?.rank ?? null,
          reasons: placedReasons(ctx, u, reg, teamId, teamOfReg, isLate.has(u.key)),
        });
      } else {
        placements.set(reg.id, {
          registrationId: reg.id,
          teamId: null,
          round: null,
          state: 'waitlisted',
          locked: false,
          choiceRankMet: null,
          reasons: waitlistReasons(ctx, u, reg, isLate.has(u.key)),
        });
      }
    }
  }

  const ordered = ctx.registrations.map((r) => placements.get(r.id)!).filter(Boolean);
  return { placements: ordered, flags: buildFlags(ctx, units, lateUnits, teamOfReg), stats: buildStats(ctx, ordered, teamOfReg, units) };
}

function returningReasons(ctx: DivisionContext, reg: Registration, teamId: ID): PlacementReason[] {
  const coach = ctx.coachOf.get(teamId);
  if (!coach || ctx.lastCoach.get(reg.playerId) !== coach) return [];
  return [
    {
      code: 'returningWithCoach',
      text: `Returning with ${coachLabel(ctx, teamId)} (+${ctx.settings.priority.playedForCoachLastSeason})`,
      points: ctx.settings.priority.playedForCoachLastSeason,
    },
  ];
}

function placedReasons(
  ctx: DivisionContext,
  u: Unit,
  reg: Registration,
  teamId: ID,
  teamOfReg: Map<ID, ID | null>,
  late: boolean,
): PlacementReason[] {
  const reasons: PlacementReason[] = [];
  const rank = reg.choices.find((c) => c.teamId === teamId)?.rank;
  const opt = u.options[u.rankOf.get(teamId) ?? -1];
  if (rank) reasons.push({ code: 'choiceRank', text: `${ordinal(rank)} choice` });
  else if (opt?.tier === TIER_SIBLING) reasons.push({ code: 'siblingTogether', text: 'Placed with a sibling already on this team' });
  else if (opt?.tier === TIER_ANY_FIT) reasons.push({ code: 'anyFittingTeam', text: "Fits the family's days (any team OK)" });
  else if (opt?.tier === TIER_OUTSIDE_DAYS) reasons.push({ code: 'fit', text: "Outside the family's preferred days (not marked required)" });
  if (late) reasons.push({ code: 'fit', text: 'Late registration: placed in a leftover seat' });
  if (u.size > 1) reasons.push({ code: 'siblingTogether', text: 'Sibling kept together' });
  for (const q of reg.requests) {
    if (q.type !== 'friend' || !q.targetPlayerId) continue;
    const friendReg = ctx.registrationByPlayer.get(q.targetPlayerId);
    if (friendReg && teamOfReg.get(friendReg.id) === teamId) {
      const p = ctx.index.player.get(q.targetPlayerId)!;
      reasons.push({ code: 'friendMet', text: `Friend request met (${p.firstName} ${p.lastName[0]}.)` });
    }
  }
  const coach = ctx.coachOf.get(teamId);
  if (coach && reg.coachRequest && (reg.coachRequest.coachPersonId === coach || (reg.coachRequest.sameAsLastSeason && ctx.lastCoach.get(reg.playerId) === coach))) {
    reasons.push({ code: 'coachRequestMet', text: `Coach request met (${coachLabel(ctx, teamId)})` });
  }
  reasons.push(...returningReasons(ctx, reg, teamId));
  const pr = u.priority.get(teamId);
  if (pr && pr.points > 0) {
    reasons.push({ code: 'priority', text: `Priority ${pr.points} on this team`, points: pr.points });
    for (const r of pr.reasons) if (!r.text.startsWith('Played for ')) reasons.push(r);
  }
  return reasons;
}

function waitlistReasons(ctx: DivisionContext, u: Unit, reg: Registration, late: boolean): PlacementReason[] {
  if (u.options.length === 0) {
    const days = describeAvailability(reg);
    return [
      {
        code: 'noFittingTeam',
        text: reg.availabilityRequired
          ? `Only ${days || 'no days'} work, and no ${ctx.division.name} team practices then`
          : 'No ranked team is available and the family did not accept other teams',
      },
    ];
  }
  if (late) return [{ code: 'teamsFull', text: 'Late registration: waitlisted until a seat opens' }];
  const first = u.options[0]!;
  const pr = u.priority.get(first.teamId)?.points ?? 0;
  return [
    {
      code: 'teamsFull',
      text: `Every acceptable team is full (priority ${pr} on top choice)`,
      points: pr,
    },
  ];
}

function buildFlags(ctx: DivisionContext, units: Unit[], lateUnits: Unit[], teamOfReg: Map<ID, ID | null>): Flag[] {
  const flags: Flag[] = [];
  const divisionId = ctx.division.id;
  const { min, preferred, max } = ctx.settings.teamSize;
  const size = new Map<ID, number>(ctx.teams.map((t) => [t.id, 0]));
  for (const t of teamOfReg.values()) if (t && size.has(t)) size.set(t, size.get(t)! + 1);

  for (const t of ctx.teams) {
    const n = size.get(t.id)!;
    if (n < min) {
      flags.push({ code: 'teamUnderMin', severity: 'warning', divisionId, teamId: t.id, message: `${t.label} has ${n} players; minimum is ${min}` });
    }
    if (n > max) {
      flags.push({ code: 'teamOverMax', severity: 'critical', divisionId, teamId: t.id, message: `${t.label} has ${n} players; maximum is ${max}` });
    }
  }

  const registered = ctx.registrations.length;
  const seats = ctx.teams.length * max;
  const waitlisted = ctx.registrations.filter((r) => !teamOfReg.get(r.id));
  if (registered > seats) {
    const short = registered - seats;
    const teamsNeeded = Math.ceil(short / preferred);
    const nights = new Map<Weekday, number>();
    for (const r of waitlisted) for (const w of new Set(r.availability.map((x) => x.day))) nights.set(w, (nights.get(w) ?? 0) + 1);
    const top = [...nights.entries()].sort((x, y) => y[1] - x[1] || compareStrings(x[0], y[0])).slice(0, 2).map(([d]) => dayShort(d));
    flags.push({
      code: 'demandExceedsCapacity',
      severity: 'critical',
      divisionId,
      message:
        `${registered} registered for ${seats} seats at max size. Needs ${teamsNeeded} more team${teamsNeeded === 1 ? '' : 's'}` +
        (top.length ? `; most-wanted nights for waitlisted kids: ${top.join(' and ')}` : ''),
    });
  }

  for (const u of [...units, ...lateUnits]) {
    if (u.options.length === 0) {
      for (const r of u.regs) {
        flags.push({ code: 'noFittingTeam', severity: 'warning', divisionId, registrationId: r.id, message: `${playerName(ctx, r)}: no team fits the family's required days` });
      }
    }
  }

  // Same-division siblings who should be together but ended up apart (any cause: locks, required days, seats).
  if (ctx.settings.keepSiblingsTogether) {
    const seen = new Set<string>();
    for (const group of siblingGroups(ctx).values()) {
      if (group.length < 2) continue;
      const key = [...group].sort(compareStrings).join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      if (group.some((id) => ctx.index.registration.get(id)?.siblingsTogetherOptOut)) continue;
      const teams = new Set(group.map((id) => teamOfReg.get(id) ?? null));
      if (teams.size > 1) {
        flags.push({
          code: 'requestUnmet',
          severity: 'warning',
          divisionId,
          registrationId: group[0]!,
          message: `Siblings ${group.map((id) => playerName(ctx, ctx.index.registration.get(id)!)).join(' & ')} could not be kept together`,
        });
      }
    }
  }

  for (const r of ctx.registrations) {
    const mine = teamOfReg.get(r.id);
    if (!mine) continue;
    for (const q of r.requests) {
      if (q.type !== 'friend' || !q.targetPlayerId) continue;
      if (q.matchStatus !== 'matched' && q.matchStatus !== 'confirmed') continue;
      const friend = ctx.registrationByPlayer.get(q.targetPlayerId);
      const theirs = friend ? teamOfReg.get(friend.id) : null;
      if (theirs && theirs !== mine) {
        flags.push({ code: 'requestUnmet', severity: 'info', divisionId, registrationId: r.id, message: `${playerName(ctx, r)} asked to play with ${q.targetName}; on different teams` });
      }
    }
    if (r.coachRequest?.coachPersonId && ctx.coachOf.get(mine) !== r.coachRequest.coachPersonId) {
      const team = ctx.teams.find((t) => ctx.coachOf.get(t.id) === r.coachRequest!.coachPersonId);
      if (team) {
        flags.push({ code: 'coachRequestUnmet', severity: 'info', divisionId, registrationId: r.id, message: `${playerName(ctx, r)} asked for ${coachLabel(ctx, team.id)}` });
      }
    }
  }
  return flags;
}

/** "Mon, Tue, Thu 6:30–8pm" (grouped by identical time windows). */
function describeAvailability(reg: Registration): string {
  const groups = new Map<string, string[]>();
  for (const w of reg.availability) {
    const key = `${w.start}-${w.end}`;
    groups.set(key, [...(groups.get(key) ?? []), dayShort(w.day)]);
  }
  return [...groups.entries()]
    .map(([key, days]) => {
      const [start, end] = key.split('-').map(Number) as [number, number];
      const range = formatWindow({ day: 'mon', start, end }).slice(4);
      return `${days.join(', ')} ${range}`;
    })
    .join('; ');
}

function playerName(ctx: DivisionContext, r: Registration): string {
  const p = ctx.index.player.get(r.playerId);
  return p ? `${p.firstName} ${p.lastName}` : r.id;
}

function buildStats(ctx: DivisionContext, placements: Placement[], teamOfReg: Map<ID, ID | null>, units: Unit[]): PlacementRunStats {
  const placed = placements.filter((p) => p.teamId);
  const ranked = placed.filter((p) => (ctx.index.registration.get(p.registrationId)?.choices.length ?? 0) > 0);
  let friendTotal = 0;
  let friendMet = 0;
  let coachTotal = 0;
  let coachMet = 0;
  for (const r of ctx.registrations) {
    const mine = teamOfReg.get(r.id);
    for (const q of r.requests) {
      if (q.type !== 'friend' || !q.targetPlayerId) continue;
      if (q.matchStatus !== 'matched' && q.matchStatus !== 'confirmed') continue;
      const friend = ctx.registrationByPlayer.get(q.targetPlayerId);
      if (!friend) continue;
      friendTotal++;
      if (mine && teamOfReg.get(friend.id) === mine) friendMet++;
    }
    if (r.coachRequest?.coachPersonId && ctx.teams.some((t) => ctx.coachOf.get(t.id) === r.coachRequest!.coachPersonId)) {
      coachTotal++;
      if (mine && ctx.coachOf.get(mine) === r.coachRequest.coachPersonId) coachMet++;
    }
  }
  const groups = new Map<string, ID[]>();
  for (const group of siblingGroups(ctx).values()) {
    if (group.length < 2 || !ctx.settings.keepSiblingsTogether) continue;
    if (group.some((id) => ctx.index.registration.get(id)?.siblingsTogetherOptOut)) continue;
    groups.set([...group].sort(compareStrings).join(','), group);
  }
  let groupsTogether = 0;
  for (const g of groups.values()) {
    const teams = new Set(g.map((id) => teamOfReg.get(id) ?? null));
    if (teams.size === 1 && teams.has(null)) {
      // Waitlisted together: not a split, but not a placement either; leave out of the rate.
      groups.delete([...g].sort(compareStrings).join(','));
      continue;
    }
    if (teams.size === 1) groupsTogether++;
  }
  const sizes = ctx.teams.map((t) => [...teamOfReg.values()].filter((x) => x === t.id).length);
  const rate = (n: number, d: number) => (d === 0 ? 1 : n / d);
  return {
    registrations: placements.length,
    placed: placed.length,
    waitlisted: placements.length - placed.length,
    firstChoiceRate: rate(ranked.filter((p) => p.choiceRankMet === 1).length, ranked.length),
    anyChoiceRate: rate(ranked.filter((p) => p.choiceRankMet !== null).length, ranked.length),
    friendRequestRate: rate(friendMet, friendTotal),
    siblingTogetherRate: rate(groupsTogether, groups.size),
    coachRequestRate: rate(coachMet, coachTotal),
    smallestTeam: sizes.length ? Math.min(...sizes) : 0,
    largestTeam: sizes.length ? Math.max(...sizes) : 0,
  };
}

/** Used by tests: does a placed registration's team fit its availability? */
export function placementFitsDays(ctx: DivisionContext, reg: Registration, teamId: ID): boolean {
  return fitsAvailability(ctx.window.get(teamId)!, reg.availability);
}
