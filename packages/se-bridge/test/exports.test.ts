import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compareStrings, type Placement, type SeasonData } from '@bvac/core';
import { buildSeasonSchedules } from '@bvac/schedule';
import {
  exportScheduleCsv,
  exportTeamsCsv,
  formats,
  parseCsv,
  parseCsvRecords,
  questionPack,
  questionPackItems,
  rosterList,
  rosterListCsv,
  sampleReportHeaders,
  sampleSportsEngineExport,
  scheduleImportReadme,
  scheduleImportRows,
} from '../src';
import { sample } from './helpers';

function withGames(): SeasonData {
  const data = sample();
  data.games = buildSeasonSchedules(data).flatMap((r) => r.games);
  return data;
}

/** Everyone on their 1st choice when they have one, otherwise waitlisted. */
function firstChoicePlacements(data: SeasonData): Placement[] {
  return data.registrations.map((r) => {
    const first = r.choices.find((c) => c.rank === 1);
    return {
      registrationId: r.id,
      teamId: first?.teamId ?? null,
      round: first ? 1 : null,
      state: first ? 'projected' : 'waitlisted',
      locked: false,
      choiceRankMet: first ? 1 : null,
      reasons: [],
    };
  });
}

describe('sample Saved Report', () => {
  it('has the headers from formats.ts, in order', () => {
    const data = sample();
    expect(sampleReportHeaders(data)).toMatchInlineSnapshot(`
      [
        "Registration ID",
        "Registration Date",
        "Registration Status",
        "Player First Name",
        "Player Last Name",
        "Player Date of Birth",
        "Player Gender",
        "What age/grade is the player during the 2026-27 school year?",
        "Shirt Size",
        "Parent/Guardian First Name",
        "Parent/Guardian Last Name",
        "Parent/Guardian Email",
        "Parent/Guardian Phone",
        "City",
        "State",
        "Practice days available",
        "Are these the only days that work?",
        "Practice times available",
        "1st choice team",
        "2nd choice team",
        "Coach request",
        "Player request 1",
        "Sibling or friend? (1)",
        "Player request 2",
        "Sibling or friend? (2)",
        "What matters most? (1st)",
        "What matters most? (2nd)",
        "Seasons played at BVAC",
        "Last season's coach",
        "Request",
        "Amount Paid",
        "Waiver Accepted",
      ]
    `);
  });

  it('writes answers in display form, one row per registration in submission order', () => {
    const data = sample();
    const { rows } = parseCsvRecords(sampleSportsEngineExport(data));
    expect(rows).toHaveLength(data.registrations.filter((r) => r.status === 'active').length);
    const dates = rows.map((r) => r['Registration Date']!);
    expect(dates.every((d) => /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} [AP]M$/.test(d))).toBe(true);
    const choices = rows.map((r) => r['1st choice team']).filter(Boolean);
    expect(choices.every((c) => /^Option [A-Z] · (Mon|Tue|Wed|Thu|Fri) \d{1,2}(:\d{2})?–\d{1,2}(:\d{2})?(am|pm) · Field \d$/.test(c!))).toBe(true);
    expect(rows.every((r) => r['Parent/Guardian Email']!.endsWith('@example.com'))).toBe(true);
    expect(rows.every((r) => /555/.test(r['Parent/Guardian Phone']!))).toBe(true);
    expect(rows[0]).toMatchSnapshot();
  });

  it('matches the committed fixture (run `pnpm --filter @bvac/se-bridge fixture` after changing formats or the seed)', () => {
    const file = fileURLToPath(new URL('../fixtures/sportsengine-saved-report.csv', import.meta.url));
    expect(readFileSync(file, 'utf8')).toBe(sampleSportsEngineExport(sample()));
  });
});

describe('exportTeamsCsv', () => {
  it('writes one row per team option in division order (column snapshot)', async () => {
    const data = sample();
    const csv = exportTeamsCsv(data, data.teams);
    const table = parseCsv(csv);
    expect(table[0]).toEqual([...formats.TEAMS_IMPORT_COLUMNS]);
    expect(table).toHaveLength(data.teams.length + 1);
    await expect(csv).toMatchFileSnapshot('__snapshots__/teams-import.csv');
  });

  it('leaves out cancelled teams and uses the rostered team name once there is one', () => {
    const data = sample();
    data.teams[0]!.status = 'cancelled';
    data.teams[1]!.name = 'Blue Comets';
    const rows = parseCsvRecords(exportTeamsCsv(data, data.teams)).rows;
    expect(rows).toHaveLength(data.teams.length - 1);
    expect(rows.some((r) => r['External Team ID'] === data.teams[0]!.id)).toBe(false);
    expect(rows.find((r) => r['External Team ID'] === data.teams[1]!.id)!['Team Name']).toBe('Blue Comets');
  });
});

describe('exportScheduleCsv', () => {
  const data = withGames();
  const rows = scheduleImportRows(data, data.teams, data.games);

  it('has the configured columns (column snapshot)', async () => {
    const csv = exportScheduleCsv(data, data.teams, data.games);
    expect(parseCsv(csv)[0]).toEqual([...formats.SCHEDULE_IMPORT_COLUMNS]);
    await expect(csv).toMatchFileSnapshot('__snapshots__/schedule-import.csv');
  });

  it('writes every game with Event Type Game and a home and away team', () => {
    const games = rows.filter((r) => r['Event Type'] === 'Game');
    expect(games).toHaveLength(data.games.length);
    for (const g of games) {
      expect(g['Home Team']).toMatch(/^Division \d > Option [A-Z]$/);
      expect(g['Away Team']).toMatch(/^Division \d > Option [A-Z]$/);
      expect(g['Home Team']).not.toBe(g['Away Team']);
      expect(g.Teams).toBe('');
    }
  });

  it('writes weekly practices as events tied to "Division > Team"', () => {
    const practices = rows.filter((r) => r['Event Type'] === formats.SCHEDULE_EVENT_TYPES.practice);
    // About 9 weeks between Mar 22 and May 22 for every team.
    expect(practices.length).toBeGreaterThanOrEqual(data.teams.length * 8);
    const index = new Map(data.teams.map((t) => [t.id, t]));
    for (const p of practices) {
      expect(p['Event Name']).toBe('Practice');
      expect(p.Teams).toMatch(/^Division \d > Option [A-Z]$/);
      expect(p['Home Team']).toBe('');
      expect(p['Event ID']).toMatch(/^prac_/);
      expect(index.has(p['Event ID']!.split('_').slice(1, 3).join('_'))).toBe(true);
    }
  });

  it('is sorted by date and time', () => {
    const keys = rows.map((r) => {
      const [m, d, y] = r['Start Date']!.split('/');
      return `${y}-${m}-${d}`;
    });
    expect([...keys].sort(compareStrings)).toEqual(keys);
  });

  it('skips games whose schedule position has no team, and events before fromDate', () => {
    const teams = data.teams.filter((t) => t.id !== data.teams[0]!.id);
    const fewer = scheduleImportRows(data, teams, data.games);
    expect(fewer.filter((r) => r['Event Type'] === 'Game').length).toBeLessThan(data.games.length);
    const later = scheduleImportRows(data, data.teams, data.games, { fromDate: '2027-05-01' });
    expect(later.length).toBeGreaterThan(0);
    expect(later.every((r) => r['Start Date']! >= '05/01/2027')).toBe(true);
  });

  it('comes with the replace-all warning', () => {
    const readme = scheduleImportReadme(data, { fromDate: '2027-05-01' });
    expect(readme).toContain(formats.SCHEDULE_REPLACE_WARNING);
    expect(readme).toMatch(/ignore games before today/);
    expect(readme).toContain('Sat May 1');
    // The default places the warning in the README, not inside the CSV.
    expect(formats.SCHEDULE_WARNING_PLACEMENT).toBe('readme');
    expect(exportScheduleCsv(data, data.teams, data.games).startsWith('Event Type,')).toBe(true);
  });
});

describe('rosterList', () => {
  const data = sample();
  const placements = firstChoicePlacements(data);
  const rows = rosterList(data, placements);

  it('lists every placed, active player once and leaves out the waitlist', () => {
    expect(rows).toHaveLength(placements.filter((p) => p.teamId).length);
    const withdrawn = structuredClone(data);
    const placed = placements.find((p) => p.teamId)!;
    withdrawn.registrations.find((r) => r.id === placed.registrationId)!.status = 'withdrawn';
    expect(rosterList(withdrawn, placements)).toHaveLength(rows.length - 1);
  });

  it('sorts by division, team, then player last name', () => {
    const order = new Map(data.divisions.map((d) => [d.name, d.sortOrder]));
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1]!;
      const b = rows[i]!;
      const cmp =
        order.get(a.divisionName)! - order.get(b.divisionName)! ||
        compareStrings(a.teamLabel, b.teamLabel) ||
        compareStrings(a.playerLastName.toLowerCase(), b.playerLastName.toLowerCase());
      expect(cmp).toBeLessThanOrEqual(0);
    }
  });

  it('carries coach, birthdate and SportsEngine id (column snapshot)', () => {
    expect(rows[0]).toMatchSnapshot();
    const csv = rosterListCsv(rows);
    expect(parseCsv(csv)[0]).toEqual([...formats.ROSTER_LIST_COLUMNS]);
    expect(parseCsv(csv).slice(0, 4)).toMatchSnapshot();
  });
});

describe('questionPack', () => {
  const data = sample();
  const items = questionPackItems(data);

  it('asks the seven questions, titled exactly like the report headers', () => {
    const titles = items.map((q) => q.title);
    for (const f of ['practiceDays', 'onlyTheseDays', 'practiceTimes', 'firstChoiceTeam', 'secondChoiceTeam', 'coachRequest', 'playerRequest1Name', 'playerRequest1Type', 'mostImportant', 'seasonsPlayed', 'lastSeasonCoach'] as const) {
      expect(titles).toContain(formats.reportHeader(f, data.season));
    }
    expect(items.find((q) => q.field === 'practiceDays')!.type).toBe('checkbox');
    expect(items.find((q) => q.field === 'onlyTheseDays')!.type).toBe('radio');
    expect(items.find((q) => q.field === 'firstChoiceTeam')!.type).toBe('pulldown');
    expect(items.find((q) => q.field === 'playerRequest1Name')!.type).toBe('text');
  });

  it('lists each division’s team options behind conditional logic, with seat limits for first come, first served', () => {
    const first = items.find((q) => q.field === 'firstChoiceTeam')!;
    expect(first.byDivision).toHaveLength(data.divisions.length);
    for (const d of first.byDivision!) {
      const division = data.divisions.find((x) => x.id === d.divisionId)!;
      expect(d.options).toHaveLength(data.teams.filter((t) => t.divisionId === d.divisionId).length);
      expect(d.showWhen).toContain(division.label);
      const fcfs = division.settings.model === 'fcfs';
      for (const o of d.options) expect(o.seatLimit).toBe(fcfs ? division.settings.teamSize.max : undefined);
    }
    expect(data.divisions.some((d) => d.settings.model === 'fcfs')).toBe(true);
  });

  it('renders as text (snapshot)', async () => {
    const text = questionPack(data);
    expect(text).toContain('Option C · Tue 5:30–6:30pm · Field 3');
    expect(text).toContain('[seat limit: 10]');
    await expect(text).toMatchFileSnapshot('__snapshots__/question-pack.txt');
  });
});
