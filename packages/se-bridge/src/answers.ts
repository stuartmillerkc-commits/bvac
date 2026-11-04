/**
 * Turning structured data into SportsEngine answer text and back.
 * All wording comes from ./formats.
 */
import {
  compareStrings,
  fullName,
  WEEKDAYS,
  windowContains,
  type Division,
  type Factor,
  type ID,
  type ImportField,
  type ISODate,
  type ISODateTime,
  type Minutes,
  type PlayerRequestType,
  type Registration,
  type RegistrationWindow,
  type Season,
  type SeasonData,
  type SeasonIndex,
  type Team,
  type TimeWindow,
  type Weekday,
} from '@bvac/core';
import {
  ASSUME_PM_UP_TO_HOUR,
  COACH_REQUEST_ANSWERS,
  divisionAnswer,
  FACTOR_ANSWERS,
  formatReportDate,
  formatReportDateTime,
  GENDER_ANSWERS,
  MULTI_SELECT_SEPARATOR,
  ONLY_THESE_DAYS_ANSWERS,
  PRACTICE_DAY_OPTIONS,
  PRACTICE_TIMES_NONE,
  practiceTimeLabel,
  REQUEST_TYPE_ANSWERS,
  SEASONS_PLAYED_OPTIONS,
  teamOptionLabel,
  TIMESTAMP_OFFSET,
} from './formats';
import { normalize } from './text';

// ---------------------------------------------------------------------------
// Shared lookups
// ---------------------------------------------------------------------------

export interface TimeRange {
  start: Minutes;
  end: Minutes;
}

/** Practice-time options for a division: distinct practice-slot times, earliest first. */
export function practiceTimeOptions(data: SeasonData, divisionId: ID): TimeRange[] {
  const seen = new Map<string, TimeRange>();
  for (const s of data.practiceSlots) {
    if (s.divisionId !== divisionId) continue;
    seen.set(`${s.window.start}-${s.window.end}`, { start: s.window.start, end: s.window.end });
  }
  return [...seen.values()].sort((a, b) => a.start - b.start || a.end - b.end);
}

/** Teams of a division that families can pick, in label order. */
export function selectableTeams(data: SeasonData, divisionId: ID): Team[] {
  return data.teams
    .filter((t) => t.divisionId === divisionId && t.status !== 'cancelled')
    .sort((a, b) => compareStrings(a.label, b.label) || compareStrings(a.id, b.id));
}

/** "Option C · Tue 5:30–6:30pm · Field 3" */
export function teamOption(index: SeasonIndex, team: Team): string {
  const slot = index.practiceSlot.get(team.practiceSlotId);
  if (!slot) return team.label;
  return teamOptionLabel(team.label, slot.window, index.field.get(slot.fieldId)?.name ?? slot.fieldId);
}

/** Divisions in form order. */
export function sortedDivisions(data: SeasonData): Division[] {
  return [...data.divisions].sort((a, b) => a.sortOrder - b.sortOrder || compareStrings(a.id, b.id));
}

/** Registration window for a submission time, from the season's date ranges. */
export function windowFor(season: Season, submittedAt: ISODateTime): RegistrationWindow {
  const date = submittedAt.slice(0, 10);
  if (date <= season.windows.early.end) return 'early';
  if (date <= season.windows.regular.end) return 'regular';
  return 'late';
}

/** First season year of the school year the season falls in (2026 for Spring 2027). */
export function schoolYearStart(season: Pick<Season, 'term' | 'year'>): number {
  return season.term === 'spring' ? season.year - 1 : season.year;
}

/**
 * Grade from birthdate with a Sep 1 cutoff: kindergarten in the 2026-27
 * school year means born Sep 2020 – Aug 2021. Age 3 is -2, age 4 is -1.
 */
export function gradeFromBirthdate(season: Pick<Season, 'term' | 'year'>, birthdate: ISODate): number {
  const year = Number(birthdate.slice(0, 4));
  const month = Number(birthdate.slice(5, 7));
  const cohort = month >= 9 ? year : year - 1;
  return schoolYearStart(season) - 6 - cohort;
}

// ---------------------------------------------------------------------------
// Encoding (structured -> answer text)
// ---------------------------------------------------------------------------

export function daysAnswer(availability: readonly TimeWindow[]): string {
  return PRACTICE_DAY_OPTIONS.filter((o) => availability.some((w) => w.day === o.day))
    .map((o) => o.label)
    .join(MULTI_SELECT_SEPARATOR);
}

export function timesAnswer(availability: readonly TimeWindow[], options: readonly TimeRange[]): string {
  const fit = options.filter((o) => availability.some((w) => windowContains(w, { day: w.day, ...o })));
  if (fit.length === 0 && options.length > 0 && availability.length > 0) return PRACTICE_TIMES_NONE;
  return fit.map((o) => practiceTimeLabel(o.start, o.end)).join(MULTI_SELECT_SEPARATOR);
}

/** Name in the coach pulldown. */
export function coachName(index: SeasonIndex, personId: ID | undefined): string {
  const p = personId ? index.person.get(personId) : undefined;
  return p ? fullName(p) : '';
}

/** The person who coached the player last season, from history. */
export function lastSeasonCoachId(index: SeasonIndex, playerId: ID): ID | undefined {
  const last = index.historyByPlayer.get(playerId)?.[0];
  return last && last.seasonOrder === index.lastSeasonOrder ? last.coachPersonId : undefined;
}

export function seasonsPlayedAnswer(count: number): string {
  if (count <= 0) return SEASONS_PLAYED_OPTIONS[0]!;
  return SEASONS_PLAYED_OPTIONS[Math.min(count, SEASONS_PLAYED_OPTIONS.length - 1)]!;
}

/**
 * Every import field's answer for one registration, as the Saved Report would
 * show it. Used by the sample export and to tell whether a re-imported row
 * changed anything.
 */
export function registrationAnswers(index: SeasonIndex, reg: Registration): Record<ImportField, string> {
  const data = index.data;
  const player = index.player.get(reg.playerId);
  const household = player ? index.household.get(player.householdId) : undefined;
  const guardian = household ? index.person.get(household.guardianIds[0] ?? '') : undefined;
  const division = index.division.get(reg.divisionId);
  const choice = (rank: number) => {
    const c = reg.choices.find((x) => x.rank === rank);
    const team = c ? index.team.get(c.teamId) : undefined;
    return team ? teamOption(index, team) : '';
  };
  const request = (i: number) => reg.requests[i];
  const typeAnswer = (t: PlayerRequestType | undefined) => (t ? REQUEST_TYPE_ANSWERS[t] : '');
  let coach = '';
  if (reg.coachRequest?.sameAsLastSeason) coach = COACH_REQUEST_ANSWERS.sameAsLastSeason;
  else if (reg.coachRequest?.coachPersonId) coach = coachName(index, reg.coachRequest.coachPersonId);
  else coach = COACH_REQUEST_ANSWERS.noPreference;
  const history = index.historyByPlayer.get(reg.playerId) ?? [];
  return {
    externalId: reg.externalId ?? '',
    submittedAt: formatReportDateTime(reg.submittedAt),
    playerFirstName: player?.firstName ?? '',
    playerLastName: player?.lastName ?? '',
    playerBirthdate: player ? formatReportDate(player.birthdate) : '',
    playerGender: player ? GENDER_ANSWERS[player.gender] : '',
    divisionAnswer: division ? divisionAnswer(division) : '',
    shirtSize: player?.shirtSize ?? '',
    guardianFirstName: guardian?.firstName ?? '',
    guardianLastName: guardian?.lastName ?? '',
    guardianEmail: guardian?.email ?? '',
    guardianPhone: guardian?.phone ?? '',
    city: household?.city ?? '',
    practiceDays: daysAnswer(reg.availability),
    onlyTheseDays: reg.availabilityRequired ? ONLY_THESE_DAYS_ANSWERS.yes : ONLY_THESE_DAYS_ANSWERS.no,
    practiceTimes: timesAnswer(reg.availability, practiceTimeOptions(data, reg.divisionId)),
    firstChoiceTeam: choice(1),
    secondChoiceTeam: choice(2),
    coachRequest: coach,
    playerRequest1Name: request(0)?.targetName ?? '',
    playerRequest1Type: typeAnswer(request(0)?.type),
    playerRequest2Name: request(1)?.targetName ?? '',
    playerRequest2Type: typeAnswer(request(1)?.type),
    mostImportant: reg.factorRanking[0] ? FACTOR_ANSWERS[reg.factorRanking[0]] : '',
    secondMostImportant: reg.factorRanking[1] ? FACTOR_ANSWERS[reg.factorRanking[1]] : '',
    seasonsPlayed: seasonsPlayedAnswer(history.length),
    lastSeasonCoach: coachName(index, lastSeasonCoachId(index, reg.playerId)),
    requestText: reg.note ?? '',
  };
}

// ---------------------------------------------------------------------------
// Decoding (answer text -> structured). Each returns undefined when unreadable.
// ---------------------------------------------------------------------------

/** Split a multi-select cell. */
export function splitMulti(value: string): string[] {
  return value
    .split(/[,;|\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const DAY_WORDS: [Weekday, RegExp][] = [
  ['mon', /^mo(n(day)?)?s?$/],
  ['tue', /^tu(e(s(day)?)?)?s?$/],
  ['wed', /^we(d(nesday)?)?s?$/],
  ['thu', /^th(u(r(s(day)?)?)?)?s?$/],
  ['fri', /^fr(i(day)?)?s?$/],
  ['sat', /^sa(t(urday)?)?s?$/],
  ['sun', /^su(n(day)?)?s?$/],
];

export function parseDay(value: string): Weekday | undefined {
  const v = normalize(value).replace(/ /g, '');
  return DAY_WORDS.find(([, re]) => re.test(v))?.[0];
}

/** Days from a cell; unknown parts are returned separately. */
export function parseDays(value: string): { days: Weekday[]; unknown: string[] } {
  const days = new Set<Weekday>();
  const unknown: string[] = [];
  for (const part of splitMulti(value)) {
    const d = parseDay(part);
    if (d) days.add(d);
    else unknown.push(part);
  }
  return { days: WEEKDAYS.filter((d) => days.has(d)), unknown };
}

const TIME_PART = /^(\d{1,2})(?::(\d{2}))?\s*([ap])?\.?\s*m?\.?$/;

/** "5:30–6:30pm", "5:30 PM - 6:30 PM", "17:30-18:30", "5-6" */
export function parseTimeRange(value: string): TimeRange | undefined {
  const parts = value
    .toLowerCase()
    .replace(/\s+to\s+/, '-')
    .split(/\s*[-–—]\s*/);
  if (parts.length !== 2) return undefined;
  const a = TIME_PART.exec(parts[0]!.trim());
  const b = TIME_PART.exec(parts[1]!.trim());
  if (!a || !b) return undefined;
  const raw = (m: RegExpExecArray) => ({ h: Number(m[1]), min: Number(m[2] ?? 0), ap: m[3] as 'a' | 'p' | undefined });
  const s = raw(a);
  const e = raw(b);
  if (s.min > 59 || e.min > 59 || s.h > 23 || e.h > 23) return undefined;
  const to24 = (h: number, ap: 'a' | 'p' | undefined) => {
    if (ap === 'a') return h % 12;
    if (ap === 'p') return (h % 12) + 12;
    return h;
  };
  let endH: number;
  if (e.ap) endH = to24(e.h, e.ap);
  else if (e.h >= 1 && e.h <= ASSUME_PM_UP_TO_HOUR) endH = e.h + 12;
  else endH = e.h;
  const end = endH * 60 + e.min;
  let start: number;
  if (s.ap) start = to24(s.h, s.ap) * 60 + s.min;
  else if (s.h >= 13) start = s.h * 60 + s.min;
  else {
    // Borrow the end's half of the day unless that puts the start after the end.
    const sameHalf = (s.h % 12) * 60 + s.min + (endH >= 12 ? 12 * 60 : 0);
    start = sameHalf < end ? sameHalf : (s.h % 12) * 60 + s.min;
  }
  if (start >= end) return undefined;
  return { start, end };
}

export function parseTimeRanges(value: string): { ranges: TimeRange[]; unknown: string[]; none: boolean } {
  const ranges: TimeRange[] = [];
  const unknown: string[] = [];
  let none = false;
  for (const part of splitMulti(value)) {
    if (normalize(part) === normalize(PRACTICE_TIMES_NONE) || /^(none|no times?)\b/.test(normalize(part))) {
      none = true;
      continue;
    }
    const r = parseTimeRange(part);
    if (r) ranges.push(r);
    else unknown.push(part);
  }
  return { ranges, unknown, none: none && ranges.length === 0 };
}

/** Availability windows: every day × every time range, with touching ranges merged. */
export function availabilityFrom(days: readonly Weekday[], ranges: readonly TimeRange[]): TimeWindow[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: TimeRange[] = [];
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else merged.push({ ...r });
  }
  return days.flatMap((day) => merged.map((r) => ({ day, start: r.start, end: r.end })));
}

export function parseYesNo(value: string): boolean | undefined {
  const v = normalize(value);
  if (!v) return undefined;
  if (v === normalize(ONLY_THESE_DAYS_ANSWERS.yes) || /^(y|yes|true|1)\b/.test(v)) return true;
  if (v === normalize(ONLY_THESE_DAYS_ANSWERS.no) || /^(n|no|false|0)\b/.test(v)) return false;
  return undefined;
}

export function parseGender(value: string): 'M' | 'F' | undefined {
  const v = normalize(value);
  if (/^(m|male|boy|man)$/.test(v)) return 'M';
  if (/^(f|female|girl|woman)$/.test(v)) return 'F';
  return undefined;
}

export function parseRequestType(value: string): PlayerRequestType | undefined {
  const v = normalize(value);
  if (!v) return undefined;
  if (v.startsWith('sib') || v.includes('brother') || v.includes('sister')) return 'sibling';
  if (v.startsWith('fri')) return 'friend';
  return undefined;
}

export function parseFactor(value: string): Factor | undefined {
  const v = normalize(value);
  if (!v) return undefined;
  for (const [factor, label] of Object.entries(FACTOR_ANSWERS) as [Factor, string][]) {
    if (v === normalize(label)) return factor;
  }
  if (/last|same team|previous/.test(v)) return 'lastTeam';
  if (/time|day|night|practice|schedule/.test(v)) return 'practiceTime';
  if (/friend|teammate/.test(v)) return 'friends';
  if (/coach/.test(v)) return 'coach';
  return undefined;
}

/** Seasons played: "5+" -> 5, "3" -> 3. */
export function parseSeasonsPlayed(value: string): number | undefined {
  const m = /(\d+)/.exec(value);
  return m ? Number(m[1]) : undefined;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function validDate(y: number, m: number, d: number): ISODate | undefined {
  if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return undefined;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** "03/14/2019", "3/14/19", "2019-03-14" */
export function parseDate(value: string, twoDigitPivot = 50): ISODate | undefined {
  const v = value.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v);
  if (m) return validDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/.exec(v);
  if (m) {
    let y = Number(m[3]);
    if (m[3]!.length === 2) y += y < twoDigitPivot ? 2000 : 1900;
    return validDate(y, Number(m[1]), Number(m[2]));
  }
  return undefined;
}

/**
 * "01/05/2027 07:42 PM", "1/5/2027 19:42", "2027-01-05T19:42:00-06:00".
 * Wall-clock times are taken as BVAC local time.
 */
export function parseDateTime(value: string): ISODateTime | undefined {
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(v)) return v;
  const date = parseDate(v);
  if (!date) return undefined;
  const t = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap])?\.?\s*m?\.?\s*$/i.exec(v.replace(/^\S+\s*/, '').trim() || 'x');
  let h = 0;
  let min = 0;
  let sec = 0;
  if (t) {
    h = Number(t[1]);
    min = Number(t[2]);
    sec = Number(t[3] ?? 0);
    const ap = t[4]?.toLowerCase();
    if (ap === 'a') h = h % 12;
    if (ap === 'p') h = (h % 12) + 12;
    if (h > 23 || min > 59 || sec > 59) return undefined;
  }
  return `${date}T${pad(h)}:${pad(min)}:${pad(sec)}${TIMESTAMP_OFFSET}`;
}

/** A timestamp to the minute, for telling whether a re-imported date changed. */
export function formatTimestampForCompare(iso: ISODateTime): string {
  return iso.slice(0, 16);
}

/** Division from the division answer: BVAC's label, division name ("Division 3", "Div 3") or code ("D3"). */
export function parseDivision(data: SeasonData, value: string): Division | undefined {
  const v = normalize(value);
  if (!v) return undefined;
  const divisions = sortedDivisions(data);
  const exact = divisions.find((d) => normalize(divisionAnswer(d)) === v || normalize(d.name) === v || normalize(d.code) === v);
  if (exact) return exact;
  const contains = divisions.filter((d) => v.includes(normalize(d.label)));
  if (contains.length === 1) return contains[0];
  const num = /^(?:division|div|d)\s*(\d+)\b/.exec(v);
  if (num) return divisions.find((d) => normalize(d.name) === `division ${num[1]}` || normalize(d.code) === `d${num[1]}`);
  return undefined;
}

/**
 * Team from a team option answer. Tries the full option text, then the label
 * before the first separator ("Option C"), then the practice window + field.
 * Teams in `divisionId` win; other divisions are a fallback.
 */
export function parseTeamOption(index: SeasonIndex, divisionId: ID | undefined, value: string): Team | undefined {
  const v = normalize(value);
  if (!v) return undefined;
  const all = index.data.teams.filter((t) => t.status !== 'cancelled');
  const scopes = divisionId ? [all.filter((t) => t.divisionId === divisionId), all] : [all];
  for (const teams of scopes) {
    const full = teams.filter((t) => normalize(teamOption(index, t)) === v);
    if (full.length === 1) return full[0];
    const label = normalize(value.split(/\s+[·|,–-]\s+/)[0] ?? '');
    const byLabel = teams.filter((t) => normalize(t.label) === label || (t.name && normalize(t.name) === label));
    if (byLabel.length === 1) return byLabel[0];
    const byPrefix = teams.filter((t) => v.startsWith(normalize(t.label) + ' '));
    if (byPrefix.length === 1) return byPrefix[0];
  }
  return undefined;
}
