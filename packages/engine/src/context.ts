/**
 * Everything one engine run needs about a division, computed once.
 */
import {
  compareStrings,
  indexSeason,
  type Division,
  type DivisionSettings,
  type ID,
  type Placement,
  type PlacementRunInput,
  type Registration,
  type SeasonIndex,
  type Team,
  type TimeWindow,
} from '@bvac/core';

export interface DivisionContext {
  index: SeasonIndex;
  division: Division;
  settings: DivisionSettings;
  round: 1 | 2;
  teams: Team[];
  teamIds: Set<ID>;
  /** Seats the engine may fill per team in this round. */
  cap: Map<ID, number>;
  window: Map<ID, TimeWindow>;
  /** Head coach person id per team. */
  coachOf: Map<ID, ID | undefined>;
  /** Every active registration in scope (after asOf and round filters). */
  registrations: Registration[];
  /** Placed by deferred acceptance / the selected model. */
  mainPool: Registration[];
  /** Late-window registrations: leftover seats only, in submission order. */
  latePool: Registration[];
  /** Placements given in `fixed`, kept exactly. */
  fixed: Map<ID, Placement>;
  /** Coach protected picks (incl. coach's own kids): registration id -> team id. */
  protectedPicks: Map<ID, { teamId: ID; coachChild: boolean }>;
  /** Player's last-season coach, if any. */
  lastCoach: Map<ID, ID | undefined>;
  /** Number of earlier BVAC seasons per player. */
  priorSeasons: Map<ID, number>;
  /** Seasons a player played for a given coach: `${playerId}|${coachId}` -> count. */
  seasonsWithCoach: Map<string, number>;
  registrationByPlayer: Map<ID, Registration>;
}

export function buildContext(input: PlacementRunInput): DivisionContext {
  const index = indexSeason(input.data);
  const division = index.division.get(input.divisionId);
  if (!division) throw new Error(`Unknown division ${input.divisionId}`);
  const settings: DivisionSettings = { ...division.settings, ...input.settingsOverride };
  const round = input.round;

  const teams = (index.teamsByDivision.get(division.id) ?? [])
    .filter((t) => t.status !== 'cancelled')
    .sort((a, b) => compareStrings(a.label, b.label) || compareStrings(a.id, b.id));
  const teamIds = new Set(teams.map((t) => t.id));
  const roundCap = round === 1 && settings.round1Fill === 'preferred' ? settings.teamSize.preferred : settings.teamSize.max;
  const cap = new Map(teams.map((t) => [t.id, roundCap]));
  const window = new Map<ID, TimeWindow>();
  const coachOf = new Map<ID, ID | undefined>();
  for (const t of teams) {
    const slot = index.practiceSlot.get(t.practiceSlotId);
    if (!slot) throw new Error(`Team ${t.id} has unknown practice slot`);
    window.set(t.id, slot.window);
    coachOf.set(t.id, index.coachesByTeam.get(t.id)?.find((c) => c.role === 'head')?.personId);
  }

  const registrations = (index.registrationsByDivision.get(division.id) ?? [])
    .filter((r) => !input.asOf || r.submittedAt <= input.asOf)
    .filter((r) => round === 2 || r.window === 'early')
    .sort((a, b) => compareStrings(a.submittedAt, b.submittedAt) || compareStrings(a.id, b.id));
  const inScope = new Set(registrations.map((r) => r.id));
  const registrationByPlayer = new Map(registrations.map((r) => [r.playerId, r]));

  const fixed = new Map<ID, Placement>();
  for (const f of input.fixed) if (inScope.has(f.registrationId)) fixed.set(f.registrationId, f);

  const protectedPicks = new Map<ID, { teamId: ID; coachChild: boolean }>();
  for (const ca of input.data.coachAssignments) {
    if (!teamIds.has(ca.teamId)) continue;
    const coachHouseholds = new Set(input.data.households.filter((h) => h.guardianIds.includes(ca.personId)).map((h) => h.id));
    for (const playerId of ca.protectedPlayerIds) {
      const reg = registrationByPlayer.get(playerId);
      if (!reg || fixed.has(reg.id) || protectedPicks.has(reg.id)) continue;
      const player = index.player.get(playerId);
      protectedPicks.set(reg.id, { teamId: ca.teamId, coachChild: !!player && coachHouseholds.has(player.householdId) });
    }
  }

  const lastCoach = new Map<ID, ID | undefined>();
  const priorSeasons = new Map<ID, number>();
  const seasonsWithCoach = new Map<string, number>();
  for (const r of registrations) {
    const history = index.historyByPlayer.get(r.playerId) ?? [];
    priorSeasons.set(r.playerId, history.length);
    const last = history.find((h) => h.seasonOrder === index.lastSeasonOrder);
    lastCoach.set(r.playerId, last?.coachPersonId);
    for (const h of history) {
      if (!h.coachPersonId) continue;
      const key = `${r.playerId}|${h.coachPersonId}`;
      seasonsWithCoach.set(key, (seasonsWithCoach.get(key) ?? 0) + 1);
    }
  }

  const locked = (r: Registration) => fixed.has(r.id) || protectedPicks.has(r.id);
  const mainPool = registrations.filter((r) => !locked(r) && r.window !== 'late');
  const latePool = registrations.filter((r) => !locked(r) && r.window === 'late');

  return {
    index,
    division,
    settings,
    round,
    teams,
    teamIds,
    cap,
    window,
    coachOf,
    registrations,
    mainPool,
    latePool,
    fixed,
    protectedPicks,
    lastCoach,
    priorSeasons,
    seasonsWithCoach,
    registrationByPlayer,
  };
}

/** "Coach Reyes" */
export function coachLabel(ctx: DivisionContext, teamId: ID): string {
  const id = ctx.coachOf.get(teamId);
  const person = id ? ctx.index.person.get(id) : undefined;
  return person ? `Coach ${person.lastName}` : 'the coach';
}

export function ordinal(n: number): string {
  const s = n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th';
  return `${n}${s}`;
}
