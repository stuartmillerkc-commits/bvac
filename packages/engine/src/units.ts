/**
 * Placement units (docs/DESIGN.md "Placement engine", step 1): same-division
 * siblings move together as one unit unless the family opted out or BVAC
 * turned the rule off. A unit takes as many seats as it has kids.
 */
import { compareStrings, type ID, type Registration } from '@bvac/core';
import type { DivisionContext } from './context';
import { lockedTeamOf, optionsFor, priorityOn, type TeamOption } from './preferences';
import type { PriorityResult } from './priority';

export interface Unit {
  key: string;
  regs: Registration[];
  size: number;
  /** Earliest submission in the unit; the tiebreak after priority. */
  submittedAt: string;
  options: TeamOption[];
  rankOf: Map<ID, number>;
  priority: Map<ID, PriorityResult>;
  /** Teams where a sibling of this unit is already locked. */
  siblingTeams: ID[];
  /** True when siblings who should be together could not be kept as one unit. */
  split: boolean;
  /** Same-division sibling group this unit belongs to (registration ids). */
  siblingGroup: ID[];
}

class UnionFind {
  private parent = new Map<ID, ID>();
  find(x: ID): ID {
    let p = this.parent.get(x) ?? x;
    if (p !== x) {
      p = this.find(p);
      this.parent.set(x, p);
    }
    return p;
  }
  union(a: ID, b: ID) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(compareStrings(ra, rb) < 0 ? rb : ra, compareStrings(ra, rb) < 0 ? ra : rb);
  }
}

/** Same-division sibling groups over all in-scope registrations (registration ids). */
export function siblingGroups(ctx: DivisionContext): Map<ID, ID[]> {
  const uf = new UnionFind();
  const byHousehold = new Map<ID, ID[]>();
  for (const r of ctx.registrations) {
    const hh = ctx.index.player.get(r.playerId)?.householdId;
    if (!hh) continue;
    byHousehold.set(hh, [...(byHousehold.get(hh) ?? []), r.id]);
    for (const q of r.requests) {
      if (q.type !== 'sibling' || !q.targetPlayerId) continue;
      if (q.matchStatus !== 'matched' && q.matchStatus !== 'confirmed') continue;
      const other = ctx.registrationByPlayer.get(q.targetPlayerId);
      if (other) uf.union(r.id, other.id);
    }
  }
  for (const ids of byHousehold.values()) for (const id of ids.slice(1)) uf.union(ids[0]!, id);
  const groups = new Map<ID, ID[]>();
  for (const r of ctx.registrations) {
    const root = uf.find(r.id);
    groups.set(root, [...(groups.get(root) ?? []), r.id]);
  }
  const byReg = new Map<ID, ID[]>();
  for (const ids of groups.values()) for (const id of ids) byReg.set(id, ids);
  return byReg;
}

export function buildUnits(ctx: DivisionContext, pool: readonly Registration[]): Unit[] {
  const groups = siblingGroups(ctx);
  const inPool = new Set(pool.map((r) => r.id));
  const done = new Set<ID>();
  const units: Unit[] = [];
  const maxCap = Math.max(0, ...ctx.cap.values());

  for (const reg of pool) {
    if (done.has(reg.id)) continue;
    const group = groups.get(reg.id) ?? [reg.id];
    const members = group.filter((id) => inPool.has(id)).map((id) => ctx.index.registration.get(id)!);
    const siblingTeams = [
      ...new Set(group.map((id) => lockedTeamOf(ctx, id)).filter((t): t is ID => !!t && ctx.teamIds.has(t))),
    ].sort(compareStrings);
    const wantsTogether =
      ctx.settings.keepSiblingsTogether && group.length > 1 && !group.some((id) => ctx.index.registration.get(id)?.siblingsTogetherOptOut);
    for (const m of members) done.add(m.id);

    if (wantsTogether && members.length > 1) {
      const unit = makeUnit(ctx, members, siblingTeams, group);
      if (unit.options.length > 0 && unit.size <= maxCap) {
        units.push(unit);
        continue;
      }
      for (const m of members) units.push({ ...makeUnit(ctx, [m], siblingTeams, group), split: true });
      continue;
    }
    for (const m of members) {
      units.push({ ...makeUnit(ctx, [m], wantsTogether ? siblingTeams : [], group), split: false });
    }
  }
  return units.sort((a, b) => compareStrings(a.submittedAt, b.submittedAt) || compareStrings(a.key, b.key));
}

function makeUnit(ctx: DivisionContext, members: Registration[], siblingTeams: ID[], group: ID[]): Unit {
  const perMember = members.map((m) => optionsFor(ctx, m, siblingTeams));
  let options: TeamOption[];
  if (perMember.length === 1) options = perMember[0]!;
  else {
    const common = perMember[0]!.filter((o) => perMember.every((list) => list.some((x) => x.teamId === o.teamId)));
    options = common
      .map((o) => {
        const all = perMember.map((list) => list.find((x) => x.teamId === o.teamId)!);
        return {
          teamId: o.teamId,
          tier: Math.max(...all.map((x) => x.tier)),
          pos: all.reduce((s, x) => s + x.tier * 1000 + x.pos, 0) / all.length,
          fit: all.reduce((s, x) => s + x.fit, 0) / all.length,
        };
      })
      .sort((a, b) => a.tier - b.tier || a.pos - b.pos || compareStrings(a.teamId, b.teamId));
  }
  const priority = new Map<ID, PriorityResult>();
  for (const t of ctx.teams) {
    let best: PriorityResult | null = null;
    for (const m of members) {
      const p = priorityOn(ctx, m, t.id, siblingTeams);
      if (!best || p.points > best.points) best = p;
    }
    priority.set(t.id, best!);
  }
  const sorted = [...members].sort((a, b) => compareStrings(a.submittedAt, b.submittedAt) || compareStrings(a.id, b.id));
  return {
    key: sorted[0]!.id,
    regs: sorted,
    size: members.length,
    submittedAt: sorted[0]!.submittedAt,
    options,
    rankOf: new Map(options.map((o, i) => [o.teamId, i])),
    priority,
    siblingTeams,
    split: false,
    siblingGroup: group,
  };
}

/** Higher priority first; then earlier submission; then id. Negative = a before b. */
export function comparePriority(a: Unit, b: Unit, teamId: ID): number {
  return (
    b.priority.get(teamId)!.points - a.priority.get(teamId)!.points ||
    compareStrings(a.submittedAt, b.submittedAt) ||
    compareStrings(a.key, b.key)
  );
}
