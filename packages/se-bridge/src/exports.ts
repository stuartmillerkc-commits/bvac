/**
 * Files going to SportsEngine (teams, schedule), the rostering list, and the
 * sample registration report used as the demo's import file.
 */
import {
  compareStrings,
  dayLong,
  formatDate,
  fullName,
  headCoach,
  indexSeason,
  type Game,
  type ID,
  type ImportField,
  type ISODate,
  type Placement,
  type RosterExportRow,
  type SeasonData,
  type SeasonIndex,
  type Team,
} from '@bvac/core';
import { practiceEvents } from '@bvac/schedule';
import { registrationAnswers, sortedDivisions, teamOption } from './answers';
import { recordsToCsv, toCsv } from './csv';
import {
  COMMENT_ROW_PREFIX,
  formatScheduleDate,
  formatScheduleTime,
  NAME_LIST_SEPARATOR,
  PRACTICE_EVENT_NAME,
  practiceTimeLabel,
  REPORT_COLUMN_ORDER,
  REPORT_EXTRA_COLUMNS,
  REPORT_EXTRA_VALUES,
  reportHeader,
  ROSTER_LIST_COLUMNS,
  SCHEDULE_EVENT_TYPES,
  SCHEDULE_IMPORT_COLUMNS,
  SCHEDULE_REPLACE_WARNING,
  SCHEDULE_WARNING_PLACEMENT,
  scheduleTeamRef,
  TEAM_GENDER_ANSWERS,
  TEAMS_IMPORT_COLUMNS,
  type ScheduleImportColumn,
  type TeamsImportColumn,
} from './formats';

/** Team name used in SportsEngine: the rostered name, or the option label until it has one. */
export function seTeamName(team: Team): string {
  return team.name ?? team.label;
}

function divisionOrder(data: SeasonData): Map<ID, number> {
  return new Map(sortedDivisions(data).map((d, i) => [d.id, i]));
}

function sortTeams(data: SeasonData, teams: readonly Team[]): Team[] {
  const order = divisionOrder(data);
  return [...teams].sort(
    (a, b) =>
      (order.get(a.divisionId) ?? 99) - (order.get(b.divisionId) ?? 99) ||
      compareStrings(a.label, b.label) ||
      compareStrings(a.id, b.id),
  );
}

// ---------------------------------------------------------------------------
// Sample registration report (the demo's import file)
// ---------------------------------------------------------------------------

/** Header row of the sample Saved Report, in column order. */
export function sampleReportHeaders(data: SeasonData): string[] {
  return REPORT_COLUMN_ORDER.map((c) =>
    c in REPORT_EXTRA_COLUMNS ? REPORT_EXTRA_COLUMNS[c as keyof typeof REPORT_EXTRA_COLUMNS] : reportHeader(c as ImportField, data.season),
  );
}

/**
 * A "Saved Report" CSV as SportsEngine would export it once BVAC adds the
 * seven questions: one row per active registration, in submission order,
 * answers in display form.
 */
export function sampleSportsEngineExport(data: SeasonData): string {
  const index = indexSeason(data);
  const headers = sampleReportHeaders(data);
  const regs = data.registrations
    .filter((r) => r.status === 'active' && r.seasonId === data.season.id)
    .sort((a, b) => compareStrings(a.submittedAt, b.submittedAt) || compareStrings(a.externalId ?? '', b.externalId ?? '') || compareStrings(a.id, b.id));
  const rows = regs.map((reg) => {
    const answers = registrationAnswers(index, reg);
    return REPORT_COLUMN_ORDER.map((c) =>
      c in REPORT_EXTRA_VALUES ? REPORT_EXTRA_VALUES[c as keyof typeof REPORT_EXTRA_VALUES] : answers[c as ImportField],
    );
  });
  return toCsv([headers, ...rows]);
}

// ---------------------------------------------------------------------------
// Teams Import
// ---------------------------------------------------------------------------

/** Rows for Season Management "Teams Import". Cancelled teams are left out. */
export function teamsImportRows(data: SeasonData, teams: readonly Team[]): Record<TeamsImportColumn, string>[] {
  const index = indexSeason(data);
  return sortTeams(data, teams)
    .filter((t) => t.status !== 'cancelled')
    .map((team) => {
      const division = index.division.get(team.divisionId);
      const slot = index.practiceSlot.get(team.practiceSlotId);
      const head = headCoach(index, team.id);
      const assistants = (index.coachesByTeam.get(team.id) ?? [])
        .filter((c) => c.role === 'assistant')
        .map((c) => index.person.get(c.personId))
        .filter((p) => !!p)
        .map((p) => fullName(p!));
      return {
        Season: data.season.name,
        Division: division?.name ?? '',
        'Team Name': seTeamName(team),
        Gender: division ? TEAM_GENDER_ANSWERS[division.genderRule] : '',
        'Team Option': teamOption(index, team),
        'Practice Day': slot ? dayLong(slot.window.day) : '',
        'Practice Time': slot ? practiceTimeLabel(slot.window.start, slot.window.end) : '',
        'Practice Location': slot ? (index.field.get(slot.fieldId)?.name ?? '') : '',
        'Head Coach': head ? fullName(head) : '',
        'Head Coach Email': head?.email ?? '',
        'Assistant Coaches': assistants.join(NAME_LIST_SEPARATOR),
        'External Team ID': team.id,
      };
    });
}

export function exportTeamsCsv(data: SeasonData, teams: Team[]): string {
  return recordsToCsv(TEAMS_IMPORT_COLUMNS, teamsImportRows(data, teams));
}

// ---------------------------------------------------------------------------
// Schedule Import
// ---------------------------------------------------------------------------

export interface ScheduleExportOptions {
  /**
   * Leave out events before this date. Use it with SportsEngine's "ignore
   * games before today" so a re-upload doesn't touch past events.
   */
  fromDate?: ISODate;
}

/**
 * Rows for Season Management "Schedule Import": every game between two
 * claimed teams, plus weekly practices. Games whose schedule position has no
 * team yet are left out (SportsEngine needs real teams). Sorted by date, time,
 * field, then event.
 */
export function scheduleImportRows(
  data: SeasonData,
  teams: readonly Team[],
  games: readonly Game[],
  options: ScheduleExportOptions = {},
): Record<ScheduleImportColumn, string>[] {
  const index = indexSeason(data);
  const live = teams.filter((t) => t.status !== 'cancelled');
  const teamByTrack = new Map<ID, Team>();
  for (const t of live) if (t.gameTrackId) teamByTrack.set(t.gameTrackId, t);
  const gameSlots = new Map(data.gameSlots.map((s) => [s.id, s]));
  const ref = (team: Team) => scheduleTeamRef(index.division.get(team.divisionId)?.name ?? '', seTeamName(team));
  const fieldName = (id: ID) => index.field.get(id)?.name ?? id;
  const parkName = (id: ID) => index.field.get(id)?.park ?? '';

  type Keyed = { key: [string, number, string, number, string]; row: Record<ScheduleImportColumn, string> };
  const out: Keyed[] = [];
  for (const game of games) {
    const slot = gameSlots.get(game.gameSlotId);
    const home = teamByTrack.get(game.homeTrackId);
    const away = teamByTrack.get(game.awayTrackId);
    if (!slot || !home || !away) continue;
    if (options.fromDate && slot.date < options.fromDate) continue;
    const end = slot.start + slot.durationMin;
    out.push({
      key: [slot.date, slot.start, slot.fieldId, 0, game.id],
      row: {
        'Event Type': SCHEDULE_EVENT_TYPES.game,
        'Event Name': '',
        'Start Date': formatScheduleDate(slot.date),
        'Start Time': formatScheduleTime(slot.start),
        'End Date': formatScheduleDate(slot.date),
        'End Time': formatScheduleTime(end),
        'Duration (minutes)': String(slot.durationMin),
        'Home Team': ref(home),
        'Away Team': ref(away),
        Teams: '',
        Location: parkName(slot.fieldId),
        'Sub-Location': fieldName(slot.fieldId),
        'Event ID': game.id,
      },
    });
  }
  for (const p of practiceEvents(data, live as Team[])) {
    if (options.fromDate && p.date < options.fromDate) continue;
    const team = index.team.get(p.teamId) ?? live.find((t) => t.id === p.teamId);
    if (!team) continue;
    out.push({
      key: [p.date, p.start, p.fieldId, 1, p.id],
      row: {
        'Event Type': SCHEDULE_EVENT_TYPES.practice,
        'Event Name': PRACTICE_EVENT_NAME,
        'Start Date': formatScheduleDate(p.date),
        'Start Time': formatScheduleTime(p.start),
        'End Date': formatScheduleDate(p.date),
        'End Time': formatScheduleTime(p.end),
        'Duration (minutes)': String(p.end - p.start),
        'Home Team': '',
        'Away Team': '',
        Teams: ref(team),
        Location: parkName(p.fieldId),
        'Sub-Location': fieldName(p.fieldId),
        'Event ID': p.id,
      },
    });
  }
  out.sort(
    (a, b) =>
      compareStrings(a.key[0], b.key[0]) ||
      a.key[1] - b.key[1] ||
      compareStrings(a.key[2], b.key[2]) ||
      a.key[3] - b.key[3] ||
      compareStrings(a.key[4], b.key[4]),
  );
  return out.map((k) => k.row);
}

export function exportScheduleCsv(data: SeasonData, teams: Team[], games: Game[], options: ScheduleExportOptions = {}): string {
  const csv = recordsToCsv(SCHEDULE_IMPORT_COLUMNS, scheduleImportRows(data, teams, games, options));
  return SCHEDULE_WARNING_PLACEMENT === 'commentRow' ? toCsv([[`${COMMENT_ROW_PREFIX}${SCHEDULE_REPLACE_WARNING}`]]) + csv : csv;
}

/** README to hand over with the schedule CSV: the replace-all warning and upload steps. */
export function scheduleImportReadme(data: SeasonData, options: ScheduleExportOptions = {}): string {
  const lines = [
    `${data.season.name}: schedule for SportsEngine`,
    '',
    SCHEDULE_REPLACE_WARNING,
    '',
    'How to upload:',
    '1. Import the teams file first (Season Management > Teams Import), so every team in the schedule exists.',
    '2. Open Season Management > Schedule Import and choose the schedule CSV.',
    '3. Turn on "ignore games before today" if it is offered.',
    '4. If practices changed, delete the practice events from the earlier upload before importing.',
    '5. Check a few team pages to confirm games and practices show up.',
    '',
    'Games have Event Type "Game" with a home and away team. Practices are events tied to one team ("Division > Team").',
  ];
  if (options.fromDate) lines.push('', `This file holds only events on or after ${formatDate(options.fromDate)}.`);
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Roster list
// ---------------------------------------------------------------------------

/**
 * Who goes on which team, in the order an admin works through SportsEngine's
 * rostering tool: division, team option, then player last and first name.
 * Waitlisted players and withdrawn registrations are left out.
 */
export function rosterList(data: SeasonData, placements: Placement[]): RosterExportRow[] {
  const index: SeasonIndex = indexSeason(data);
  const order = divisionOrder(data);
  const rows: (RosterExportRow & { sortDivision: number; teamId: ID })[] = [];
  for (const p of placements) {
    if (!p.teamId) continue;
    const reg = index.registration.get(p.registrationId);
    const team = index.team.get(p.teamId);
    if (!reg || reg.status !== 'active' || !team || team.status === 'cancelled') continue;
    const player = index.player.get(reg.playerId);
    const division = index.division.get(team.divisionId);
    if (!player || !division) continue;
    const coach = headCoach(index, team.id);
    const row: RosterExportRow & { sortDivision: number; teamId: ID } = {
      divisionName: division.name,
      teamLabel: team.label,
      teamName: seTeamName(team),
      coachName: coach ? fullName(coach) : '',
      playerFirstName: player.firstName,
      playerLastName: player.lastName,
      playerBirthdate: player.birthdate,
      sortDivision: order.get(division.id) ?? 99,
      teamId: team.id,
    };
    if (reg.externalId) row.externalId = reg.externalId;
    rows.push(row);
  }
  rows.sort(
    (a, b) =>
      a.sortDivision - b.sortDivision ||
      compareStrings(a.teamLabel, b.teamLabel) ||
      compareStrings(a.teamId, b.teamId) ||
      compareStrings(a.playerLastName.toLowerCase(), b.playerLastName.toLowerCase()) ||
      compareStrings(a.playerFirstName.toLowerCase(), b.playerFirstName.toLowerCase()) ||
      compareStrings(a.playerBirthdate, b.playerBirthdate) ||
      compareStrings(a.externalId ?? '', b.externalId ?? ''),
  );
  return rows.map(({ sortDivision: _d, teamId: _t, ...row }) => row);
}

/** The roster list as CSV, for printing or a spreadsheet. */
export function rosterListCsv(rows: readonly RosterExportRow[]): string {
  return toCsv([
    [...ROSTER_LIST_COLUMNS],
    ...rows.map((r) => [
      r.divisionName,
      r.teamLabel,
      r.teamName,
      r.coachName,
      r.playerLastName,
      r.playerFirstName,
      formatScheduleDate(r.playerBirthdate),
      r.externalId ?? '',
    ]),
  ]);
}
