/**
 * Small pure helpers shared by the family pages (Team Finder, mock
 * SportsEngine form, preferences). No React here, so they're easy to reuse.
 */
import {
  compareStrings,
  compareWindows,
  fitsAvailability,
  formatWindow,
  fullName,
  gradeLabel,
  headCoach,
  teamPracticeWindow,
  type Division,
  type Grade,
  type ID,
  type ISODate,
  type ISODateTime,
  type Minutes,
  type Player,
  type PlacementRunResult,
  type Registration,
  type RegistrationWindow,
  type Season,
  type SeasonIndex,
  type Team,
  type TimeWindow,
  type Weekday,
} from '@bvac/core';

// ---------------------------------------------------------------------------
// Teams and seats
// ---------------------------------------------------------------------------

/** Team options a family can see: not cancelled or still in draft. */
export function visibleTeams(index: SeasonIndex, divisionId: ID): Team[] {
  return (index.teamsByDivision.get(divisionId) ?? [])
    .filter((t) => t.status !== 'cancelled' && t.status !== 'draft')
    .sort((a, b) => compareWindows(teamPracticeWindow(index, a), teamPracticeWindow(index, b)) || compareStrings(a.label, b.label));
}

export type SeatStatus = 'open' | 'filling' | 'waitlist';

export interface SeatInfo {
  status: SeatStatus;
  /** Kids the engine currently has on the team. */
  count: number;
  preferred: number;
  max: number;
  /** Seats left before max. */
  left: number;
}

/** open below preferred, filling between preferred and max, waitlist at max. */
export function seatInfo(index: SeasonIndex, results: Record<ID, PlacementRunResult>, team: Team): SeatInfo {
  const division = index.division.get(team.divisionId);
  const size = division?.settings.teamSize ?? { min: 0, preferred: 0, max: 0 };
  const count = results[team.divisionId]?.placements.filter((p) => p.teamId === team.id).length ?? 0;
  const status: SeatStatus = count >= size.max ? 'waitlist' : count >= size.preferred ? 'filling' : 'open';
  return { status, count, preferred: size.preferred, max: size.max, left: Math.max(0, size.max - count) };
}

export function isFirstComeFirstServed(division: Division): boolean {
  return division.settings.model === 'fcfs';
}

/** "Option C · Tue 5:30–6:30pm · Field 3", the way the answer reads in SportsEngine. */
export function teamOptionText(index: SeasonIndex, team: Team): string {
  const slot = index.practiceSlot.get(team.practiceSlotId);
  const field = slot ? index.field.get(slot.fieldId) : undefined;
  return [team.label, slot ? formatWindow(slot.window) : null, field?.name].filter(Boolean).join(' · ');
}

export function coachName(index: SeasonIndex, team: Team): string | undefined {
  const coach = headCoach(index, team.id);
  return coach ? `Coach ${fullName(coach)}` : undefined;
}

export function teamFits(index: SeasonIndex, team: Team, availability: readonly TimeWindow[]): boolean {
  return fitsAvailability(teamPracticeWindow(index, team), availability);
}

// ---------------------------------------------------------------------------
// Divisions from grade or birthdate
// ---------------------------------------------------------------------------

/** First calendar year of the school year the season falls in (Spring 2027 -> 2026-27 -> 2026). */
export function schoolYearStart(season: Season): number {
  return season.term === 'spring' ? season.year - 1 : season.year;
}

/** "2026-27" */
export function schoolYearLabel(season: Season): string {
  const y = schoolYearStart(season);
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
}

/**
 * Estimated school grade from a birthdate, using a Sept 1 cutoff: a child who
 * turns 5 by Aug 31 is in kindergarten that school year. Families who know
 * their child's grade should use it instead; BVAC places by school grade.
 */
export function gradeFromBirthdate(birthdate: ISODate, season: Season): Grade | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthdate);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const cohortYear = month >= 9 ? year + 1 : year;
  return schoolYearStart(season) - 5 - cohortYear;
}

export function divisionForGrade(divisions: readonly Division[], grade: Grade): Division | undefined {
  return divisions.find((d) => grade >= d.minGrade && grade <= d.maxGrade);
}

/** Grade choices that appear in some division, youngest first. */
export function gradeOptions(divisions: readonly Division[]): Grade[] {
  const out: Grade[] = [];
  for (const d of [...divisions].sort((a, b) => a.minGrade - b.minGrade)) {
    for (let g = d.minGrade; g <= d.maxGrade; g++) out.push(g);
  }
  return out;
}

export function gradeText(grade: Grade): string {
  if (grade < 0) return gradeLabel(grade);
  if (grade === 0) return 'Kindergarten';
  return `${gradeLabel(grade)} grade`;
}

// ---------------------------------------------------------------------------
// Availability from the SportsEngine checkbox answers
// ---------------------------------------------------------------------------

export const FORM_DAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri'];

/** "Practice times available" options from SPORTSENGINE.md. */
export const FORM_TIMES: { id: string; label: string; start: Minutes; end: Minutes }[] = [
  { id: '17', label: '5:00–6:00pm', start: 17 * 60, end: 18 * 60 },
  { id: '18', label: '6:00–7:00pm', start: 18 * 60, end: 19 * 60 },
  { id: '19', label: '7:00–8:00pm', start: 19 * 60, end: 20 * 60 },
];

/** Checked days × checked times, with back-to-back times merged ("Tue 5–7pm"). */
export function availabilityFromAnswers(days: readonly Weekday[], timeIds: readonly string[]): TimeWindow[] {
  const times = FORM_TIMES.filter((t) => timeIds.includes(t.id));
  const ranges: { start: Minutes; end: Minutes }[] = [];
  for (const t of times) {
    const last = ranges[ranges.length - 1];
    if (last && last.end === t.start) last.end = t.end;
    else ranges.push({ start: t.start, end: t.end });
  }
  const out: TimeWindow[] = [];
  for (const day of FORM_DAYS.filter((d) => days.includes(d))) for (const r of ranges) out.push({ day, ...r });
  return out;
}

// ---------------------------------------------------------------------------
// Registration window and timestamps
// ---------------------------------------------------------------------------

/** ISO timestamp in BVAC's -06:00 offset (US Central, standard time), to the second. */
export function centralTimestamp(ms: number): ISODateTime {
  return `${new Date(ms - 6 * 3600_000).toISOString().slice(0, 19)}-06:00`;
}

/** Early or regular by the season's dates; late after regular closes; "regular" outside every window. */
export function windowFor(season: Season, at: ISODateTime): RegistrationWindow {
  const date = at.slice(0, 10);
  if (date >= season.windows.early.start && date <= season.windows.early.end) return 'early';
  if (date >= season.windows.regular.start && date <= season.windows.regular.end) return 'regular';
  if (date > season.windows.regular.end && date <= season.rostersFinal) return 'late';
  return 'regular';
}

// ---------------------------------------------------------------------------
// Matching typed player names against registered kids
// ---------------------------------------------------------------------------

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Levenshtein distance, capped for speed. */
function editDistance(a: string, b: string, cap = 3): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > cap) return cap + 1;
    prev = cur;
  }
  return prev[b.length]!;
}

export interface NameMatch {
  status: 'matched' | 'ambiguous' | 'unmatched';
  /** Best candidates, closest first (one when matched). */
  candidates: Player[];
}

/**
 * Score how well a typed name ("Jake M.", "ava martinez", "Sophia Andersn")
 * fits a player. Lower is better; null means no match.
 */
function nameScore(typed: string, p: Player): number | null {
  const words = norm(typed).split(' ').filter(Boolean);
  if (!words.length) return null;
  const first = words[0]!;
  const last = words.slice(1).join(' ');
  const firsts = [norm(p.firstName), ...(p.nickname ? [norm(p.nickname)] : [])];
  const lastName = norm(p.lastName);
  const firstExact = firsts.includes(first);
  const firstClose = firstExact || firsts.some((f) => f.length > 3 && editDistance(f, first, 1) <= 1);
  if (!firstClose) return null;
  const firstCost = firstExact ? 0 : 2;
  if (!last) return 5 + firstCost; // first name only: never a sure match on its own
  if (last === lastName) return firstCost;
  if (last.length === 1 && lastName.startsWith(last)) return 3 + firstCost; // "Jake M."
  if (last.length >= 3 && editDistance(last, lastName, 2) <= 2) return 1 + editDistance(last, lastName, 2) + firstCost;
  return null;
}

/**
 * Match a typed name against registered players. Same division first; other
 * divisions only if nothing in the division matches (siblings often differ).
 */
export function matchPlayerName(typed: string, sameDivision: readonly Player[], others: readonly Player[] = []): NameMatch {
  for (const pool of [sameDivision, others]) {
    const scored = pool
      .map((p) => ({ p, s: nameScore(typed, p) }))
      .filter((x): x is { p: Player; s: number } => x.s !== null)
      .sort((a, b) => a.s - b.s || compareStrings(a.p.lastName, b.p.lastName) || compareStrings(a.p.firstName, b.p.firstName));
    if (!scored.length) continue;
    const best = scored[0]!;
    const tied = scored.filter((x) => x.s === best.s);
    if (tied.length === 1 && best.s < 5) return { status: 'matched', candidates: [best.p] };
    return { status: 'ambiguous', candidates: scored.slice(0, 5).map((x) => x.p) };
  }
  return { status: 'unmatched', candidates: [] };
}

/** Registered (active) players in a division, plus everyone else registered. */
export function registeredPlayers(index: SeasonIndex, divisionId: ID, excludePlayerId?: ID): { same: Player[]; others: Player[] } {
  const same: Player[] = [];
  const others: Player[] = [];
  for (const r of index.data.registrations) {
    if (r.status !== 'active' || r.playerId === excludePlayerId) continue;
    const p = index.player.get(r.playerId);
    if (!p) continue;
    (r.divisionId === divisionId ? same : others).push(p);
  }
  return { same, others };
}

/** "Ava Martinez, 1st grade" */
export function playerLine(index: SeasonIndex, p: Player): string {
  const reg = index.registrationByPlayer.get(p.id);
  const division = reg ? index.division.get(reg.divisionId) : undefined;
  return `${fullName(p)}, ${gradeText(p.grade)}${division ? ` · ${division.name}` : ''}`;
}

/** A registration's player, for headings. */
export function registrationPlayer(index: SeasonIndex, r: Registration): Player | undefined {
  return index.player.get(r.playerId);
}
