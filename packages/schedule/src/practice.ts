import {
  addDays,
  compareStrings,
  weekdayOf,
  type ID,
  type ISODate,
  type Minutes,
  type SeasonData,
  type Team,
} from '@bvac/core';

/** One practice on one date, from a team's weekly practice slot. */
export interface PracticeEvent {
  /** Stable id: `prac_<team id>_<YYYYMMDD>`. */
  id: ID;
  teamId: ID;
  divisionId: ID;
  practiceSlotId: ID;
  fieldId: ID;
  date: ISODate;
  start: Minutes;
  end: Minutes;
}

/**
 * Weekly practice occurrences for each team between `season.practices.start`
 * and `.end` (inclusive). Cancelled teams and teams whose practice slot is
 * unknown are skipped. Sorted by date, start time, field, then team.
 */
export function practiceEvents(data: SeasonData, teams: readonly Team[]): PracticeEvent[] {
  const slots = new Map(data.practiceSlots.map((s) => [s.id, s]));
  const { start, end } = data.season.practices;
  const events: PracticeEvent[] = [];
  if (!start || !end || start > end) return events;
  for (const team of teams) {
    if (team.status === 'cancelled') continue;
    const slot = slots.get(team.practiceSlotId);
    if (!slot) continue;
    // First date on or after `start` that falls on the slot's weekday.
    let date = start;
    for (let i = 0; i < 7 && weekdayOf(date) !== slot.window.day; i++) date = addDays(date, 1);
    for (; date <= end; date = addDays(date, 7)) {
      if (weekdayOf(date) !== slot.window.day) break;
      events.push({
        id: `prac_${team.id}_${date.replaceAll('-', '')}`,
        teamId: team.id,
        divisionId: team.divisionId,
        practiceSlotId: slot.id,
        fieldId: slot.fieldId,
        date,
        start: slot.window.start,
        end: slot.window.end,
      });
    }
  }
  return events.sort(
    (a, b) =>
      compareStrings(a.date, b.date) ||
      a.start - b.start ||
      compareStrings(a.fieldId, b.fieldId) ||
      compareStrings(a.teamId, b.teamId),
  );
}
