/**
 * Pure helpers shared by the admin and coach pages: lookups, seniority,
 * request status, what a manual move breaks, round transitions and the
 * demand grid. Nothing here touches React or storage.
 */
import {
  compareStrings,
  fitsAvailability,
  fullName,
  gradeLabel,
  headCoach,
  windowsOverlap,
  type Division,
  type ID,
  type ISODate,
  type ISODateTime,
  type Placement,
  type PlacementRunResult,
  type PlacementState,
  type Player,
  type Registration,
  type SeasonIndex,
  type Team,
  type Weekday,
} from '@bvac/core';

// ---------------------------------------------------------------------------
// Basics
// ---------------------------------------------------------------------------

/** Current time as an ISO timestamp with BVAC's -06:00 offset. Event handlers only. */
export function nowCentral(): ISODateTime {
  return new Date(Date.now() - 6 * 3600_000).toISOString().slice(0, 19) + '-06:00';
}

/** End of a day in BVAC time, for the "As of" control. */
export function endOfDay(date: ISODate): ISODateTime {
  return `${date}T23:59:59-06:00`;
}

export function ordinal(n: number): string {
  const s = n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th';
  return `${n}${s}`;
}

/** "2nd grade", "Kindergarten", "Age 4": never confused with a choice rank. */
export function gradeText(grade: number): string {
  if (grade < 0) return gradeLabel(grade);
  if (grade === 0) return 'Kindergarten';
  return `${gradeLabel(grade)} grade`;
}

/** "Ava M." */
export function shortName(p: Pick<Player, 'firstName' | 'lastName' | 'nickname'>): string {
  return `${p.nickname ?? p.firstName} ${p.lastName.slice(0, 1)}.`;
}

export function playerOf(index: SeasonIndex, registrationId: ID): Player | undefined {
  const reg = index.registration.get(registrationId);
  return reg ? index.player.get(reg.playerId) : undefined;
}

export function divisionByCode(index: SeasonIndex, code: string | null | undefined): Division | undefined {
  if (!code) return undefined;
  const lower = code.toLowerCase();
  return index.data.divisions.find((d) => d.code.toLowerCase() === lower || d.id === code);
}

export function sortedDivisions(index: SeasonIndex): Division[] {
  return [...index.data.divisions].sort((a, b) => a.sortOrder - b.sortOrder || compareStrings(a.id, b.id));
}

/** Teams in a division families can be placed on, by label. */
export function activeTeams(index: SeasonIndex, divisionId: ID): Team[] {
  return (index.teamsByDivision.get(divisionId) ?? [])
    .filter((t) => t.status !== 'cancelled')
    .sort((a, b) => compareStrings(a.label, b.label) || compareStrings(a.id, b.id));
}

/** Active registrations in a division submitted by `asOf` (all when null). */
export function registrationsAsOf(index: SeasonIndex, divisionId: ID, asOf: ISODateTime | null): Registration[] {
  return (index.registrationsByDivision.get(divisionId) ?? []).filter((r) => !asOf || r.submittedAt <= asOf);
}

export function coachName(index: SeasonIndex, teamId: ID): string {
  const p = headCoach(index, teamId);
  return p ? fullName(p) : 'No coach yet';
}

export function teamPractice(index: SeasonIndex, team: Team) {
  const slot = index.practiceSlot.get(team.practiceSlotId);
  const field = slot ? index.field.get(slot.fieldId) : undefined;
  return { slot, field };
}

// ---------------------------------------------------------------------------
// Seniority and requests
// ---------------------------------------------------------------------------

export interface Seniority {
  seasons: number;
  playedLastSeason: boolean;
  /** Seasons with this team's head coach. */
  seasonsWithCoach: number;
  /** Last season's coach is this team's head coach. */
  returningWithCoach: boolean;
}

export function seniority(index: SeasonIndex, playerId: ID, teamId: ID | null): Seniority {
  const history = index.historyByPlayer.get(playerId) ?? [];
  const coachId = teamId ? index.coachesByTeam.get(teamId)?.find((c) => c.role === 'head')?.personId : undefined;
  const last = history.find((h) => h.seasonOrder === index.lastSeasonOrder);
  return {
    seasons: history.length,
    playedLastSeason: !!last,
    seasonsWithCoach: coachId ? history.filter((h) => h.coachPersonId === coachId).length : 0,
    returningWithCoach: !!coachId && last?.coachPersonId === coachId,
  };
}

/** Team-independent priority points, used to order the waitlist. */
export function generalPriority(index: SeasonIndex, reg: Registration): number {
  const settings = index.division.get(reg.divisionId)?.settings;
  if (!settings) return 0;
  const p = settings.priority;
  const s = seniority(index, reg.playerId, null);
  return (
    (reg.window === 'early' ? p.earlyWindow : 0) +
    (s.playedLastSeason ? p.playedLastSeason : 0) +
    Math.min(p.perPriorSeasonCap, p.perPriorSeason * s.seasons)
  );
}

/** Same-division siblings: same household, or a matched sibling request either way. */
export function siblingRegistrations(index: SeasonIndex, reg: Registration): Registration[] {
  const player = index.player.get(reg.playerId);
  const out = new Map<ID, Registration>();
  const add = (r: Registration | undefined) => {
    if (r && r.id !== reg.id && r.divisionId === reg.divisionId && r.status === 'active') out.set(r.id, r);
  };
  if (player) for (const sib of index.playersByHousehold.get(player.householdId) ?? []) add(index.registrationByPlayer.get(sib.id));
  for (const q of reg.requests) if (q.type === 'sibling' && q.targetPlayerId) add(index.registrationByPlayer.get(q.targetPlayerId));
  for (const other of index.registrationsByDivision.get(reg.divisionId) ?? []) {
    if (other.requests.some((q) => q.type === 'sibling' && q.targetPlayerId === reg.playerId)) add(other);
  }
  return [...out.values()].sort((a, b) => compareStrings(a.id, b.id));
}

export function matchedFriendIds(reg: Registration): ID[] {
  return reg.requests
    .filter((q) => q.type === 'friend' && q.targetPlayerId && (q.matchStatus === 'matched' || q.matchStatus === 'confirmed'))
    .map((q) => q.targetPlayerId!);
}

export type TeamOf = (registrationId: ID) => ID | null | undefined;

export interface RequestStatus {
  /** null when the kid has no request of that kind. */
  sibling: boolean | null;
  friend: { met: number; total: number } | null;
  coach: boolean | null;
  /** Typed names that didn't match a registered kid. */
  unmatched: number;
}

export function requestStatus(index: SeasonIndex, reg: Registration, teamId: ID | null, teamOf: TeamOf): RequestStatus {
  const sibs = siblingRegistrations(index, reg);
  const friends = matchedFriendIds(reg);
  const friendMet = friends.filter((pid) => {
    const r = index.registrationByPlayer.get(pid);
    return !!teamId && !!r && teamOf(r.id) === teamId;
  }).length;
  let coach: boolean | null = null;
  if (reg.coachRequest && (reg.coachRequest.coachPersonId || reg.coachRequest.sameAsLastSeason)) {
    const head = teamId ? index.coachesByTeam.get(teamId)?.find((c) => c.role === 'head')?.personId : undefined;
    const last = (index.historyByPlayer.get(reg.playerId) ?? []).find((h) => h.seasonOrder === index.lastSeasonOrder);
    const wanted = reg.coachRequest.coachPersonId ?? (reg.coachRequest.sameAsLastSeason ? last?.coachPersonId : undefined);
    coach = !!head && head === wanted;
  }
  return {
    sibling: sibs.length ? !!teamId && sibs.every((s) => teamOf(s.id) === teamId) : null,
    friend: friends.length ? { met: friendMet, total: friends.length } : null,
    coach,
    unmatched: reg.requests.filter((q) => q.matchStatus === 'unmatched' || q.matchStatus === 'ambiguous').length,
  };
}

// ---------------------------------------------------------------------------
// Placements
// ---------------------------------------------------------------------------

export function placementMap(result: PlacementRunResult | undefined): Map<ID, Placement> {
  return new Map((result?.placements ?? []).map((p) => [p.registrationId, p]));
}

export function teamOfFrom(map: Map<ID, Placement>): TeamOf {
  return (id) => map.get(id)?.teamId;
}

/** Plain words for flag severities (the engine's critical / warning / info). */
export const SEVERITY_LABEL = { critical: 'Urgent', warning: 'Check', info: 'Note' } as const;

export const STATE_LABEL: Record<PlacementState, string> = {
  projected: 'Projected',
  proposed: 'Waiting for coach',
  approved: 'Approved',
  published: 'Published',
  waitlisted: 'Waitlist',
};

/** What a manual move does to this kid's requests and choices. */
export function moveImpact(
  index: SeasonIndex,
  reg: Registration,
  fromTeamId: ID | null,
  toTeamId: ID | null,
  teamOf: TeamOf,
  teamSizeAfter: number,
): { breaks: string[]; gains: string[] } {
  const breaks: string[] = [];
  const gains: string[] = [];
  if (fromTeamId === toTeamId) return { breaks, gains };
  const rankOf = (t: ID | null) => (t ? (reg.choices.find((c) => c.teamId === t)?.rank ?? null) : null);
  const before = rankOf(fromTeamId);
  const after = rankOf(toTeamId);
  if (!toTeamId) breaks.push('moved to the waitlist');
  else if (after === null) breaks.push(before ? `not a ranked choice (was ${ordinal(before)})` : 'not a ranked choice');
  else if (before === null || after < before) gains.push(`now ${ordinal(after)} choice`);
  else if (after > before) breaks.push(`now ${ordinal(after)} choice`);

  const nameOf = (pid: ID) => {
    const p = index.player.get(pid);
    return p ? shortName(p) : 'a friend';
  };
  for (const pid of matchedFriendIds(reg)) {
    const r = index.registrationByPlayer.get(pid);
    if (!r) continue;
    const t = teamOf(r.id);
    const was = !!fromTeamId && t === fromTeamId;
    const now = !!toTeamId && t === toTeamId;
    if (was && !now) breaks.push(`friend request lost (${nameOf(pid)})`);
    if (!was && now) gains.push(`friend request met (${nameOf(pid)})`);
  }
  // Other kids who asked for this one.
  for (const other of index.registrationsByDivision.get(reg.divisionId) ?? []) {
    if (other.id === reg.id || !matchedFriendIds(other).includes(reg.playerId)) continue;
    const t = teamOf(other.id);
    if (!t) continue;
    if (t === fromTeamId && t !== toTeamId) breaks.push(`${nameOf(other.playerId)}'s friend request lost`);
    if (t === toTeamId && t !== fromTeamId) gains.push(`${nameOf(other.playerId)}'s friend request met`);
  }
  for (const sib of siblingRegistrations(index, reg)) {
    const t = teamOf(sib.id);
    if (t && t === fromTeamId && t !== toTeamId) breaks.push(`sibling split up (${nameOf(sib.playerId)})`);
    if (t && t === toTeamId && t !== fromTeamId) gains.push(`with sibling (${nameOf(sib.playerId)})`);
  }
  const status = (t: ID | null) => requestStatus(index, reg, t, teamOf).coach;
  if (status(fromTeamId) === true && status(toTeamId) === false) breaks.push('coach request lost');
  if (status(fromTeamId) === false && status(toTeamId) === true) gains.push('coach request met');

  if (toTeamId) {
    const team = index.team.get(toTeamId);
    const slot = team ? index.practiceSlot.get(team.practiceSlotId) : undefined;
    if (slot && reg.availability.length && !fitsAvailability(slot.window, reg.availability)) {
      breaks.push(reg.availabilityRequired ? "outside the family's required days" : "outside the family's preferred days");
    }
    const max = index.division.get(reg.divisionId)?.settings.teamSize.max ?? Infinity;
    if (team && teamSizeAfter > max) breaks.push(`${team.label} over max (${teamSizeAfter}/${max})`);
  }
  return { breaks, gains };
}

/** A fixed placement for a manual move: locked, projected (or waitlisted). */
export function manualPlacement(reg: Registration, prev: Placement | undefined, toTeamId: ID | null): Placement {
  return {
    registrationId: reg.id,
    teamId: toTeamId,
    round: toTeamId ? (prev?.round ?? 2) : null,
    state: toTeamId ? 'projected' : 'waitlisted',
    locked: true,
    choiceRankMet: toTeamId ? (reg.choices.find((c) => c.teamId === toTeamId)?.rank ?? null) : null,
    reasons: [{ code: 'adminLocked', text: toTeamId ? 'Moved here by an admin' : 'Moved to the waitlist by an admin' }],
  };
}

// ---------------------------------------------------------------------------
// Rounds
// ---------------------------------------------------------------------------

export function inDivision(index: SeasonIndex, divisionId: ID) {
  return (p: Placement) => index.registration.get(p.registrationId)?.divisionId === divisionId;
}

export interface RoundStatus {
  /** The round to send or publish next; 'done' after round 2 publishes. */
  current: 1 | 2 | 'done';
  proposed: number;
  approved: number;
  published: number;
  pinned: number;
  canUndo: boolean;
  /** Placements of the current round already sent to coaches (waiting or approved). */
  sent: number;
  /** Published placements from the most recent published round. */
  lastPublished: number;
}

export function roundStatus(index: SeasonIndex, fixed: Placement[], divisionId: ID, snapshots: Placement[][] | undefined): RoundStatus {
  const own = fixed.filter(inDivision(index, divisionId));
  const published = own.filter((p) => p.state === 'published');
  const current = published.some((p) => p.round === 2) ? 'done' : published.some((p) => p.round === 1) ? 2 : 1;
  return {
    current,
    proposed: own.filter((p) => p.state === 'proposed').length,
    approved: own.filter((p) => p.state === 'approved').length,
    published: published.length,
    pinned: own.filter((p) => p.locked && p.state !== 'published').length,
    canUndo: (snapshots?.length ?? 0) > 0,
    sent: current === 'done' ? 0 : own.filter((p) => p.round === current && (p.state === 'proposed' || p.state === 'approved')).length,
    lastPublished: published.filter((p) => p.round === (current === 'done' ? 2 : 1)).length,
  };
}

/**
 * "Send round N to coaches": the round's unlocked engine placements become
 * fixed `proposed` placements, so re-runs no longer move them.
 */
export function sendRound(index: SeasonIndex, fixed: Placement[], divisionId: ID, round: 1 | 2, run: PlacementRunResult): Placement[] {
  const fixedIds = new Set(fixed.map((p) => p.registrationId));
  const proposals = run.placements
    .filter((p) => p.teamId && !p.locked && !fixedIds.has(p.registrationId) && inDivision(index, divisionId)(p))
    .map((p): Placement => ({ ...p, round, state: 'proposed' }));
  return [...fixed, ...proposals];
}

/** Approve proposed placements in a division, or on one team. */
export function approve(index: SeasonIndex, fixed: Placement[], scope: { divisionId: ID } | { teamId: ID }): Placement[] {
  const match = 'teamId' in scope ? (p: Placement) => p.teamId === scope.teamId : inDivision(index, scope.divisionId);
  return fixed.map((p) => (p.state === 'proposed' && match(p) ? { ...p, state: 'approved' } : p));
}

/**
 * "Publish round N": every placed kid in the round (proposed, approved,
 * pinned, coach picks, and anything not yet sent) becomes `published`.
 */
export function publishRound(index: SeasonIndex, fixed: Placement[], divisionId: ID, round: 1 | 2, run: PlacementRunResult): Placement[] {
  const byId = new Map(fixed.map((p) => [p.registrationId, p]));
  for (const p of run.placements) {
    if (!p.teamId || !inDivision(index, divisionId)(p)) continue;
    const current = byId.get(p.registrationId) ?? p;
    if (current.state === 'published' || !current.teamId) continue;
    byId.set(p.registrationId, { ...current, round, state: 'published' });
  }
  return [...byId.values()];
}

// ---------------------------------------------------------------------------
// Demand grid
// ---------------------------------------------------------------------------

export const GRID_DAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri'];

export interface DemandCell {
  day: Weekday;
  start: number;
  end: number;
  /** Families (households) with a kid available for this whole half hour. */
  families: number;
  /** Team options practicing during any of it. */
  teams: number;
}

/** Half-hour bands from 5pm to 8pm, Mon–Fri. */
export function demandGrid(index: SeasonIndex, divisionIds: ID[], asOf: ISODateTime | null): { bands: [number, number][]; cells: DemandCell[] } {
  const bands: [number, number][] = [];
  for (let t = 17 * 60; t < 20 * 60; t += 30) bands.push([t, t + 30]);
  const regs = divisionIds.flatMap((d) => registrationsAsOf(index, d, asOf));
  const teams = divisionIds.flatMap((d) => activeTeams(index, d));
  const cells: DemandCell[] = [];
  for (const [start, end] of bands) {
    for (const day of GRID_DAYS) {
      const w = { day, start, end };
      const households = new Set<ID>();
      for (const r of regs) {
        if (r.availability.some((a) => a.day === day && a.start <= start && a.end >= end)) {
          households.add(index.player.get(r.playerId)?.householdId ?? r.id);
        }
      }
      const teamCount = teams.filter((t) => {
        const slot = index.practiceSlot.get(t.practiceSlotId);
        return slot ? windowsOverlap(slot.window, w) : false;
      }).length;
      cells.push({ day, start, end, families: households.size, teams: teamCount });
    }
  }
  return { bands, cells };
}

/** Days from `start` to `end` inclusive. */
export function dateRange(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  const stop = new Date(`${end}T00:00:00Z`);
  while (d <= stop) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
