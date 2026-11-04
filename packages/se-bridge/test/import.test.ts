import { describe, expect, it } from 'vitest';
import { fitsAvailability, indexSeason, type Registration, type SeasonData, type TimeWindow } from '@bvac/core';
import {
  applyImport,
  formats,
  importRegistrations,
  parseCsvRecords,
  parseDate,
  parseDateTime,
  parseDays,
  parseDivision,
  parseTeamOption,
  parseTimeRange,
  sampleReportHeaders,
  suggestMapping,
  toCsv,
} from '../src';
import { emptyCopy, sample, sampleReport } from './helpers';

/** Import the sample report into an empty copy of the season. */
function roundTrip() {
  const data = sample();
  const report = sampleReport(data);
  const empty = emptyCopy(data);
  const result = importRegistrations(report.rows, report.mapping, empty, { lineNumbers: report.lineNumbers });
  const merged = applyImport(empty, result);
  return { data, report, empty, result, merged };
}

const uniform = (windows: readonly TimeWindow[]) => windows.every((w) => w.start === windows[0]!.start && w.end === windows[0]!.end);
const NOT_REGISTERED = ['Jordan Pike', 'Ellis Vance', 'Harper Quill', 'Rowan Tate', 'Sky Morrow', 'Finn Ashby'];

describe('round trip: sample export -> import into an empty season', () => {
  const { data, result, merged } = roundTrip();
  const a = indexSeason(data);
  const b = indexSeason(merged);
  const imported = new Map(merged.registrations.map((r) => [r.externalId!, r]));
  const pair = (r: Registration) => imported.get(r.externalId!)!;
  const playerMap = new Map(data.registrations.map((r) => [r.playerId, pair(r).playerId]));

  it('creates one registration per row and skips none', () => {
    expect(result.created).toBe(data.registrations.length);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(0);
    expect(merged.registrations).toHaveLength(data.registrations.length);
    expect(merged.players).toHaveLength(data.players.length);
  });

  it('reports only player requests it could not resolve', () => {
    expect(result.issues.length).toBeGreaterThan(0);
    for (const f of result.issues) {
      expect(f.code).toBe('importIssue');
      expect(f.message).toMatch(/^Row \d+: .*request ".+" (could be|doesn't match)/);
      expect(f.registrationId).toBeTruthy();
    }
  });

  it('brings back the player, guardian and household', () => {
    for (const r of data.registrations) {
      const n = pair(r);
      const p0 = a.player.get(r.playerId)!;
      const p1 = b.player.get(n.playerId)!;
      expect({ ...p1, id: p0.id, householdId: p0.householdId, nickname: p0.nickname }).toEqual(p0);
      const g0 = a.person.get(a.household.get(p0.householdId)!.guardianIds[0]!)!;
      const g1 = b.person.get(b.household.get(p1.householdId)!.guardianIds[0]!)!;
      expect({ ...g1, id: g0.id }).toEqual(g0);
      expect(b.household.get(p1.householdId)!.city).toBe(a.household.get(p0.householdId)!.city);
    }
  });

  it('keeps households together: siblings share a household exactly when they did before', () => {
    const hhMap = new Map<string, string>();
    for (const [p0, p1] of playerMap) {
      const h0 = a.player.get(p0)!.householdId;
      const h1 = b.player.get(p1)!.householdId;
      expect(hhMap.get(h0) ?? h1).toBe(h1);
      hhMap.set(h0, h1);
    }
    expect(new Set(hhMap.values()).size).toBe(hhMap.size);
  });

  it('brings back division, timing, choices, coach request, factors and note', () => {
    for (const r of data.registrations) {
      const n = pair(r);
      expect(n.divisionId).toBe(r.divisionId);
      expect(n.submittedAt).toBe(r.submittedAt);
      expect(n.window).toBe(r.window);
      expect(n.availabilityRequired).toBe(r.availabilityRequired);
      expect(n.source).toBe('sportsengine-csv');
      // The form has 1st and 2nd choice only.
      expect(n.choices).toEqual(r.choices.filter((c) => c.rank <= 2));
      expect(n.coachRequest).toEqual(r.coachRequest);
      // The form asks for the top two factors only.
      expect(n.factorRanking).toEqual(r.factorRanking.slice(0, 2));
      expect(n.note).toBe(r.note);
      expect(n.acceptAnyFittingTeam).toBe(n.choices.length === 0);
    }
  });

  it('keeps which teams fit each family (exactly when the family gave one time range for every day)', () => {
    let nonUniform = 0;
    for (const r of data.registrations) {
      const n = pair(r);
      for (const t of a.teamsByDivision.get(r.divisionId)!) {
        const w = a.practiceSlot.get(t.practiceSlotId)!.window;
        const before = fitsAvailability(w, r.availability);
        const after = fitsAvailability(w, n.availability);
        if (uniform(r.availability)) expect(after, `${r.externalId} ${t.label}`).toBe(before);
        else if (before) expect(after).toBe(true);
      }
      if (!uniform(r.availability)) nonUniform++;
    }
    // Only coaches' kids get a second, different window in the sample.
    expect(nonUniform).toBeLessThan(data.coachAssignments.length);
  });

  it('brings back player requests and matches them at least as well as the seed did', () => {
    let improved = 0;
    for (const r of data.registrations) {
      const n = pair(r);
      expect(n.requests.map((q) => [q.type, q.targetName])).toEqual(r.requests.map((q) => [q.type, q.targetName]));
      r.requests.forEach((q, i) => {
        const m = n.requests[i]!;
        if (q.matchStatus === 'matched') {
          expect(m.matchStatus, q.targetName).toBe('matched');
          expect(m.targetPlayerId).toBe(playerMap.get(q.targetPlayerId!));
        } else if (q.matchStatus === 'ambiguous') {
          expect(m.matchStatus).toBe('ambiguous');
          expect(m.candidatePlayerIds!.length).toBeGreaterThan(1);
        } else if (NOT_REGISTERED.includes(q.targetName)) {
          expect(m.matchStatus).toBe('unmatched');
        } else if (m.matchStatus === 'matched') improved++;
      });
    }
    // The seed's simple matcher misses typos that this one catches.
    expect(improved).toBeGreaterThan(0);
  });

  it('returns self-reported seniority for every row', () => {
    expect(result.selfReported).toHaveLength(data.registrations.length);
    const returning = result.selfReported.filter((s) => (s.seasonsPlayed ?? 0) > 0);
    expect(returning.length).toBe(new Set(data.playerHistory.map((h) => h.playerId)).size);
    // Last season's coach resolves to the person when they coach this season too
    // (former coaches aren't in an empty season).
    const current = new Set(data.coachAssignments.map((c) => c.personId));
    const byReg = new Map(merged.registrations.map((r) => [r.id, r.externalId]));
    const original = new Map(data.registrations.map((r) => [r.externalId, r]));
    let resolved = 0;
    for (const s of result.selfReported) {
      const reg = original.get(byReg.get(s.registrationId))!;
      const last = a.historyByPlayer.get(reg.playerId)?.find((h) => h.seasonOrder === a.lastSeasonOrder)?.coachPersonId;
      if (last && current.has(last)) {
        expect(s.lastSeasonCoachPersonId).toBe(last);
        resolved++;
      } else if (s.lastSeasonCoachPersonId) expect(s.lastSeasonCoachPersonId).toBe(last);
    }
    expect(resolved).toBeGreaterThan(0);
  });

  it('is deterministic', () => {
    expect(roundTrip().result).toEqual(result);
  });
});

describe('re-import', () => {
  it('is idempotent: importing the same file again changes nothing', () => {
    const { report, merged } = roundTrip();
    const again = importRegistrations(report.rows, report.mapping, merged, { lineNumbers: report.lineNumbers });
    expect(again.created).toBe(0);
    expect(again.updated).toBe(0);
    expect(again.unchanged).toBe(report.rows.length);
    expect(again.upserts).toEqual({ people: [], households: [], players: [], registrations: [] });
    expect(applyImport(merged, again)).toEqual(merged);
  });

  it('matches by name and birthdate when there is no registration id', () => {
    const { report, merged } = roundTrip();
    const { externalId: _drop, ...mapping } = report.mapping;
    const again = importRegistrations(report.rows, mapping, merged);
    expect(again.created).toBe(0);
    expect(again.unchanged).toBe(report.rows.length);
  });

  it('updates a changed row in place and keeps ids', () => {
    const { data, report, merged } = roundTrip();
    const index = indexSeason(data);
    const rows = report.rows.map((r) => ({ ...r }));
    const row = rows.find((r) => r[report.mapping.secondChoiceTeam!] && r[report.mapping.playerRequest1Name!])!;
    const ext = row[report.mapping.externalId!]!;
    const before = merged.registrations.find((r) => r.externalId === ext)!;
    const other = index.data.teams.find((t) => t.divisionId === before.divisionId && !before.choices.some((c) => c.teamId === t.id))!;
    const slot = index.practiceSlot.get(other.practiceSlotId)!;
    row[report.mapping.secondChoiceTeam!] = formats.teamOptionLabel(other.label, slot.window, index.field.get(slot.fieldId)!.name);
    row[report.mapping.shirtSize!] = 'Adult Medium';

    const again = importRegistrations(rows, report.mapping, merged);
    expect(again.created).toBe(0);
    expect(again.updated).toBe(1);
    expect(again.upserts.registrations).toHaveLength(1);
    const after = again.upserts.registrations[0]!;
    expect(after.id).toBe(before.id);
    expect(after.choices).toEqual([before.choices[0], { teamId: other.id, rank: 2 }]);
    expect(after.requests).toEqual(before.requests);
    expect(again.upserts.players.map((p) => p.shirtSize)).toEqual(['Adult Medium']);
    const next = applyImport(merged, again);
    expect(next.registrations).toHaveLength(merged.registrations.length);
    expect(next.players).toHaveLength(merged.players.length);
  });

  it('keeps detail added in the companion when the answers are unchanged', () => {
    const { report, merged } = roundTrip();
    const data = structuredClone(merged);
    const baseline = sampleCsvFor(merged);
    const reg = data.registrations.find((r) => r.requests.some((q) => q.matchStatus === 'ambiguous') && r.choices.length === 2)!;
    // An admin confirmed the ambiguous friend, the family ranked a 3rd team and
    // all four factors on the preferences page, and gave exact hours.
    const q = reg.requests.find((x) => x.matchStatus === 'ambiguous')!;
    q.matchStatus = 'confirmed';
    q.targetPlayerId = q.candidatePlayerIds![1]!;
    const third = data.teams.find((t) => t.divisionId === reg.divisionId && !reg.choices.some((c) => c.teamId === t.id))!;
    reg.choices = [...reg.choices, { teamId: third.id, rank: 3 }];
    reg.factorRanking = [...reg.factorRanking.slice(0, 2), ...(['practiceTime', 'coach', 'friends', 'lastTeam'] as const).filter((f) => !reg.factorRanking.slice(0, 2).includes(f))];
    reg.availability = reg.availability.map((w) => ({ ...w, end: w.end + 5 }));
    // Same SportsEngine answers as before.
    expect(sampleCsvFor(data)).toBe(baseline);

    const again = importRegistrations(parseCsvRecords(baseline).rows, report.mapping, data);
    expect(again.created).toBe(0);
    expect(again.updated).toBe(0);
    expect(again.upserts.registrations).toEqual([]);
  });

  it('re-importing into the original sample adds nothing and only improves request matches', () => {
    const data = sample();
    const report = sampleReport(data);
    const again = importRegistrations(report.rows, report.mapping, data);
    expect(again.created).toBe(0);
    expect(again.upserts.people).toEqual([]);
    expect(again.upserts.households).toEqual([]);
    expect(again.upserts.players).toEqual([]);
    const index = indexSeason(data);
    for (const r of again.upserts.registrations) {
      const before = index.registration.get(r.id)!;
      expect({ ...r, requests: before.requests }).toEqual(before);
      r.requests.forEach((q, i) => {
        const old = before.requests[i]!;
        if (old.matchStatus === 'matched' || old.matchStatus === 'confirmed') expect(q).toEqual(old);
        else expect(q.matchStatus).toBe('matched');
      });
    }
  });

  it('treats a repeated row as one registration, last row wins', () => {
    const { data, report } = roundTrip();
    const rows = [report.rows[0]!, { ...report.rows[0]!, [report.mapping.shirtSize!]: 'Youth Large' }];
    const result = importRegistrations(rows, report.mapping, emptyCopy(data));
    expect(result.created).toBe(1);
    expect(result.upserts.registrations).toHaveLength(1);
    expect(result.upserts.players[0]!.shirtSize).toBe('Youth Large');
    expect(result.issues.some((f) => /also appears on row 2/.test(f.message))).toBe(true);
  });
});

/** The sample export for a modified season. */
function sampleCsvFor(data: SeasonData): string {
  return sampleReport(data).csv;
}

describe('import issues', () => {
  const data = sample();
  const headers = sampleReportHeaders(data);
  const mapping = suggestMapping(headers);
  const base = sampleReport(data).rows[0]!;
  const h = (f: Parameters<typeof formats.reportHeader>[0]) => formats.reportHeader(f, data.season);
  const make = (changes: Partial<Record<Parameters<typeof formats.reportHeader>[0], string>>, i: number) => {
    const row: Record<string, string> = { ...base, [h('playerRequest1Name')]: '', [h('playerRequest2Name')]: '', [h('externalId')]: `SE-T${i}`, [h('playerFirstName')]: `Test${'abcdefghij'[i]}`, [h('guardianEmail')]: `t${i}@example.com` };
    for (const [f, v] of Object.entries(changes)) row[h(f as never)] = v!;
    return row;
  };
  const d3 = data.divisions.find((d) => d.code === 'D3')!;
  const d4Team = data.teams.find((t) => t.divisionId === data.divisions.find((d) => d.code === 'D4')!.id)!;
  const rows = [
    make({ playerLastName: '' }, 0),
    make({ playerBirthdate: '13/45/2020' }, 1),
    make({ divisionAnswer: 'Division 9' }, 2),
    make({ divisionAnswer: d3.label, playerBirthdate: '03/01/2019', firstChoiceTeam: 'Option Z · Fri 9–10pm · Field 9' }, 3),
    make({ divisionAnswer: d3.label, playerBirthdate: '03/01/2019', firstChoiceTeam: `D4 ${d4Team.label}`.replace('D4 ', '') + ' · nowhere', coachRequest: 'Coach Nobody' }, 4),
    make({ practiceDays: 'Mon, Funday', practiceTimes: '5:30–6:30pm, whenever', playerGender: '' }, 5),
    make({ submittedAt: 'soon', onlyTheseDays: 'maybe', mostImportant: 'Snacks' }, 6),
    make({ playerRequest1Name: 'Nobody Atall', playerRequest1Type: 'cousin' }, 7),
  ];
  const result = importRegistrations(rows, mapping, emptyCopy(data));
  const at = (row: number) => result.issues.filter((f) => f.message.startsWith(`Row ${row}:`)).map((f) => f.message);

  it('skips rows without a name or a readable birthdate', () => {
    expect(result.skipped).toBe(2);
    expect(at(2)).toEqual([expect.stringMatching(/first and last name are required; row skipped/)]);
    expect(at(3)).toEqual([expect.stringMatching(/birthdate "13\/45\/2020" isn't a date; row skipped/)]);
    expect(result.created).toBe(rows.length - 2);
  });

  it('falls back to the birthdate for an unknown division', () => {
    expect(at(4)).toEqual([expect.stringMatching(/division answer "Division 9" not recognized; placed in Division 2 from the birthdate/)]);
  });

  it('flags team options and coaches it cannot find', () => {
    expect(at(5).join('\n')).toMatch(/1st choice "Option Z · Fri 9–10pm · Field 9" doesn't match a team option in Division 3/);
    expect(at(6).join('\n')).toMatch(/coach request "Coach Nobody" doesn't match a coach/);
  });

  it('flags unreadable answers and keeps what it can', () => {
    expect(at(7)).toEqual([
      expect.stringMatching(/gender "" not recognized; set to M/),
      expect.stringMatching(/practice day\(s\) not recognized: Funday/),
      expect.stringMatching(/practice time\(s\) not recognized: whenever/),
    ]);
    expect(at(8)).toEqual([
      expect.stringMatching(/registration date "soon" not recognized; treated as the end of the regular window/),
      expect.stringMatching(/"only these days" answer "maybe" not recognized/),
      expect.stringMatching(/"what matters most" answer "Snacks" not recognized/),
    ]);
    expect(at(9)).toEqual([
      expect.stringMatching(/request 1 type "cousin" not recognized; treated as Friend/),
      expect.stringMatching(/friend request "Nobody Atall" doesn't match a registered player in Division 2/),
    ]);
  });

  it('ties every issue on an imported row to its registration', () => {
    for (const f of result.issues) {
      if (/row skipped/.test(f.message)) expect(f.registrationId).toBeUndefined();
      else expect(result.upserts.registrations.some((r) => r.id === f.registrationId)).toBe(true);
    }
  });

  it('accepts a minimal export with only names, birthdate and division', () => {
    const csv = toCsv([
      ['First Name', 'Last Name', 'DOB', 'Grade'],
      ['Ava', 'Testing', '2019-03-01', '1st and 2nd grade'],
    ]);
    const { headers: hs, rows: rs } = parseCsvRecords(csv);
    const r = importRegistrations(rs, suggestMapping(hs), emptyCopy(data));
    expect(r.created).toBe(1);
    const reg = r.upserts.registrations[0]!;
    expect(reg.divisionId).toBe(d3.id);
    expect(reg.choices).toEqual([]);
    expect(reg.acceptAnyFittingTeam).toBe(true);
    expect(reg.availabilityRequired).toBe(false);
  });
});

describe('answer parsing', () => {
  it('reads practice time ranges in many spellings', () => {
    expect(parseTimeRange('5:30–6:30pm')).toEqual({ start: 1050, end: 1110 });
    expect(parseTimeRange('5:30 PM - 6:30 PM')).toEqual({ start: 1050, end: 1110 });
    expect(parseTimeRange('17:30-18:30')).toEqual({ start: 1050, end: 1110 });
    expect(parseTimeRange('5-6')).toEqual({ start: 1020, end: 1080 });
    expect(parseTimeRange('6:15–7pm')).toEqual({ start: 1095, end: 1140 });
    expect(parseTimeRange('11:30am–12:30pm')).toEqual({ start: 690, end: 750 });
    expect(parseTimeRange('11:30–12:30pm')).toEqual({ start: 690, end: 750 });
    expect(parseTimeRange('5 to 6 pm')).toEqual({ start: 1020, end: 1080 });
    expect(parseTimeRange('whenever')).toBeUndefined();
    expect(parseTimeRange('7–6pm')).toEqual({ start: 420, end: 1080 });
    expect(parseTimeRange('8pm–7pm')).toBeUndefined();
  });

  it('reads dates and timestamps', () => {
    expect(parseDate('03/14/2019')).toBe('2019-03-14');
    expect(parseDate('3/4/19')).toBe('2019-03-04');
    expect(parseDate('2019-03-14')).toBe('2019-03-14');
    expect(parseDate('02/30/2019')).toBeUndefined();
    expect(parseDateTime('01/05/2027 07:42 PM')).toBe('2027-01-05T19:42:00-06:00');
    expect(parseDateTime('1/5/2027 12:05 AM')).toBe('2027-01-05T00:05:00-06:00');
    expect(parseDateTime('2027-01-05 19:42')).toBe('2027-01-05T19:42:00-06:00');
    expect(parseDateTime('2027-01-05T19:42:00-06:00')).toBe('2027-01-05T19:42:00-06:00');
    expect(parseDateTime('01/05/2027')).toBe('2027-01-05T00:00:00-06:00');
  });

  it('reads days', () => {
    expect(parseDays('Mon, Tue; thursday|FRI')).toEqual({ days: ['mon', 'tue', 'thu', 'fri'], unknown: [] });
    expect(parseDays('Tues, Weds, Thurs')).toEqual({ days: ['tue', 'wed', 'thu'], unknown: [] });
  });

  it('reads the division answer in several forms', () => {
    const data = sample();
    const d3 = data.divisions.find((d) => d.code === 'D3')!;
    for (const answer of ['1st and 2nd grade', 'Division 3', 'Div 3', 'D3', 'Division 3 - 1st and 2nd grade']) {
      expect(parseDivision(data, answer)?.id, answer).toBe(d3.id);
    }
    expect(parseDivision(data, 'Division 9')).toBeUndefined();
  });

  it('reads team options by full text, label, or label with other separators', () => {
    const data = sample();
    const index = indexSeason(data);
    const team = data.teams.find((t) => t.label === 'Option C' && t.divisionId === 'div_d3')!;
    for (const answer of ['Option C · Tue 5:30–6:30pm · Field 3', 'option c', 'Option C - Tue 5:30-6:30 · Field 3', 'Option C | Tuesday']) {
      expect(parseTeamOption(index, 'div_d3', answer)?.id, answer).toBe(team.id);
    }
    expect(parseTeamOption(index, 'div_d3', 'Option Q')).toBeUndefined();
  });
});
