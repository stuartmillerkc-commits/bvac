import { WEEKDAYS, type ISODate, type Minutes, type TimeWindow, type Weekday } from './types';

const DAY_SHORT: Record<Weekday, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

const DAY_LONG: Record<Weekday, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "17:30" -> 1050 */
export function toMinutes(hhmm: string): Minutes {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) throw new Error(`Invalid time "${hhmm}", expected HH:MM`);
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) throw new Error(`Invalid time "${hhmm}"`);
  return h * 60 + m;
}

/** 1050 -> "5:30pm"; 540 -> "9am" */
export function formatTime(minutes: Minutes): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h24 >= 12 ? 'pm' : 'am';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

/** 1050 -> "17:30" */
export function formatTime24(minutes: Minutes): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function dayShort(day: Weekday): string {
  return DAY_SHORT[day];
}

export function dayLong(day: Weekday): string {
  return DAY_LONG[day];
}

/** "Tue 5:30–6:30pm" */
export function formatWindow(w: TimeWindow): string {
  const start = formatTime(w.start);
  const end = formatTime(w.end);
  const sameHalf = (w.start >= 720) === (w.end >= 720);
  const startShort = sameHalf ? start.replace(/(am|pm)$/, '') : start;
  return `${DAY_SHORT[w.day]} ${startShort}–${end}`;
}

/** "2027-04-03" -> "Sat Apr 3" (computed in UTC so it never shifts a day). */
export function formatDate(date: ISODate): string {
  const d = new Date(`${date}T00:00:00Z`);
  const weekday = WEEKDAYS[(d.getUTCDay() + 6) % 7]!;
  return `${DAY_SHORT[weekday]} ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** Weekday of an ISO date, in UTC. */
export function weekdayOf(date: ISODate): Weekday {
  const d = new Date(`${date}T00:00:00Z`);
  return WEEKDAYS[(d.getUTCDay() + 6) % 7]!;
}

/** Add days to an ISO date. */
export function addDays(date: ISODate, days: number): ISODate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** True when `inner` lies entirely inside `outer` on the same day. */
export function windowContains(outer: TimeWindow, inner: TimeWindow): boolean {
  return outer.day === inner.day && outer.start <= inner.start && outer.end >= inner.end;
}

/** True when two windows share any time on the same day. */
export function windowsOverlap(a: TimeWindow, b: TimeWindow): boolean {
  return a.day === b.day && a.start < b.end && b.start < a.end;
}

/** True when a practice window is fully covered by any of the family's windows. */
export function fitsAvailability(practice: TimeWindow, availability: readonly TimeWindow[]): boolean {
  return availability.some((w) => windowContains(w, practice));
}

/** True when the family listed the practice's weekday at all, ignoring times. */
export function dayAvailable(practice: TimeWindow, availability: readonly TimeWindow[]): boolean {
  return availability.some((w) => w.day === practice.day);
}

export function compareWindows(a: TimeWindow, b: TimeWindow): number {
  return WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day) || a.start - b.start || a.end - b.end;
}
