import type {
  CoachAssignment,
  Division,
  Field,
  GameTrack,
  Household,
  ID,
  Person,
  Player,
  PlayerHistory,
  PracticeSlot,
  Registration,
  SeasonData,
  Team,
  TimeWindow,
} from './types';

/** Lookup maps over a SeasonData bundle. Build once per render or engine run. */
export interface SeasonIndex {
  data: SeasonData;
  division: Map<ID, Division>;
  field: Map<ID, Field>;
  practiceSlot: Map<ID, PracticeSlot>;
  gameTrack: Map<ID, GameTrack>;
  team: Map<ID, Team>;
  person: Map<ID, Person>;
  household: Map<ID, Household>;
  player: Map<ID, Player>;
  registration: Map<ID, Registration>;
  registrationByPlayer: Map<ID, Registration>;
  teamsByDivision: Map<ID, Team[]>;
  registrationsByDivision: Map<ID, Registration[]>;
  playersByHousehold: Map<ID, Player[]>;
  historyByPlayer: Map<ID, PlayerHistory[]>;
  coachesByTeam: Map<ID, CoachAssignment[]>;
  /** Teams a person coaches (head or assistant). */
  teamsByCoach: Map<ID, ID[]>;
  /** Highest seasonOrder present in history: "last season". */
  lastSeasonOrder: number;
}

function byId<T extends { id: ID }>(items: readonly T[]): Map<ID, T> {
  return new Map(items.map((x) => [x.id, x]));
}

function groupBy<T>(items: readonly T[], key: (x: T) => ID): Map<ID, T[]> {
  const out = new Map<ID, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = out.get(k);
    if (list) list.push(item);
    else out.set(k, [item]);
  }
  return out;
}

export function indexSeason(data: SeasonData): SeasonIndex {
  const teamsByCoach = new Map<ID, ID[]>();
  for (const ca of data.coachAssignments) {
    const list = teamsByCoach.get(ca.personId) ?? [];
    list.push(ca.teamId);
    teamsByCoach.set(ca.personId, list);
  }
  const historyByPlayer = groupBy(data.playerHistory, (h) => h.playerId);
  for (const list of historyByPlayer.values()) list.sort((a, b) => b.seasonOrder - a.seasonOrder);
  return {
    data,
    division: byId(data.divisions),
    field: byId(data.fields),
    practiceSlot: byId(data.practiceSlots),
    gameTrack: byId(data.gameTracks),
    team: byId(data.teams),
    person: byId(data.people),
    household: byId(data.households),
    player: byId(data.players),
    registration: byId(data.registrations),
    registrationByPlayer: new Map(data.registrations.filter((r) => r.status === 'active').map((r) => [r.playerId, r])),
    teamsByDivision: groupBy(data.teams, (t) => t.divisionId),
    registrationsByDivision: groupBy(
      data.registrations.filter((r) => r.status === 'active'),
      (r) => r.divisionId,
    ),
    playersByHousehold: groupBy(data.players, (p) => p.householdId),
    historyByPlayer,
    coachesByTeam: groupBy(data.coachAssignments, (c) => c.teamId),
    teamsByCoach,
    lastSeasonOrder: data.playerHistory.reduce((max, h) => Math.max(max, h.seasonOrder), 0),
  };
}

export function teamPracticeWindow(index: SeasonIndex, team: Team): TimeWindow {
  const slot = index.practiceSlot.get(team.practiceSlotId);
  if (!slot) throw new Error(`Team ${team.id} has unknown practice slot ${team.practiceSlotId}`);
  return slot.window;
}

export function headCoach(index: SeasonIndex, teamId: ID): Person | undefined {
  const head = index.coachesByTeam.get(teamId)?.find((c) => c.role === 'head');
  return head ? index.person.get(head.personId) : undefined;
}

export function fullName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`;
}

/** Referential-integrity problems in a bundle; empty means valid. */
export function validateSeasonData(data: SeasonData): string[] {
  const problems: string[] = [];
  const ids = {
    division: new Set(data.divisions.map((d) => d.id)),
    field: new Set(data.fields.map((f) => f.id)),
    slot: new Set(data.practiceSlots.map((s) => s.id)),
    track: new Set(data.gameTracks.map((t) => t.id)),
    team: new Set(data.teams.map((t) => t.id)),
    person: new Set(data.people.map((p) => p.id)),
    household: new Set(data.households.map((h) => h.id)),
    player: new Set(data.players.map((p) => p.id)),
    gameSlot: new Set(data.gameSlots.map((g) => g.id)),
  };
  const need = (ok: boolean, msg: string) => {
    if (!ok) problems.push(msg);
  };
  const all = [
    ...data.divisions,
    ...data.fields,
    ...data.practiceSlots,
    ...data.gameSlots,
    ...data.gameTracks,
    ...data.games,
    ...data.teams,
    ...data.people,
    ...data.coachAssignments,
    ...data.households,
    ...data.players,
    ...data.registrations,
  ];
  const seen = new Set<string>();
  for (const x of all) {
    need(!seen.has(x.id), `duplicate id ${x.id}`);
    seen.add(x.id);
  }
  for (const s of data.practiceSlots) {
    need(ids.division.has(s.divisionId), `slot ${s.id}: unknown division`);
    need(ids.field.has(s.fieldId), `slot ${s.id}: unknown field`);
    need(s.window.start < s.window.end, `slot ${s.id}: window ends before it starts`);
  }
  for (const g of data.gameSlots) need(ids.field.has(g.fieldId), `game slot ${g.id}: unknown field`);
  for (const g of data.games) {
    need(ids.gameSlot.has(g.gameSlotId), `game ${g.id}: unknown game slot`);
    need(ids.track.has(g.homeTrackId) && ids.track.has(g.awayTrackId), `game ${g.id}: unknown track`);
  }
  for (const t of data.teams) {
    need(ids.division.has(t.divisionId), `team ${t.id}: unknown division`);
    need(ids.slot.has(t.practiceSlotId), `team ${t.id}: unknown practice slot`);
    if (t.gameTrackId) need(ids.track.has(t.gameTrackId), `team ${t.id}: unknown game track`);
  }
  for (const c of data.coachAssignments) {
    need(ids.person.has(c.personId), `coach ${c.id}: unknown person`);
    need(ids.team.has(c.teamId), `coach ${c.id}: unknown team`);
    for (const p of c.protectedPlayerIds) need(ids.player.has(p), `coach ${c.id}: unknown protected player ${p}`);
  }
  for (const h of data.households) for (const g of h.guardianIds) need(ids.person.has(g), `household ${h.id}: unknown guardian`);
  for (const p of data.players) need(ids.household.has(p.householdId), `player ${p.id}: unknown household`);
  for (const h of data.playerHistory) need(ids.player.has(h.playerId), `history: unknown player ${h.playerId}`);
  for (const r of data.registrations) {
    need(ids.player.has(r.playerId), `registration ${r.id}: unknown player`);
    need(ids.division.has(r.divisionId), `registration ${r.id}: unknown division`);
    for (const c of r.choices) need(ids.team.has(c.teamId), `registration ${r.id}: unknown team choice ${c.teamId}`);
    for (const q of r.requests) if (q.targetPlayerId) need(ids.player.has(q.targetPlayerId), `registration ${r.id}: unknown request target`);
    if (r.coachRequest?.coachPersonId) need(ids.person.has(r.coachRequest.coachPersonId), `registration ${r.id}: unknown coach request`);
  }
  return problems;
}
