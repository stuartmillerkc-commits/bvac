/**
 * Assignment algorithms. All work on units (sibling groups) and seat loads.
 *
 * - deferredAcceptance: priority-first, family-proposing deferred acceptance
 *   with team capacities (docs/DESIGN.md step 5). A team holds its
 *   highest-priority applicants that fit its remaining seats. A sibling pair
 *   that needs two seats does not block a single kid from a team's last seat:
 *   the team skips units that don't fit and keeps filling in priority order.
 * - firstComeFirstServed: submission order, first acceptable team with room.
 * - fillVacancies: any unit moves to a team it strictly prefers that has room.
 *   Keeps the result stable after other passes free up seats.
 * - friendPass: moves and swaps within the same preference tier that satisfy
 *   more matched friend requests (step 6).
 * - maximizeSatisfaction: local search on total utility (the alternative
 *   "maximize satisfaction" method), starting from the priority-first result.
 */
import { compareStrings, type ID } from '@bvac/core';
import type { DivisionContext } from './context';
import { comparePriority, type Unit } from './units';

export interface Assignment {
  /** unit key -> team id, or null when waitlisted. */
  team: Map<string, ID | null>;
  /** team id -> seats used, including locked players. */
  load: Map<ID, number>;
}

export function emptyAssignment(ctx: DivisionContext, lockedLoad: Map<ID, number>): Assignment {
  return { team: new Map(), load: new Map(ctx.teams.map((t) => [t.id, lockedLoad.get(t.id) ?? 0])) };
}

function room(ctx: DivisionContext, a: Assignment, teamId: ID): number {
  return (ctx.cap.get(teamId) ?? 0) - (a.load.get(teamId) ?? 0);
}

function place(a: Assignment, u: Unit, teamId: ID | null) {
  const prev = a.team.get(u.key);
  if (prev) a.load.set(prev, a.load.get(prev)! - u.size);
  a.team.set(u.key, teamId);
  if (teamId) a.load.set(teamId, (a.load.get(teamId) ?? 0) + u.size);
}

export function deferredAcceptance(ctx: DivisionContext, units: Unit[], a: Assignment): void {
  const next = new Map<string, number>(units.map((u) => [u.key, 0]));
  const held = new Map<ID, Unit[]>(ctx.teams.map((t) => [t.id, []]));
  const baseLoad = new Map(a.load);
  const free: Unit[] = [...units];
  while (free.length > 0) {
    const u = free.shift()!;
    const i = next.get(u.key)!;
    if (i >= u.options.length) {
      a.team.set(u.key, null);
      continue;
    }
    next.set(u.key, i + 1);
    const teamId = u.options[i]!.teamId;
    const candidates = [...held.get(teamId)!, u].sort((x, y) => comparePriority(x, y, teamId));
    let left = (ctx.cap.get(teamId) ?? 0) - (baseLoad.get(teamId) ?? 0);
    const accepted: Unit[] = [];
    for (const c of candidates) {
      if (c.size <= left) {
        accepted.push(c);
        left -= c.size;
      } else free.push(c);
    }
    held.set(teamId, accepted);
  }
  for (const [teamId, list] of held) for (const u of list) a.team.set(u.key, teamId);
  for (const u of units) if (!a.team.has(u.key)) a.team.set(u.key, null);
  recomputeLoad(ctx, units, a, baseLoad);
}

export function firstComeFirstServed(ctx: DivisionContext, units: Unit[], a: Assignment): void {
  const ordered = [...units].sort((x, y) => compareStrings(x.submittedAt, y.submittedAt) || compareStrings(x.key, y.key));
  for (const u of ordered) {
    const opt = u.options.find((o) => room(ctx, a, o.teamId) >= u.size);
    place(a, u, opt ? opt.teamId : null);
  }
}

function recomputeLoad(ctx: DivisionContext, units: Unit[], a: Assignment, baseLoad: Map<ID, number>) {
  for (const t of ctx.teams) a.load.set(t.id, baseLoad.get(t.id) ?? 0);
  for (const u of units) {
    const t = a.team.get(u.key);
    if (t) a.load.set(t, a.load.get(t)! + u.size);
  }
}

/** Position of the unit's current team in its own list; Infinity when waitlisted. */
function currentRank(u: Unit, a: Assignment): number {
  const t = a.team.get(u.key);
  return t ? (u.rankOf.get(t) ?? Infinity) : Infinity;
}

export function fillVacancies(ctx: DivisionContext, units: Unit[], a: Assignment): void {
  const ordered = [...units].sort((x, y) => compareStrings(x.submittedAt, y.submittedAt) || compareStrings(x.key, y.key));
  for (let pass = 0; pass < 50; pass++) {
    let moved = false;
    for (const u of ordered) {
      const cur = currentRank(u, a);
      for (let i = 0; i < Math.min(cur, u.options.length); i++) {
        const t = u.options[i]!.teamId;
        if (room(ctx, a, t) >= u.size) {
          // Respect priority: a higher-priority unit waiting for the same seat goes first.
          const rival = ordered.find(
            (v) => v !== u && v.size <= room(ctx, a, t) && (v.rankOf.get(t) ?? Infinity) < currentRank(v, a) && comparePriority(v, u, t) < 0,
          );
          if (rival) continue;
          place(a, u, t);
          moved = true;
          break;
        }
      }
    }
    if (!moved) return;
  }
}

// ---------------------------------------------------------------------------
// Stability
// ---------------------------------------------------------------------------

/** Tier of a unit's current placement; Infinity when waitlisted. */
function currentTier(u: Unit, a: Assignment): number {
  const t = a.team.get(u.key);
  if (!t) return Infinity;
  const i = u.rankOf.get(t);
  return i === undefined ? Infinity : u.options[i]!.tier;
}

export interface BlockingPair {
  unit: string;
  teamId: ID;
  /** "room" = team has an open seat; "priority" = team holds a lower-priority unit. */
  kind: 'room' | 'priority';
}

/**
 * Unit/team pairs where the unit strictly prefers the team (a better tier than
 * where it is now) and the team either has room or holds an unlocked unit of
 * lower priority that frees at least as many seats. Empty means stable.
 * `onlyTeams` limits the check to some teams.
 */
export function blockingPairs(ctx: DivisionContext, units: Unit[], a: Assignment, onlyTeams?: ReadonlySet<ID>): BlockingPair[] {
  const out: BlockingPair[] = [];
  const holders = new Map<ID, Unit[]>();
  for (const u of units) {
    const t = a.team.get(u.key);
    if (t) holders.set(t, [...(holders.get(t) ?? []), u]);
  }
  for (const u of units) {
    const tier = currentTier(u, a);
    for (const o of u.options) {
      if (o.tier >= tier) break;
      if (onlyTeams && !onlyTeams.has(o.teamId)) continue;
      if (room(ctx, a, o.teamId) >= u.size) {
        out.push({ unit: u.key, teamId: o.teamId, kind: 'room' });
        continue;
      }
      const weaker = (holders.get(o.teamId) ?? []).find((v) => v.size >= u.size && comparePriority(u, v, o.teamId) < 0);
      if (weaker) out.push({ unit: u.key, teamId: o.teamId, kind: 'priority' });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Friend pass
// ---------------------------------------------------------------------------

export interface FriendLink {
  fromUnit: string;
  fromReg: ID;
  toReg: ID;
  mutual: boolean;
}

export function friendLinks(ctx: DivisionContext, units: Unit[]): FriendLink[] {
  const unitOfReg = new Map<ID, string>();
  for (const u of units) for (const r of u.regs) unitOfReg.set(r.id, u.key);
  const links: FriendLink[] = [];
  const asked = new Set<string>();
  for (const u of units) {
    for (const r of u.regs) {
      for (const q of r.requests) {
        if (q.type !== 'friend' || !q.targetPlayerId) continue;
        if (q.matchStatus !== 'matched' && q.matchStatus !== 'confirmed') continue;
        const target = ctx.registrationByPlayer.get(q.targetPlayerId);
        if (!target || unitOfReg.get(target.id) === u.key) continue;
        asked.add(`${r.id}>${target.id}`);
        links.push({ fromUnit: u.key, fromReg: r.id, toReg: target.id, mutual: false });
      }
    }
  }
  for (const l of links) l.mutual = asked.has(`${l.toReg}>${l.fromReg}`);
  return links.sort((x, y) => Number(y.mutual) - Number(x.mutual) || compareStrings(x.fromReg, y.fromReg) || compareStrings(x.toReg, y.toReg));
}

export function friendPass(
  ctx: DivisionContext,
  units: Unit[],
  a: Assignment,
  teamOfReg: (regId: ID, a: Assignment) => ID | null,
): void {
  const links = friendLinks(ctx, units);
  const byKey = new Map(units.map((u) => [u.key, u]));
  const satisfied = () => links.filter((l) => {
    const t1 = teamOfReg(l.fromReg, a);
    return !!t1 && t1 === teamOfReg(l.toReg, a);
  }).length;

  for (const link of links) {
    const u = byKey.get(link.fromUnit)!;
    const from = a.team.get(u.key);
    const to = teamOfReg(link.toReg, a);
    if (!from || !to || from === to) continue;
    const curOpt = u.options[u.rankOf.get(from)!]!;
    const toIdx = u.rankOf.get(to);
    if (toIdx === undefined) continue;
    const toOpt = u.options[toIdx]!;
    if (toOpt.tier > curOpt.tier) continue; // never move a family to a team they ranked lower
    const before = satisfied();
    const touched = new Set([from, to]);
    const blockedBefore = blockingPairs(ctx, units, a, touched).length;
    if (room(ctx, a, to) >= u.size) {
      place(a, u, to);
      // A seat freed by an earlier move belongs to whoever has priority for it, not to a friend move.
      if (satisfied() > before && blockingPairs(ctx, units, a, touched).length <= blockedBefore) continue;
      place(a, u, from);
      continue;
    }
    // Swap with an unlocked unit on `to` that is indifferent between the two teams.
    const partners = units
      .filter((v) => v !== u && v.size === u.size && a.team.get(v.key) === to)
      .filter((v) => {
        const vFrom = v.rankOf.get(from);
        const vTo = v.rankOf.get(to);
        return vFrom !== undefined && vTo !== undefined && v.options[vFrom]!.tier <= v.options[vTo]!.tier;
      })
      .sort((x, y) => compareStrings(x.key, y.key));
    for (const v of partners) {
      place(a, u, to);
      place(a, v, from);
      // Keep only swaps that meet more friend requests without creating a priority violation.
      if (satisfied() > before && blockingPairs(ctx, units, a, touched).length <= blockedBefore) break;
      place(a, v, to);
      place(a, u, from);
    }
  }
}

// ---------------------------------------------------------------------------
// Maximize satisfaction
// ---------------------------------------------------------------------------

/** Utility of placing a unit on its option at list index i. */
export function optionUtility(u: Unit, i: number, teamId: ID): number {
  const o = u.options[i]!;
  const tierValue =
    o.tier === 0 ? 110 : o.tier === 1 ? 100 : o.tier === 2 ? 75 : o.tier === 3 ? 60 : o.tier < 100 ? Math.max(45, 60 - 5 * (o.tier - 3)) : o.tier === 100 ? 35 : 10;
  const priority = u.priority.get(teamId)?.points ?? 0;
  return (tierValue + o.fit / 10 + priority / 10) * u.size;
}

export function unitUtility(u: Unit, a: Assignment): number {
  const t = a.team.get(u.key);
  if (!t) return 0;
  const i = u.rankOf.get(t);
  return i === undefined ? 0 : optionUtility(u, i, t);
}

export function maximizeSatisfaction(ctx: DivisionContext, units: Unit[], a: Assignment): void {
  const ordered = [...units].sort((x, y) => compareStrings(x.key, y.key));
  for (let pass = 0; pass < 30; pass++) {
    let improved = false;
    // Single moves into open seats.
    for (const u of ordered) {
      const cur = unitUtility(u, a);
      let best: { t: ID; gain: number } | null = null;
      u.options.forEach((o, i) => {
        if (o.teamId === a.team.get(u.key) || room(ctx, a, o.teamId) < u.size) return;
        const gain = optionUtility(u, i, o.teamId) - cur;
        if (gain > 1e-9 && (!best || gain > best.gain)) best = { t: o.teamId, gain };
      });
      if (best) {
        place(a, u, (best as { t: ID }).t);
        improved = true;
      }
    }
    // Pairwise swaps between teams (same seat count).
    for (let i = 0; i < ordered.length; i++) {
      const u = ordered[i]!;
      const tu = a.team.get(u.key);
      if (!tu) continue;
      for (let j = i + 1; j < ordered.length; j++) {
        const v = ordered[j]!;
        const tv = a.team.get(v.key);
        if (!tv || tv === tu || v.size !== u.size) continue;
        const iu = u.rankOf.get(tv);
        const iv = v.rankOf.get(tu);
        if (iu === undefined || iv === undefined) continue;
        const gain = optionUtility(u, iu, tv) + optionUtility(v, iv, tu) - unitUtility(u, a) - unitUtility(v, a);
        if (gain > 1e-9) {
          place(a, u, tv);
          place(a, v, tu);
          improved = true;
          break;
        }
      }
    }
    if (!improved) return;
  }
}
