/**
 * Game schedule builder (docs/DESIGN.md "Game schedule builder").
 *
 * The schedule is built for schedule positions (game tracks), not teams, so
 * it can exist before registration opens. Once coaches claim a team option,
 * the team's head coach constraints are applied to that team's track.
 *
 * How it works:
 * 1. Matchups: a circle-method round robin over the active tracks, one round
 *    per game date, repeated as the dates allow. Rounds are picked greedily
 *    per date so pairs that have met least play first (this also continues an
 *    existing schedule correctly after `fromDate`). With an odd count, the
 *    round whose bye lands on a coach's blackout date is preferred.
 * 2. Slots: each date's games are assigned to that date's game slots with a
 *    min-cost assignment, then improved by local search (swap two games'
 *    slots, or move a game to a free slot) over a whole-season cost:
 *    - hard-ish: unscheduled games, coach `gamesNotBefore`/`gamesNotAfter`,
 *      a coach with overlapping games;
 *    - style: `rotating` evens out each time across tracks and mixes times
 *      within a track; `anchored` keeps each track at its home time;
 *    - soft: siblings on other teams play at the same or back-to-back times;
 *    - stability: when rebuilding from a date, keep games where they were.
 * 3. Flags for anything left over, and a plain-words description per track.
 */
import {
  compareStrings,
  formatDate,
  formatTime,
  fullName,
  indexSeason,
  type BuildSchedule,
  type CoachAvailability,
  type Division,
  type Flag,
  type Game,
  type GameSlot,
  type GameTimeStyle,
  type GameTrack,
  type ID,
  type ISODate,
  type Minutes,
  type Person,
  type Placement,
  type ScheduleBuildInput,
  type ScheduleBuildResult,
  type SeasonData,
  type SeasonIndex,
  type Team,
} from '@bvac/core';
import { minCostAssignment } from './assignment';
import { circleRounds, type RoundRobinRound } from './round-robin';

/**
 * `ScheduleBuildInput` plus optional extras. Every extra is optional, so this
 * function still satisfies the `BuildSchedule` contract.
 */
export interface ScheduleBuildOptions extends ScheduleBuildInput {
  /**
   * Current placements (any division). Used only for the soft siblings rule:
   * siblings on teams in other divisions get the same or back-to-back times.
   * Without placements, no sibling links are known.
   */
  placements?: readonly Placement[];
}

// Cost weights. Hard-ish constraints are orders of magnitude above style.
const W = {
  unscheduled: 100_000,
  coachOverlap: 2_000,
  coachWindow: 1_000,
  sibling: 3,
  stability: 6,
  // rotating
  across: 10,
  mix: 2,
  // anchored
  off: 8,
  offSquared: 3,
  distancePerHour: 1,
} as const;
const EPS = 1e-9;
const MAX_PASSES = 200;
/** Gap that still counts as "back-to-back" for siblings. */
const BACK_TO_BACK_MIN = 20;

/** Description for a track that has no games in the current schedule. */
export const UNSCHEDULED_TRACK_DESCRIPTION = 'Not in the current schedule';
export const TBA_TRACK_DESCRIPTION = 'Game times to be announced';

interface Interval {
  start: Minutes;
  end: Minutes;
}

interface TrackInfo {
  track: GameTrack;
  team?: Team;
  /** "Option C (Team 3)" or "Team 3". */
  label: string;
  head?: Person;
  avail?: CoachAvailability;
  coachIds: ID[];
}

interface SlotInfo {
  slot: GameSlot;
  t: number;
  start: Minutes;
  end: Minutes;
}

interface PlannedGame {
  home: number;
  away: number;
  /** Existing game for the same pair on the same date (rebuilds). */
  existing?: Game;
}

interface DatePlan {
  date: ISODate;
  week: number;
  slots: SlotInfo[];
  games: PlannedGame[];
  /** Slot index per game, -1 when unscheduled. */
  assign: number[];
}

interface OtherLink {
  /** Per date, busy intervals of the linked team or person. */
  byDate: Map<ISODate, Interval[]>;
  label: string;
}

const pairKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
const trackPairKey = (a: ID, b: ID) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;
const shortDate = (date: ISODate) => formatDate(date).replace(/^\w+ /, '');

function listWords(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** 0 = same start, small = back-to-back, larger = farther apart or clashing. */
function householdCost(a: Interval, b: Interval): number {
  if (a.start === b.start) return 0;
  const gap = Math.max(a.start, b.start) - Math.min(a.end, b.end);
  if (gap < 0) return 2; // overlapping but not together: the worst case for one parent
  if (gap <= BACK_TO_BACK_MIN) return 0.25;
  return Math.min(3, 1 + gap / 60);
}

function windowViolation(avail: CoachAvailability | undefined, start: Minutes): 'before' | 'after' | null {
  if (!avail) return null;
  if (avail.gamesNotBefore !== undefined && start < avail.gamesNotBefore) return 'before';
  if (avail.gamesNotAfter !== undefined && start > avail.gamesNotAfter) return 'after';
  return null;
}

function slotsByDate(data: SeasonData, divisionId: ID): Map<ISODate, GameSlot[]> {
  const out = new Map<ISODate, GameSlot[]>();
  for (const s of data.gameSlots) {
    if (s.divisionId !== divisionId || s.isMakeup) continue;
    const list = out.get(s.date) ?? [];
    list.push(s);
    out.set(s.date, list);
  }
  for (const list of out.values()) {
    list.sort((a, b) => a.start - b.start || compareStrings(a.fieldId, b.fieldId) || compareStrings(a.id, b.id));
  }
  return out;
}

/** Choose which tracks are scheduled: claimed ones first, then by position. */
function selectTracks(
  data: SeasonData,
  division: Division,
  claimed: Map<ID, Team>,
  positions: number | undefined,
): { all: GameTrack[]; active: GameTrack[] } {
  const own = data.gameTracks
    .filter((t) => t.divisionId === division.id)
    .sort((a, b) => a.position - b.position || compareStrings(a.id, b.id));
  if (positions === undefined) return { all: own, active: own };
  const want = Math.max(0, Math.floor(positions));
  const ranked = [...own].sort(
    (a, b) => Number(claimed.has(b.id)) - Number(claimed.has(a.id)) || a.position - b.position || compareStrings(a.id, b.id),
  );
  const active = ranked.slice(0, want);
  const all = [...own];
  const ids = new Set(data.gameTracks.map((t) => t.id));
  let position = own.reduce((max, t) => Math.max(max, t.position), 0);
  while (active.length < want) {
    position++;
    let id = `track_${division.code.toLowerCase()}_${position}`;
    for (let n = 2; ids.has(id); n++) id = `track_${division.code.toLowerCase()}_${position}_${n}`;
    ids.add(id);
    const track: GameTrack = { id, divisionId: division.id, position, description: '' };
    active.push(track);
    all.push(track);
  }
  active.sort((a, b) => a.position - b.position || compareStrings(a.id, b.id));
  return { all, active };
}

/** Team that holds each game track (cancelled teams don't count). */
function claimedTracks(data: SeasonData): Map<ID, Team> {
  const out = new Map<ID, Team>();
  const teams = data.teams.filter((t) => t.gameTrackId && t.status !== 'cancelled').sort((a, b) => compareStrings(a.id, b.id));
  for (const t of teams) if (!out.has(t.gameTrackId!)) out.set(t.gameTrackId!, t);
  return out;
}

export const buildSchedule = ((input: ScheduleBuildOptions): ScheduleBuildResult => {
  const { data, divisionId, style } = input;
  const index = indexSeason(data);
  const division = index.division.get(divisionId);
  if (!division) throw new Error(`Unknown division ${divisionId}`);
  const flags: Flag[] = [];
  const flag = (f: Omit<Flag, 'divisionId'>) => flags.push({ ...f, divisionId });

  const claimed = claimedTracks(data);
  const { all: allTracks, active } = selectTracks(data, division, claimed, input.positions);
  const K = active.length;
  const trackIndex = new Map(active.map((t, i) => [t.id, i]));
  const availByPerson = new Map(data.coachAvailability.map((a) => [a.personId, a]));
  const info: TrackInfo[] = active.map((track) => {
    const team = claimed.get(track.id);
    const coaches = team ? (index.coachesByTeam.get(team.id) ?? []) : [];
    const headAssignment = coaches.find((c) => c.role === 'head');
    const head = headAssignment ? index.person.get(headAssignment.personId) : undefined;
    const out: TrackInfo = {
      track,
      label: team ? `${team.label} (Team ${track.position})` : `Team ${track.position}`,
      coachIds: [...new Set(coaches.map((c) => c.personId))].sort(compareStrings),
    };
    if (team) out.team = team;
    if (head) out.head = head;
    const avail = head ? availByPerson.get(head.id) : undefined;
    if (avail) out.avail = avail;
    return out;
  });

  // ---------------------------------------------------------------------------
  // Dates, slots, kept games
  // ---------------------------------------------------------------------------
  const slotById = new Map(data.gameSlots.map((s) => [s.id, s]));
  const existing = (input.existingGames ?? data.games.filter((g) => g.divisionId === divisionId)).filter(
    (g) => g.divisionId === divisionId,
  );
  const fromDate = input.fromDate;
  const dateOf = (g: Game): ISODate | undefined => slotById.get(g.gameSlotId)?.date;
  const kept = fromDate ? existing.filter((g) => (dateOf(g) ?? '') < fromDate && dateOf(g) !== undefined) : [];
  const replaced = existing.filter((g) => !kept.includes(g));
  const existingByDatePair = new Map<string, Game>();
  for (const g of replaced) {
    const d = dateOf(g);
    if (d) existingByDatePair.set(`${d}#${trackPairKey(g.homeTrackId, g.awayTrackId)}`, g);
  }

  const gameDates = [...data.season.gameDates].sort(compareStrings);
  const divisionSlots = slotsByDate(data, divisionId);
  const rebuildDates = gameDates.filter((d) => !fromDate || d >= fromDate);
  for (const d of rebuildDates) {
    if (!(divisionSlots.get(d)?.length)) {
      flag({ code: 'scheduleConflict', severity: 'warning', message: `${division.name} has no game slots on ${formatDate(d)}, so no games are scheduled that day.` });
    }
  }

  // Distinct start times across rebuilt slots and kept games.
  const timeSet = new Set<Minutes>();
  for (const d of rebuildDates) for (const s of divisionSlots.get(d) ?? []) timeSet.add(s.start);
  for (const g of kept) {
    const s = slotById.get(g.gameSlotId);
    if (s) timeSet.add(s.start);
  }
  const times = [...timeSet].sort((a, b) => a - b);
  const tOf = new Map(times.map((m, i) => [m, i]));
  const T = times.length;

  // ---------------------------------------------------------------------------
  // Context: other divisions' games, coach links and sibling links
  // ---------------------------------------------------------------------------
  const teamByTrackAll = claimed;
  const otherBusyByTeam = new Map<ID, Map<ISODate, Interval[]>>();
  for (const g of data.games) {
    if (g.divisionId === divisionId) continue;
    const s = slotById.get(g.gameSlotId);
    if (!s) continue;
    for (const trackId of [g.homeTrackId, g.awayTrackId]) {
      const team = teamByTrackAll.get(trackId);
      if (!team) continue;
      const byDate = otherBusyByTeam.get(team.id) ?? new Map<ISODate, Interval[]>();
      const list = byDate.get(s.date) ?? [];
      list.push({ start: s.start, end: s.start + s.durationMin });
      byDate.set(s.date, list);
      otherBusyByTeam.set(team.id, byDate);
    }
  }
  const teamLabel = (team: Team) => {
    const div = index.division.get(team.divisionId);
    return div && div.id !== divisionId ? `${div.name} ${team.label}` : team.label;
  };

  // Coaches: same-division track pairs sharing a coach, and other-division busy times.
  const coachPairs: [number, number, ID][] = [];
  const coachOther: OtherLink[][] = info.map(() => []);
  for (let k = 0; k < K; k++) {
    for (const personId of info[k]!.coachIds) {
      for (const teamId of [...(index.teamsByCoach.get(personId) ?? [])].sort(compareStrings)) {
        const team = index.team.get(teamId);
        if (!team || team.status === 'cancelled' || team.id === info[k]!.team?.id) continue;
        const j = team.gameTrackId !== undefined ? trackIndex.get(team.gameTrackId) : undefined;
        if (team.divisionId === divisionId) {
          if (j !== undefined && j > k) coachPairs.push([k, j, personId]);
        } else {
          const busy = otherBusyByTeam.get(team.id);
          const person = index.person.get(personId);
          if (busy) coachOther[k]!.push({ byDate: busy, label: `${person ? fullName(person) : 'A coach'} also coaches ${teamLabel(team)}` });
        }
      }
    }
  }

  // Siblings: households with players on this division's teams and on other teams.
  const siblingPairs = new Map<string, [number, number]>();
  const siblingOther: OtherLink[][] = info.map(() => []);
  if (input.placements?.length) {
    const teamsByHousehold = new Map<ID, Set<ID>>();
    for (const p of input.placements) {
      if (!p.teamId) continue;
      const reg = index.registration.get(p.registrationId);
      const player = reg ? index.player.get(reg.playerId) : undefined;
      if (!player) continue;
      const set = teamsByHousehold.get(player.householdId) ?? new Set<ID>();
      set.add(p.teamId);
      teamsByHousehold.set(player.householdId, set);
    }
    const seenOther = new Set<string>();
    for (const teamIds of teamsByHousehold.values()) {
      if (teamIds.size < 2) continue;
      const teams = [...teamIds].map((id) => index.team.get(id)).filter((t): t is Team => !!t && t.status !== 'cancelled');
      for (const a of teams) {
        if (a.divisionId !== divisionId || a.gameTrackId === undefined) continue;
        const k = trackIndex.get(a.gameTrackId);
        if (k === undefined) continue;
        for (const b of teams) {
          if (b.id === a.id) continue;
          if (b.divisionId === divisionId) {
            const j = b.gameTrackId !== undefined ? trackIndex.get(b.gameTrackId) : undefined;
            if (j !== undefined && j !== k) siblingPairs.set(pairKey(k, j), [Math.min(k, j), Math.max(k, j)]);
          } else {
            const busy = otherBusyByTeam.get(b.id);
            const key = `${k}|${b.id}`;
            if (busy && !seenOther.has(key)) {
              seenOther.add(key);
              siblingOther[k]!.push({ byDate: busy, label: teamLabel(b) });
            }
          }
        }
      }
    }
  }
  const siblingPairList = [...siblingPairs.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (const list of siblingOther) list.sort((a, b) => compareStrings(a.label, b.label));

  // ---------------------------------------------------------------------------
  // Counts from kept games
  // ---------------------------------------------------------------------------
  const counts: number[][] = info.map(() => new Array<number>(T).fill(0));
  /** Home games minus away games so far. */
  const homeBalance = new Array<number>(K).fill(0);
  const meetings = new Map<string, number>();
  const lastBye = new Array<number>(K).fill(-Infinity);
  const byeCount = new Array<number>(K).fill(0);
  const keptPlaying = new Map<ISODate, Set<number>>();
  for (const g of kept) {
    const s = slotById.get(g.gameSlotId)!;
    const h = trackIndex.get(g.homeTrackId);
    const a = trackIndex.get(g.awayTrackId);
    const t = tOf.get(s.start)!;
    const playing = keptPlaying.get(s.date) ?? new Set<number>();
    for (const k of [h, a]) {
      if (k === undefined) continue;
      counts[k]![t]!++;
      playing.add(k);
    }
    keptPlaying.set(s.date, playing);
    if (h !== undefined) homeBalance[h]!++;
    if (a !== undefined) homeBalance[a]!--;
    if (h !== undefined && a !== undefined) meetings.set(pairKey(h, a), (meetings.get(pairKey(h, a)) ?? 0) + 1);
  }
  gameDates.forEach((d, di) => {
    const playing = keptPlaying.get(d);
    if (!playing || !fromDate || d >= fromDate) return;
    for (let k = 0; k < K; k++) {
      if (!playing.has(k)) {
        lastBye[k] = di;
        byeCount[k]!++;
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Time balance targets
  // ---------------------------------------------------------------------------
  const capacity = new Array<number>(T).fill(0);
  let datesWithSlots = 0;
  for (const d of rebuildDates) {
    const list = divisionSlots.get(d) ?? [];
    if (list.length) datesWithSlots++;
    for (const s of list) capacity[tOf.get(s.start)!]!++;
  }
  for (let t = 0; t < T; t++) capacity[t] = capacity[t]! / (datesWithSlots || 1);
  const capTotal = capacity.reduce((a, b) => a + b, 0) || 1;
  const mixShare = capacity.map((c) => c / capTotal);
  const home = anchoredHomeTimes(style, info, times, capacity, counts);

  // ---------------------------------------------------------------------------
  // Matchups per date
  // ---------------------------------------------------------------------------
  const rounds: RoundRobinRound[] = circleRounds(K);
  const blackout = (k: number, date: ISODate) => info[k]!.avail?.blackoutDates.includes(date) ?? false;
  const plans: DatePlan[] = [];
  for (const date of rebuildDates) {
    const slots = (divisionSlots.get(date) ?? []).map((slot): SlotInfo => ({ slot, t: tOf.get(slot.start)!, start: slot.start, end: slot.start + slot.durationMin }));
    const di = gameDates.indexOf(date);
    if (!slots.length || !rounds.length) continue;
    let best = 0;
    let bestScore = Infinity;
    rounds.forEach((round, r) => {
      let score = 0;
      for (const p of round.pairs) {
        score += 1000 * (meetings.get(pairKey(p.a, p.b)) ?? 0);
        if (existingByDatePair.has(`${date}#${trackPairKey(active[p.a]!.id, active[p.b]!.id)}`)) score -= 300;
        if (blackout(p.a, date)) score += 50;
        if (blackout(p.b, date)) score += 50;
        // Anchored: when rounds tie, play same-home-time pairs first (more home games).
        if (style === 'anchored' && home[p.a] === home[p.b]) score -= 5;
      }
      if (round.bye !== null) {
        const b = round.bye;
        const gap = di - lastBye[b]!;
        score += 30 * Math.max(0, K - gap) + 10 * byeCount[b]!;
        // Save a bye for a coming blackout date within this cycle.
        if (rebuildDates.some((d) => d > date && gameDates.indexOf(d) - di < rounds.length && blackout(b, d))) score += 40;
      }
      if (score < bestScore - EPS) {
        bestScore = score;
        best = r;
      }
    });
    const round = rounds[best]!;
    const games: PlannedGame[] = round.pairs.map((p) => {
      const ex = existingByDatePair.get(`${date}#${trackPairKey(active[p.a]!.id, active[p.b]!.id)}`);
      let home: number;
      let away: number;
      const ea = ex ? trackIndex.get(ex.homeTrackId) : undefined;
      if (ex && ea !== undefined) {
        home = ea;
        away = ea === p.a ? p.b : p.a;
      } else if (homeBalance[p.a]! !== homeBalance[p.b]!) {
        [home, away] = homeBalance[p.a]! < homeBalance[p.b]! ? [p.a, p.b] : [p.b, p.a];
      } else {
        [home, away] = (di + p.a + p.b) % 2 === 0 ? [p.a, p.b] : [p.b, p.a];
      }
      homeBalance[home]!++;
      homeBalance[away]!--;
      meetings.set(pairKey(p.a, p.b), (meetings.get(pairKey(p.a, p.b)) ?? 0) + 1);
      const g: PlannedGame = { home, away };
      if (ex) g.existing = ex;
      return g;
    });
    if (round.bye !== null) {
      lastBye[round.bye] = di;
      byeCount[round.bye]!++;
    }
    plans.push({ date, week: di + 1, slots, games, assign: new Array<number>(games.length).fill(-1) });
  }
  balanceHomeAway(plans, homeBalance);

  // ---------------------------------------------------------------------------
  // Costs
  // ---------------------------------------------------------------------------
  const styleCost = (): number => {
    let cost = 0;
    if (style === 'rotating') {
      for (let t = 0; t < T; t++) {
        let sum = 0;
        for (let k = 0; k < K; k++) sum += counts[k]![t]!;
        const mean = sum / (K || 1);
        for (let k = 0; k < K; k++) cost += W.across * (counts[k]![t]! - mean) ** 2;
      }
      for (let k = 0; k < K; k++) {
        const row = counts[k]!;
        const g = row.reduce((a, b) => a + b, 0);
        for (let t = 0; t < T; t++) cost += W.mix * (row[t]! - g * mixShare[t]!) ** 2;
      }
    } else {
      for (let k = 0; k < K; k++) {
        const row = counts[k]!;
        const h = home[k]!;
        let g = 0;
        let dist = 0;
        for (let t = 0; t < T; t++) {
          g += row[t]!;
          dist += row[t]! * Math.abs(times[t]! - times[h]!);
        }
        const off = g - row[h]!;
        cost += W.off * off + W.offSquared * off * off + (W.distancePerHour * dist) / 60;
      }
    }
    return cost;
  };

  /** Slot-dependent cost of one track playing in one slot, ignoring other games this date. */
  const unaryTrack = (k: number, s: SlotInfo, date: ISODate): number => {
    let cost = 0;
    if (windowViolation(info[k]!.avail, s.start)) cost += W.coachWindow;
    for (const link of coachOther[k]!) for (const iv of link.byDate.get(date) ?? []) if (overlaps(iv, s)) cost += W.coachOverlap;
    for (const link of siblingOther[k]!) {
      const ivs = link.byDate.get(date);
      if (ivs?.length) cost += W.sibling * Math.min(...ivs.map((iv) => householdCost(s, iv)));
    }
    return cost;
  };

  const dateCost = (p: DatePlan): number => {
    let cost = 0;
    const at: (SlotInfo | undefined)[] = new Array(K);
    const gameOf = new Array<number>(K).fill(-1);
    p.games.forEach((g, gi) => {
      const si = p.assign[gi]!;
      if (si < 0) {
        cost += W.unscheduled;
        return;
      }
      const s = p.slots[si]!;
      at[g.home] = s;
      at[g.away] = s;
      gameOf[g.home] = gi;
      gameOf[g.away] = gi;
      cost += unaryTrack(g.home, s, p.date) + unaryTrack(g.away, s, p.date);
      if (g.existing && g.existing.gameSlotId !== s.slot.id) cost += W.stability;
    });
    for (const [a, b] of coachPairs) {
      const sa = at[a];
      const sb = at[b];
      if (sa && sb && gameOf[a] !== gameOf[b] && overlaps(sa, sb)) cost += W.coachOverlap;
    }
    for (const [a, b] of siblingPairList) {
      const sa = at[a];
      const sb = at[b];
      if (sa && sb && gameOf[a] !== gameOf[b]) cost += W.sibling * householdCost(sa, sb);
    }
    return cost;
  };

  const addCounts = (p: DatePlan, gi: number, delta: 1 | -1) => {
    const si = p.assign[gi]!;
    if (si < 0) return;
    const t = p.slots[si]!.t;
    const g = p.games[gi]!;
    counts[g.home]![t]! += delta;
    counts[g.away]![t]! += delta;
  };

  // ---------------------------------------------------------------------------
  // Initial assignment, date by date
  // ---------------------------------------------------------------------------
  for (const p of plans) {
    const matrix = p.games.map((g) =>
      p.slots.map((s) => {
        let cost = unaryTrack(g.home, s, p.date) + unaryTrack(g.away, s, p.date);
        if (g.existing && g.existing.gameSlotId !== s.slot.id) cost += W.stability;
        for (const k of [g.home, g.away]) {
          if (style === 'rotating') cost += 5 * counts[k]![s.t]!;
          else if (s.t !== home[k]) cost += W.off + W.distancePerHour * (Math.abs(times[s.t]! - times[home[k]!]!) / 60);
        }
        return cost;
      }),
    );
    p.assign = minCostAssignment(matrix, W.unscheduled);
    p.games.forEach((_, gi) => addCounts(p, gi, 1));
  }

  // ---------------------------------------------------------------------------
  // Local search
  // ---------------------------------------------------------------------------
  const localSearch = () => {
    const dateCosts = plans.map(dateCost);
    let currentStyle = styleCost();
    let total = dateCosts.reduce((a, b) => a + b, 0) + currentStyle;
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      let improved = false;
      plans.forEach((p, pi) => {
        const n = p.games.length;
        const tryMove = (apply: () => void, revert: () => void, touched: number[]) => {
          for (const gi of touched) addCounts(p, gi, -1);
          apply();
          for (const gi of touched) addCounts(p, gi, 1);
          const dc = dateCost(p);
          const sc = styleCost();
          const next = total - dateCosts[pi]! + dc - currentStyle + sc;
          if (next < total - EPS) {
            total = next;
            dateCosts[pi] = dc;
            currentStyle = sc;
            improved = true;
            return;
          }
          for (const gi of touched) addCounts(p, gi, -1);
          revert();
          for (const gi of touched) addCounts(p, gi, 1);
        };
        // Swap the slots of two games.
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            const swap = () => {
              const x = p.assign[i]!;
              p.assign[i] = p.assign[j]!;
              p.assign[j] = x;
            };
            tryMove(swap, swap, [i, j]);
          }
        }
        // Move a game to a free slot.
        for (let i = 0; i < n; i++) {
          const used = new Set(p.assign);
          for (let s = 0; s < p.slots.length; s++) {
            if (used.has(s)) continue;
            const old = p.assign[i]!;
            tryMove(
              () => {
                p.assign[i] = s;
              },
              () => {
                p.assign[i] = old;
              },
              [i],
            );
            if (p.assign[i] !== old) {
              used.delete(old);
              used.add(s);
            }
          }
        }
      });
      if (!improved) break;
    }
  };
  localSearch();
  // Anchored: a track whose games settled at another time gets that as its
  // home time, then the search runs again from there.
  if (style === 'anchored') {
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (let k = 0; k < K; k++) {
        const row = counts[k]!;
        let best = home[k]!;
        for (let t = 0; t < T; t++) if (row[t]! > row[best]!) best = t;
        if (best !== home[k]) {
          home[k] = best;
          moved = true;
        }
      }
      if (!moved) break;
      localSearch();
    }
  }

  // ---------------------------------------------------------------------------
  // Output games
  // ---------------------------------------------------------------------------
  const prefix = `game_${division.code.toLowerCase()}`;
  const usedIds = new Set<ID>(kept.map((g) => g.id));
  const reusedIds = new Set<ID>();
  const games: Game[] = [...kept];
  const changed: ID[] = [];
  const pending: { p: DatePlan; g: PlannedGame; s: SlotInfo; reuse: boolean }[] = [];
  for (const p of plans) {
    p.games.forEach((g, gi) => {
      const si = p.assign[gi]!;
      if (si < 0) return;
      const reuse = !!g.existing && !usedIds.has(g.existing.id);
      if (reuse) {
        reusedIds.add(g.existing!.id);
        usedIds.add(g.existing!.id);
      }
      pending.push({ p, g, s: p.slots[si]!, reuse });
    });
  }
  for (const { p, g, s, reuse } of pending) {
    let id: ID;
    const ex = reuse ? g.existing : undefined;
    if (ex) id = ex.id;
    else {
      let n = 1;
      do id = `${prefix}_${p.date.replaceAll('-', '')}_${n++}`;
      while (usedIds.has(id));
      usedIds.add(id);
    }
    const game: Game = {
      id,
      divisionId,
      gameSlotId: s.slot.id,
      round: p.week,
      homeTrackId: active[g.home]!.id,
      awayTrackId: active[g.away]!.id,
    };
    if (!ex || ex.gameSlotId !== game.gameSlotId || ex.homeTrackId !== game.homeTrackId || ex.round !== game.round) changed.push(id);
    games.push(game);
  }
  for (const g of replaced) if (!reusedIds.has(g.id)) changed.push(g.id);

  const slotOf = (g: Game) => slotById.get(g.gameSlotId);
  games.sort((a, b) => {
    const sa = slotOf(a);
    const sb = slotOf(b);
    return (
      compareStrings(sa?.date ?? '', sb?.date ?? '') ||
      (sa?.start ?? 0) - (sb?.start ?? 0) ||
      compareStrings(sa?.fieldId ?? '', sb?.fieldId ?? '') ||
      compareStrings(a.id, b.id)
    );
  });

  // ---------------------------------------------------------------------------
  // Flags
  // ---------------------------------------------------------------------------
  collectFlags({ flag, info, plans, coachPairs, coachOther, siblingPairList, siblingOther, active, meetings, index });

  // ---------------------------------------------------------------------------
  // Track descriptions
  // ---------------------------------------------------------------------------
  const scheduledDates = gameDates.filter((d) => plans.some((p) => p.date === d) || kept.some((g) => dateOf(g) === d));
  const tracks = allTracks.map((track): GameTrack => {
    const k = trackIndex.get(track.id);
    if (k === undefined) return { ...track, description: UNSCHEDULED_TRACK_DESCRIPTION };
    const own = games.filter((g) => g.homeTrackId === track.id || g.awayTrackId === track.id);
    if (!own.length) return { ...track, description: TBA_TRACK_DESCRIPTION };
    const starts = own.map((g) => slotOf(g)?.start).filter((m): m is number => m !== undefined);
    const played = new Set(own.map((g) => slotOf(g)?.date));
    const byes = scheduledDates.filter((d) => !played.has(d));
    return { ...track, description: describeTrack(style, starts, byes, home[k] !== undefined ? times[home[k]!] : undefined) };
  });

  return {
    divisionId,
    games,
    tracks,
    flags,
    changedGameIds: [...new Set(changed)].sort(compareStrings),
  };
}) satisfies BuildSchedule;

/**
 * Even out home and away: while a track is 2+ games off balance, flip a chain
 * of new games (home -> away -> ...) that ends at a track with room. A
 * balanced orientation always exists (Euler), so this ends with every track
 * within one game, unless kept games from before `fromDate` prevent it.
 */
function balanceHomeAway(plans: DatePlan[], balance: number[]): void {
  const edges = plans.flatMap((p) => p.games);
  for (let iter = 0; iter < 10 * edges.length + 10; iter++) {
    const x = balance.findIndex((b) => Math.abs(b) >= 2);
    if (x < 0) return;
    const sign = balance[x]! > 0 ? 1 : -1;
    // Walk edges where the current track is home (or away, for sign -1).
    const from = (g: PlannedGame) => (sign > 0 ? g.home : g.away);
    const to = (g: PlannedGame) => (sign > 0 ? g.away : g.home);
    const via = new Map<number, PlannedGame>();
    const queue = [x];
    const seen = new Set([x]);
    let end = -1;
    while (queue.length && end < 0) {
      const v = queue.shift()!;
      for (const g of edges) {
        if (from(g) !== v || seen.has(to(g))) continue;
        const w = to(g);
        seen.add(w);
        via.set(w, g);
        if (sign * balance[w]! <= -1) {
          end = w;
          break;
        }
        queue.push(w);
      }
    }
    if (end < 0) return;
    for (let v = end; v !== x; ) {
      const g = via.get(v)!;
      const prev = from(g);
      [g.home, g.away] = [g.away, g.home];
      v = prev;
    }
    balance[x] = balance[x]! - 2 * sign;
    balance[end] = balance[end]! + 2 * sign;
  }
}

/**
 * Anchored style: give each track a home time. Uses the fewest well-supplied
 * times that still fit a week's games (at least 2 times when there are 2), so
 * same-time groups are as large as possible (more home games), then matches
 * tracks to home times so coaches' game-time limits are respected.
 */
function anchoredHomeTimes(
  style: GameTimeStyle,
  info: TrackInfo[],
  times: Minutes[],
  capacity: number[],
  counts: number[][],
): number[] {
  const K = info.length;
  const T = times.length;
  if (style !== 'anchored' || T === 0 || K === 0) return new Array<number>(K).fill(0);
  if (T === 1) return new Array<number>(K).fill(0);
  const gamesPerDate = Math.floor(K / 2);
  const coachOk = (t: number) => info.filter((x) => !windowViolation(x.avail, times[t]!)).length;
  const ranked = times
    .map((_, t) => t)
    .sort((a, b) => capacity[b]! - capacity[a]! || coachOk(b) - coachOk(a) || times[a]! - times[b]!);
  let m = Math.min(T, Math.max(2, Math.floor(K / 3)));
  const capOf = (n: number) => ranked.slice(0, n).reduce((sum, t) => sum + capacity[t]!, 0);
  while (m < T && capOf(m) < gamesPerDate) m++;
  const chosen = ranked.slice(0, m).sort((a, b) => a - b);
  const capChosen = chosen.reduce((sum, t) => sum + capacity[t]!, 0) || 1;
  // Largest-remainder split of K tracks across the chosen times by capacity.
  const quotas = chosen.map((t) => (K * capacity[t]!) / capChosen);
  const sizes = quotas.map((q) => Math.floor(q));
  let left = K - sizes.reduce((a, b) => a + b, 0);
  const order = chosen.map((_, i) => i).sort((a, b) => quotas[b]! - sizes[b]! - (quotas[a]! - sizes[a]!) || a - b);
  for (const i of order) {
    if (left <= 0) break;
    sizes[i]!++;
    left--;
  }
  const seats: number[] = [];
  chosen.forEach((t, i) => {
    for (let n = 0; n < sizes[i]!; n++) seats.push(t);
  });
  const matrix = info.map((x, k) =>
    seats.map((t, seat) => {
      let cost = windowViolation(x.avail, times[t]!) ? 100 : 0;
      cost -= 5 * counts[k]![t]!; // keep established home times on rebuilds
      cost += 0.01 * Math.abs(k - seat); // otherwise keep position order
      return cost;
    }),
  );
  const result = minCostAssignment(matrix);
  return result.map((seat) => seats[seat] ?? chosen[0]!);
}

function describeTrack(style: GameTimeStyle, starts: Minutes[], byes: ISODate[], homeTime: Minutes | undefined): string {
  const tally = new Map<Minutes, number>();
  for (const m of starts) tally.set(m, (tally.get(m) ?? 0) + 1);
  const entries = [...tally.entries()].sort((a, b) => a[0] - b[0]);
  const parts: string[] = [];
  const byeText = byes.length ? `${byes.length === 1 ? 'bye' : 'byes'} ${listWords(byes.map(shortDate))}` : '';
  if (entries.length === 1) {
    parts.push(`All games at ${formatTime(entries[0]![0])}`);
  } else if (style === 'anchored') {
    const top = Math.max(...entries.map((e) => e[1]));
    const mode =
      homeTime !== undefined && tally.get(homeTime) === top ? homeTime : entries.find((e) => e[1] === top)![0];
    const others = entries.filter((e) => e[0] !== mode);
    const otherText = others
      .map(([m, n], i) => (i === 0 ? `${n} ${n === 1 ? 'game' : 'games'} at ${formatTime(m)}` : `${n} at ${formatTime(m)}`))
      .join(', ');
    parts.push(`Mostly ${formatTime(mode)}`, `${otherText} to play every team`);
  } else {
    const list = entries.map(([m, n], i) => (i === 0 ? `${n} ${n === 1 ? 'game' : 'games'} at ${formatTime(m)}` : `${n} at ${formatTime(m)}`));
    parts.push('Rotating times', list.join(', '));
  }
  if (byeText) parts.push(byeText);
  return parts.join(' · ');
}

function collectFlags(ctx: {
  flag: (f: Omit<Flag, 'divisionId'>) => void;
  info: TrackInfo[];
  plans: DatePlan[];
  coachPairs: [number, number, ID][];
  coachOther: OtherLink[][];
  siblingPairList: [number, number][];
  siblingOther: OtherLink[][];
  active: GameTrack[];
  meetings: Map<string, number>;
  index: SeasonIndex;
}): void {
  const { flag, info, plans } = ctx;
  const teamId = (k: number) => info[k]!.team?.id;
  const withTeam = (k: number, f: Omit<Flag, 'divisionId'>): Omit<Flag, 'divisionId'> => {
    const id = teamId(k);
    return id ? { ...f, teamId: id } : f;
  };

  for (const p of plans) {
    const unscheduled = p.assign.filter((s) => s < 0).length;
    if (unscheduled) {
      flag({
        code: 'scheduleConflict',
        severity: 'critical',
        message: `${formatDate(p.date)} has ${p.games.length} games but only ${p.slots.length} game ${p.slots.length === 1 ? 'slot' : 'slots'}; ${unscheduled} ${unscheduled === 1 ? 'game is' : 'games are'} not scheduled. Add a game slot.`,
      });
    }
  }

  // Coach game-time limits and blackout dates, per track.
  const slotStarts = [...new Set(plans.flatMap((p) => p.slots.map((s) => s.start)))];
  const noneFit = (avail: CoachAvailability) => slotStarts.every((m) => windowViolation(avail, m) !== null);
  info.forEach((x, k) => {
    if (!x.avail || !x.head) return;
    const early: string[] = [];
    const late: string[] = [];
    const away: string[] = [];
    for (const p of plans) {
      const gi = p.games.findIndex((g) => g.home === k || g.away === k);
      if (gi < 0) continue;
      if (x.avail.blackoutDates.includes(p.date)) away.push(p.date);
      const si = p.assign[gi]!;
      if (si < 0) continue;
      const s = p.slots[si]!;
      const v = windowViolation(x.avail, s.start);
      if (v === 'before') early.push(`${formatTime(s.start)} on ${shortDate(p.date)}`);
      if (v === 'after') late.push(`${formatTime(s.start)} on ${shortDate(p.date)}`);
    }
    const coach = `Coach ${fullName(x.head)}`;
    if ((early.length || late.length) && noneFit(x.avail)) {
      const limit = [
        x.avail.gamesNotBefore !== undefined ? `start before ${formatTime(x.avail.gamesNotBefore)}` : '',
        x.avail.gamesNotAfter !== undefined ? `start after ${formatTime(x.avail.gamesNotAfter)}` : '',
      ].filter(Boolean);
      flag(withTeam(k, { code: 'scheduleConflict', severity: 'warning', message: `${coach} can't do games that ${limit.join(' or ')}, but every game slot in this division does, so ${x.label} still plays then. Add a game slot that works, or check with the coach.` }));
    } else {
      if (early.length) {
        flag(withTeam(k, { code: 'scheduleConflict', severity: 'warning', message: `${coach} can't start games before ${formatTime(x.avail.gamesNotBefore!)}, but ${x.label} plays at ${listWords(early)}.` }));
      }
      if (late.length) {
        flag(withTeam(k, { code: 'scheduleConflict', severity: 'warning', message: `${coach} can't start games after ${formatTime(x.avail.gamesNotAfter!)}, but ${x.label} plays at ${listWords(late)}.` }));
      }
    }
    if (away.length) {
      flag(withTeam(k, { code: 'scheduleConflict', severity: 'warning', message: `${coach} is away ${listWords(away.map(formatDate))}, when ${x.label} has a game. Line up a stand-in coach.` }));
    }
  });

  // A person coaching two teams with overlapping games.
  for (const p of plans) {
    const slotOfTrack = new Map<number, SlotInfo>();
    const gameOfTrack = new Map<number, number>();
    p.games.forEach((g, gi) => {
      const s = p.slots[p.assign[gi]!];
      if (!s) return;
      for (const k of [g.home, g.away]) {
        slotOfTrack.set(k, s);
        gameOfTrack.set(k, gi);
      }
    });
    for (const [a, b, personId] of ctx.coachPairs) {
      const sa = slotOfTrack.get(a);
      const sb = slotOfTrack.get(b);
      if (sa && sb && gameOfTrack.get(a) !== gameOfTrack.get(b) && overlaps(sa, sb)) {
        const person = ctx.index.person.get(personId);
        flag(withTeam(a, { code: 'scheduleConflict', severity: 'critical', message: `${person ? fullName(person) : 'A coach'} coaches ${info[a]!.label} and ${info[b]!.label}, which play at the same time on ${formatDate(p.date)}.` }));
      }
    }
    for (const [k, s] of [...slotOfTrack.entries()].sort((x, y) => x[0] - y[0])) {
      for (const link of ctx.coachOther[k]!) {
        if ((link.byDate.get(p.date) ?? []).some((iv) => overlaps(iv, s))) {
          flag(withTeam(k, { code: 'scheduleConflict', severity: 'critical', message: `${link.label}, and both play at the same time as ${info[k]!.label} on ${formatDate(p.date)}.` }));
        }
      }
    }
  }

  // Siblings (soft): report links that miss on some dates.
  const apart = (a: Interval, b: Interval) => householdCost(a, b) > 0.25;
  for (const [a, b] of ctx.siblingPairList) {
    let both = 0;
    let missed = 0;
    for (const p of plans) {
      const ga = p.games.findIndex((g) => g.home === a || g.away === a);
      const gb = p.games.findIndex((g) => g.home === b || g.away === b);
      const sa = ga >= 0 ? p.slots[p.assign[ga]!] : undefined;
      const sb = gb >= 0 ? p.slots[p.assign[gb]!] : undefined;
      if (!sa || !sb || ga === gb) continue;
      both++;
      if (apart(sa, sb)) missed++;
    }
    if (missed) {
      flag(withTeam(a, { code: 'scheduleConflict', severity: 'info', message: `Siblings on ${info[a]!.label} and ${info[b]!.label} aren't at the same or back-to-back times on ${missed} of ${both} game days.` }));
    }
  }
  ctx.siblingOther.forEach((links, k) => {
    for (const link of links) {
      let both = 0;
      let missed = 0;
      for (const p of plans) {
        const gi = p.games.findIndex((g) => g.home === k || g.away === k);
        const s = gi >= 0 ? p.slots[p.assign[gi]!] : undefined;
        const ivs = link.byDate.get(p.date);
        if (!s || !ivs?.length) continue;
        both++;
        if (ivs.every((iv) => apart(s, iv))) missed++;
      }
      if (missed) {
        flag(withTeam(k, { code: 'scheduleConflict', severity: 'info', message: `Siblings on ${info[k]!.label} and ${link.label} aren't at the same or back-to-back times on ${missed} of ${both} game days.` }));
      }
    }
  });

  // Pairs that never meet (not enough dates).
  const K = info.length;
  const missing: string[] = [];
  for (let a = 0; a < K; a++) for (let b = a + 1; b < K; b++) if (!ctx.meetings.get(pairKey(a, b))) missing.push(`Team ${ctx.active[a]!.position} and Team ${ctx.active[b]!.position}`);
  if (missing.length && plans.length) {
    flag({
      code: 'scheduleConflict',
      severity: 'info',
      message: `Not enough game dates for every team to play every other team: ${missing.length} ${missing.length === 1 ? 'pair never meets' : 'pairs never meet'} (for example ${missing[0]}).`,
    });
  }
}
