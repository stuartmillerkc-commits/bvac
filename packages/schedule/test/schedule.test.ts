import { describe, expect, it } from 'vitest';
import type { GameTimeStyle, SeasonData } from '@bvac/core';
import { buildSchedule, buildSeasonSchedules } from '../src';
import { activeTrackIds, headCoachByTrack, sample, slotMap, timeCounts, unconstrained } from './helpers';

const STYLES: GameTimeStyle[] = ['anchored', 'rotating'];

function eachDivision(data: SeasonData, style: GameTimeStyle) {
  return data.divisions.map((d) => ({ division: d, result: buildSchedule({ data, divisionId: d.id, style }) }));
}

describe('round robin', () => {
  it.each(STYLES)('every pair of tracks meets at least once (%s)', (style) => {
    const data = sample();
    for (const { division, result } of eachDivision(data, style)) {
      const tracks = data.gameTracks.filter((t) => t.divisionId === division.id).map((t) => t.id);
      const met = new Set(result.games.map((g) => [g.homeTrackId, g.awayTrackId].sort().join('|')));
      for (let i = 0; i < tracks.length; i++) {
        for (let j = i + 1; j < tracks.length; j++) {
          expect(met.has([tracks[i]!, tracks[j]!].sort().join('|')), `${division.code}: ${tracks[i]} vs ${tracks[j]}`).toBe(true);
        }
      }
      expect(result.flags.some((f) => f.message.startsWith('Not enough game dates'))).toBe(false);
    }
  });

  it('plays a full round robin, then repeats, with games spread evenly', () => {
    const data = sample();
    for (const { division, result } of eachDivision(data, 'anchored')) {
      const tracks = data.gameTracks.filter((t) => t.divisionId === division.id);
      const n = tracks.length;
      const perWeek = Math.floor(n / 2);
      expect(result.games.length).toBe(perWeek * data.season.gameDates.length);
      const played = timeCounts(data, result.games);
      const totals = tracks.map((t) => [...(played.get(t.id)?.values() ?? [])].reduce((a, b) => a + b, 0));
      expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(1);
      // Every pair meets once or twice in 7 weeks, never three times.
      const meetings = new Map<string, number>();
      for (const g of result.games) {
        const key = [g.homeTrackId, g.awayTrackId].sort().join('|');
        meetings.set(key, (meetings.get(key) ?? 0) + 1);
      }
      expect(Math.max(...meetings.values())).toBeLessThanOrEqual(Math.ceil(data.season.gameDates.length / (n % 2 ? n : n - 1)));
    }
  });

  it('flags pairs that never meet when there are too few dates', () => {
    const data = sample();
    data.season.gameDates = data.season.gameDates.slice(0, 3);
    const d3 = data.divisions.find((d) => d.code === 'D3')!;
    const result = buildSchedule({ data, divisionId: d3.id, style: 'rotating' });
    expect(result.games.length).toBe(9);
    expect(result.flags.some((f) => f.severity === 'info' && f.message.startsWith('Not enough game dates'))).toBe(true);
  });

  it('balances home and away', () => {
    const data = sample();
    for (const { result } of eachDivision(data, 'rotating')) {
      const homes = new Map<string, number>();
      const totals = new Map<string, number>();
      for (const g of result.games) {
        homes.set(g.homeTrackId, (homes.get(g.homeTrackId) ?? 0) + 1);
        for (const t of [g.homeTrackId, g.awayTrackId]) totals.set(t, (totals.get(t) ?? 0) + 1);
      }
      for (const [t, total] of totals) expect(Math.abs(2 * (homes.get(t) ?? 0) - total)).toBeLessThanOrEqual(1);
    }
  });
});

describe('slots', () => {
  it.each(STYLES)('never double-books a slot or a track on a date (%s)', (style) => {
    const data = sample();
    const slots = slotMap(data);
    const gameDates = new Set(data.season.gameDates);
    for (const { division, result } of eachDivision(data, style)) {
      const usedSlots = new Set<string>();
      const trackDates = new Set<string>();
      for (const g of result.games) {
        const slot = slots.get(g.gameSlotId)!;
        expect(slot.divisionId).toBe(division.id);
        expect(slot.isMakeup).toBe(false);
        expect(gameDates.has(slot.date)).toBe(true);
        expect(g.homeTrackId).not.toBe(g.awayTrackId);
        expect(usedSlots.has(g.gameSlotId)).toBe(false);
        usedSlots.add(g.gameSlotId);
        for (const t of [g.homeTrackId, g.awayTrackId]) {
          const key = `${t}@${slot.date}`;
          expect(trackDates.has(key), key).toBe(false);
          trackDates.add(key);
        }
      }
    }
  });

  it('keeps makeup dates open', () => {
    const data = sample();
    const slots = slotMap(data);
    for (const { result } of eachDivision(data, 'anchored')) {
      for (const g of result.games) expect(data.season.makeupDates).not.toContain(slots.get(g.gameSlotId)!.date);
    }
  });

  it('flags games that have no slot instead of double-booking', () => {
    const data = sample();
    const d3 = data.divisions.find((d) => d.code === 'D3')!;
    const date = data.season.gameDates[2]!;
    // Leave only 2 slots on one date for 3 games.
    const onDate = data.gameSlots.filter((s) => s.divisionId === d3.id && s.date === date);
    const drop = new Set(onDate.slice(2).map((s) => s.id));
    data.gameSlots = data.gameSlots.filter((s) => !drop.has(s.id));
    const result = buildSchedule({ data, divisionId: d3.id, style: 'anchored' });
    const slots = slotMap(data);
    const used = result.games.filter((g) => slots.get(g.gameSlotId)!.date === date);
    expect(used.length).toBe(2);
    expect(new Set(used.map((g) => g.gameSlotId)).size).toBe(2);
    expect(result.flags.some((f) => f.severity === 'critical' && f.message.includes('not scheduled'))).toBe(true);
  });
});

describe('byes', () => {
  it('gives each track in an odd division the same number of byes, spread out', () => {
    const data = unconstrained();
    // D1 has 5 positions; stretch the season to 12 dates so everyone sits out twice or more.
    const first = data.season.gameDates[0]!;
    const dates = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(`${first}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 7 * i);
      return d.toISOString().slice(0, 10);
    });
    const d1 = data.divisions.find((d) => d.code === 'D1')!;
    const template = data.gameSlots.filter((s) => s.divisionId === d1.id && s.date === first);
    data.season.gameDates = dates;
    data.gameSlots = [
      ...data.gameSlots.filter((s) => s.divisionId !== d1.id),
      ...dates.flatMap((date, i) => template.map((s) => ({ ...s, id: `${s.id}_w${i}`, date }))),
    ];
    for (const style of STYLES) {
      const result = buildSchedule({ data, divisionId: d1.id, style });
      const slots = slotMap(data);
      const tracks = result.tracks.map((t) => t.id);
      const byes = new Map(tracks.map((t) => [t, [] as number[]]));
      dates.forEach((date, i) => {
        const playing = new Set(result.games.filter((g) => slots.get(g.gameSlotId)!.date === date).flatMap((g) => [g.homeTrackId, g.awayTrackId]));
        const out = tracks.filter((t) => !playing.has(t));
        expect(out.length).toBe(1);
        for (const t of out) byes.get(t)!.push(i);
      });
      const counts = [...byes.values()].map((b) => b.length);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
      for (const b of byes.values()) {
        for (let i = 1; i < b.length; i++) expect(b[i]! - b[i - 1]!).toBeGreaterThanOrEqual(tracks.length - 1);
      }
      for (const t of result.tracks) {
        const n = byes.get(t.id)!.length;
        expect(t.description).toContain(n === 1 ? 'bye ' : 'byes ');
      }
    }
  });

  it('puts an odd division’s bye on a coach’s blackout date when it can', () => {
    const data = unconstrained();
    const d1 = data.divisions.find((d) => d.code === 'D1')!;
    const heads = headCoachByTrack(data);
    const track = data.gameTracks.find((t) => t.divisionId === d1.id && t.position === 3)!;
    const date = data.season.gameDates[1]!;
    data.coachAvailability.find((a) => a.personId === heads.get(track.id))!.blackoutDates = [date];
    const result = buildSchedule({ data, divisionId: d1.id, style: 'anchored' });
    const slots = slotMap(data);
    const plays = result.games.some((g) => slots.get(g.gameSlotId)!.date === date && (g.homeTrackId === track.id || g.awayTrackId === track.id));
    expect(plays).toBe(false);
    expect(result.flags.filter((f) => f.message.includes('is away'))).toEqual([]);
  });

  it('flags a blackout date it cannot avoid', () => {
    const data = unconstrained();
    const d4 = data.divisions.find((d) => d.code === 'D4')!; // 6 teams: no byes
    const heads = headCoachByTrack(data);
    const track = data.gameTracks.find((t) => t.divisionId === d4.id && t.position === 2)!;
    const team = data.teams.find((t) => t.gameTrackId === track.id)!;
    const date = data.season.gameDates[3]!;
    data.coachAvailability.find((a) => a.personId === heads.get(track.id))!.blackoutDates = [date];
    const result = buildSchedule({ data, divisionId: d4.id, style: 'anchored' });
    const flag = result.flags.find((f) => f.message.includes('is away'));
    expect(flag?.teamId).toBe(team.id);
    expect(flag?.severity).toBe('warning');
  });
});

describe('time balance', () => {
  it('anchored: each track plays at least 60% of its games at its home time', () => {
    const data = unconstrained();
    for (const { division, result } of eachDivision(data, 'anchored')) {
      for (const [track, row] of timeCounts(data, result.games)) {
        const total = [...row.values()].reduce((a, b) => a + b, 0);
        const home = Math.max(...row.values());
        expect(home / total, `${division.code} ${track}`).toBeGreaterThanOrEqual(0.6);
      }
    }
  });

  it('anchored: tracks do not all share one time, and off-time games are few', () => {
    const data = unconstrained();
    for (const { division, result } of eachDivision(data, 'anchored')) {
      const rows = timeCounts(data, result.games);
      const homes = new Set([...rows.values()].map((row) => [...row.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]![0]));
      expect(homes.size, division.code).toBeGreaterThan(1);
      for (const row of rows.values()) {
        const total = [...row.values()].reduce((a, b) => a + b, 0);
        expect(total - Math.max(...row.values())).toBeLessThanOrEqual(3);
      }
    }
  });

  it('rotating: for every time, track counts differ by at most 1', () => {
    const data = unconstrained();
    for (const { division, result } of eachDivision(data, 'rotating')) {
      const rows = timeCounts(data, result.games);
      const times = new Set([...rows.values()].flatMap((row) => [...row.keys()]));
      for (const time of times) {
        const counts = activeTrackIds(result).map((t) => rows.get(t)?.get(time) ?? 0);
        expect(Math.max(...counts) - Math.min(...counts), `${division.code} at ${time}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('rotating: each track plays at more than one time', () => {
    const data = unconstrained();
    for (const { result } of eachDivision(data, 'rotating')) {
      for (const row of timeCounts(data, result.games).values()) expect(row.size).toBeGreaterThan(1);
    }
  });
});

describe('coach constraints', () => {
  it.each(STYLES)('honors game-time limits or flags them (sample season, %s)', (style) => {
    const data = sample();
    const slots = slotMap(data);
    const heads = headCoachByTrack(data);
    const avail = new Map(data.coachAvailability.map((a) => [a.personId, a]));
    const teamByTrack = new Map(data.teams.filter((t) => t.gameTrackId).map((t) => [t.gameTrackId!, t]));
    for (const { division, result } of eachDivision(data, style)) {
      const divisionStarts = data.gameSlots.filter((s) => s.divisionId === division.id).map((s) => s.start);
      for (const g of result.games) {
        const slot = slots.get(g.gameSlotId)!;
        for (const track of [g.homeTrackId, g.awayTrackId]) {
          const a = avail.get(heads.get(track) ?? '');
          if (!a) continue;
          const tooEarly = a.gamesNotBefore !== undefined && slot.start < a.gamesNotBefore;
          const tooLate = a.gamesNotAfter !== undefined && slot.start > a.gamesNotAfter;
          if (!tooEarly && !tooLate) continue;
          // In the sample season this only happens when no slot in the division works, and it is flagged.
          const anyOk = divisionStarts.some(
            (m) => (a.gamesNotBefore === undefined || m >= a.gamesNotBefore) && (a.gamesNotAfter === undefined || m <= a.gamesNotAfter),
          );
          expect(anyOk, `${division.code} ${track}: a workable slot existed`).toBe(false);
          const flagged = result.flags.some((f) => f.code === 'scheduleConflict' && f.teamId === teamByTrack.get(track)!.id && /can't (start|do) games/.test(f.message));
          expect(flagged, `${division.code} ${track} at ${slot.start}`).toBe(true);
        }
      }
      // Blackouts are flagged unless the track has a bye that day.
      for (const [track, person] of heads) {
        const a = avail.get(person);
        if (!a || !result.tracks.some((t) => t.id === track)) continue;
        for (const date of a.blackoutDates) {
          const plays = result.games.some((g) => slots.get(g.gameSlotId)!.date === date && (g.homeTrackId === track || g.awayTrackId === track));
          if (plays) expect(result.flags.some((f) => f.teamId === teamByTrack.get(track)!.id && f.message.includes('is away'))).toBe(true);
        }
      }
    }
  });

  it('keeps a coach who cannot start before 10am at 10am', () => {
    const data = unconstrained();
    const d3 = data.divisions.find((d) => d.code === 'D3')!;
    const heads = headCoachByTrack(data);
    const track = data.gameTracks.find((t) => t.divisionId === d3.id && t.position === 1)!;
    data.coachAvailability.find((a) => a.personId === heads.get(track.id))!.gamesNotBefore = 600;
    for (const style of STYLES) {
      const result = buildSchedule({ data, divisionId: d3.id, style });
      expect([...timeCounts(data, result.games).get(track.id)!.keys()]).toEqual([600]);
      expect(result.flags.filter((f) => f.severity !== 'info')).toEqual([]);
    }
  });

  it('honors several coaches’ limits at once when they are compatible', () => {
    const data = unconstrained();
    const d3 = data.divisions.find((d) => d.code === 'D3')!;
    const heads = headCoachByTrack(data);
    const tracks = data.gameTracks.filter((t) => t.divisionId === d3.id);
    const set = (i: number, patch: { gamesNotBefore?: number; gamesNotAfter?: number }) =>
      Object.assign(data.coachAvailability.find((a) => a.personId === heads.get(tracks[i]!.id))!, patch);
    set(0, { gamesNotBefore: 540 }); // 9 or 10
    set(1, { gamesNotBefore: 540 });
    set(3, { gamesNotAfter: 540 }); // 8 or 9
    set(4, { gamesNotAfter: 540 });
    for (const style of STYLES) {
      const result = buildSchedule({ data, divisionId: d3.id, style });
      const rows = timeCounts(data, result.games);
      for (const i of [0, 1]) for (const m of rows.get(tracks[i]!.id)!.keys()) expect(m).toBeGreaterThanOrEqual(540);
      for (const i of [3, 4]) for (const m of rows.get(tracks[i]!.id)!.keys()) expect(m).toBeLessThanOrEqual(540);
      expect(result.flags.filter((f) => f.severity !== 'info')).toEqual([]);
    }
  });

  it('flags two limits that clash when those teams meet', () => {
    const data = unconstrained();
    const d3 = data.divisions.find((d) => d.code === 'D3')!;
    const heads = headCoachByTrack(data);
    const tracks = data.gameTracks.filter((t) => t.divisionId === d3.id);
    data.coachAvailability.find((a) => a.personId === heads.get(tracks[0]!.id))!.gamesNotBefore = 600;
    data.coachAvailability.find((a) => a.personId === heads.get(tracks[3]!.id))!.gamesNotAfter = 480;
    const result = buildSchedule({ data, divisionId: d3.id, style: 'anchored' });
    const warnings = result.flags.filter((f) => f.severity === 'warning');
    expect(warnings.length).toBe(1);
    expect(warnings[0]!.message).toMatch(/can't (start|do) games/);
  });

  it('flags a limit no slot can meet', () => {
    const data = unconstrained();
    const d1 = data.divisions.find((d) => d.code === 'D1')!; // games at 8:00 and 8:45 only
    const heads = headCoachByTrack(data);
    const track = data.gameTracks.find((t) => t.divisionId === d1.id && t.position === 1)!;
    data.coachAvailability.find((a) => a.personId === heads.get(track.id))!.gamesNotBefore = 540;
    const result = buildSchedule({ data, divisionId: d1.id, style: 'rotating' });
    const flag = result.flags.find((f) => f.message.includes('every game slot in this division'));
    expect(flag?.teamId).toBe(data.teams.find((t) => t.gameTrackId === track.id)!.id);
  });

  it('never overlaps games for a person coaching two teams in one division', () => {
    const data = unconstrained();
    const d3 = data.divisions.find((d) => d.code === 'D3')!;
    const teams = data.teams.filter((t) => t.divisionId === d3.id);
    const coach = data.coachAssignments.find((c) => c.teamId === teams[0]!.id && c.role === 'head')!;
    const second = data.coachAssignments.find((c) => c.teamId === teams[1]!.id && c.role === 'head')!;
    second.personId = coach.personId;
    const slots = slotMap(data);
    for (const style of STYLES) {
      const result = buildSchedule({ data, divisionId: d3.id, style });
      for (const date of data.season.gameDates) {
        const mine = result.games.filter(
          (g) => slots.get(g.gameSlotId)!.date === date && [teams[0]!.gameTrackId, teams[1]!.gameTrackId].some((t) => t === g.homeTrackId || t === g.awayTrackId),
        );
        if (mine.length === 2) expect(slots.get(mine[0]!.gameSlotId)!.start).not.toBe(slots.get(mine[1]!.gameSlotId)!.start);
      }
      expect(result.flags.filter((f) => f.severity === 'critical')).toEqual([]);
    }
  });

  it('never overlaps games for a person coaching teams in two divisions', () => {
    const data = unconstrained();
    const d3 = data.divisions.find((d) => d.code === 'D3')!;
    const d4 = data.divisions.find((d) => d.code === 'D4')!;
    const t3 = data.teams.find((t) => t.divisionId === d3.id)!;
    const t4 = data.teams.find((t) => t.divisionId === d4.id)!;
    const coach = data.coachAssignments.find((c) => c.teamId === t3.id && c.role === 'head')!;
    data.coachAssignments.push({ id: 'coach_test_extra', personId: coach.personId, teamId: t4.id, role: 'assistant', protectedPlayerIds: [] });
    const results = buildSeasonSchedules(data);
    const games = results.flatMap((r) => r.games);
    const slots = slotMap(data);
    for (const date of data.season.gameDates) {
      const g3 = games.find((g) => slots.get(g.gameSlotId)!.date === date && (g.homeTrackId === t3.gameTrackId || g.awayTrackId === t3.gameTrackId))!;
      const g4 = games.find((g) => slots.get(g.gameSlotId)!.date === date && (g.homeTrackId === t4.gameTrackId || g.awayTrackId === t4.gameTrackId))!;
      const a = slots.get(g3.gameSlotId)!;
      const b = slots.get(g4.gameSlotId)!;
      const overlap = a.start < b.start + b.durationMin && b.start < a.start + a.durationMin;
      expect(overlap, date).toBe(false);
    }
    expect(results.flatMap((r) => r.flags).filter((f) => f.severity === 'critical')).toEqual([]);
  });
});

describe('siblings (soft)', () => {
  it('puts siblings on teams in different divisions at the same or back-to-back times', () => {
    const data = unconstrained();
    const d3 = data.divisions.find((d) => d.code === 'D3')!;
    const d4 = data.divisions.find((d) => d.code === 'D4')!;
    const t3 = data.teams.find((t) => t.divisionId === d3.id && t.label === 'Option B')!;
    const t4 = data.teams.find((t) => t.divisionId === d4.id && t.label === 'Option E')!;
    // A household with a kid on each team.
    const r3 = data.registrations.find((r) => r.divisionId === d3.id)!;
    const r4 = data.registrations.find((r) => r.divisionId === d4.id)!;
    data.players.find((p) => p.id === r4.playerId)!.householdId = data.players.find((p) => p.id === r3.playerId)!.householdId;
    const placements = [
      { registrationId: r3.id, teamId: t3.id, round: 1 as const, state: 'projected' as const, locked: false, choiceRankMet: null, reasons: [] },
      { registrationId: r4.id, teamId: t4.id, round: 1 as const, state: 'projected' as const, locked: false, choiceRankMet: null, reasons: [] },
    ];
    const slots = slotMap(data);
    const together = (placementsGiven: boolean) => {
      const games = buildSeasonSchedules(data, placementsGiven ? { placements } : {}).flatMap((r) => r.games);
      let ok = 0;
      for (const date of data.season.gameDates) {
        const a = games.find((g) => slots.get(g.gameSlotId)!.date === date && (g.homeTrackId === t3.gameTrackId || g.awayTrackId === t3.gameTrackId));
        const b = games.find((g) => slots.get(g.gameSlotId)!.date === date && (g.homeTrackId === t4.gameTrackId || g.awayTrackId === t4.gameTrackId));
        if (!a || !b) continue;
        const sa = slots.get(a.gameSlotId)!;
        const sb = slots.get(b.gameSlotId)!;
        const gap = Math.max(sa.start, sb.start) - Math.min(sa.start + sa.durationMin, sb.start + sb.durationMin);
        if (sa.start === sb.start || (gap >= 0 && gap <= 20)) ok++;
      }
      return ok;
    };
    const withLinks = together(true);
    expect(withLinks).toBeGreaterThanOrEqual(together(false));
    expect(withLinks).toBeGreaterThanOrEqual(5);
  });
});

describe('track descriptions', () => {
  it.each(STYLES)('describes every track in plain words (%s)', (style) => {
    const data = sample();
    for (const { division, result } of eachDivision(data, style)) {
      expect(result.tracks.map((t) => t.id).sort()).toEqual(data.gameTracks.filter((t) => t.divisionId === division.id).map((t) => t.id).sort());
      for (const t of result.tracks) {
        expect(t.description).toMatch(style === 'anchored' ? /^(Mostly|All games at) \d/ : /^(Rotating times|All games at) /);
        expect(t.description).not.toMatch(/undefined|NaN/);
      }
    }
  });

  it('matches the example format', () => {
    const data = unconstrained();
    const d1 = data.divisions.find((d) => d.code === 'D1')!;
    const result = buildSchedule({ data, divisionId: d1.id, style: 'anchored' });
    for (const t of result.tracks) {
      expect(t.description).toMatch(/^Mostly \d{1,2}(:\d\d)?am · \d games? at [\d:]+am(, \d at [\d:]+am)* to play every team · byes? [A-Z][a-z]{2} \d{1,2}/);
    }
  });

  it('marks positions with no games', () => {
    const data = sample();
    const d3 = data.divisions.find((d) => d.code === 'D3')!;
    data.season.gameDates = [];
    const result = buildSchedule({ data, divisionId: d3.id, style: 'anchored' });
    expect(result.games).toEqual([]);
    for (const t of result.tracks) expect(t.description).toBe('Game times to be announced');
  });
});

describe('positions', () => {
  it('schedules only the requested number of positions, keeping claimed tracks', () => {
    const data = sample();
    const d3 = data.divisions.find((d) => d.code === 'D3')!;
    const tracks = data.gameTracks.filter((t) => t.divisionId === d3.id);
    // Cancel the team on position 2; with 5 positions, position 2 is dropped.
    const cancelled = data.teams.find((t) => t.gameTrackId === tracks[1]!.id)!;
    cancelled.status = 'cancelled';
    const result = buildSchedule({ data, divisionId: d3.id, style: 'anchored', positions: 5 });
    const used = new Set(activeTrackIds(result));
    expect(used.size).toBe(5);
    expect(used.has(tracks[1]!.id)).toBe(false);
    expect(result.tracks.find((t) => t.id === tracks[1]!.id)!.description).toBe('Not in the current schedule');
    // 5 positions: 2 games a week and a bye.
    expect(result.games.length).toBe(2 * data.season.gameDates.length);
  });

  it('adds positions beyond the existing tracks', () => {
    const data = sample();
    const d5 = data.divisions.find((d) => d.code === 'D5')!;
    const result = buildSchedule({ data, divisionId: d5.id, style: 'rotating', positions: 5 });
    expect(result.tracks.length).toBe(5);
    const added = result.tracks.find((t) => t.position === 5)!;
    expect(data.gameTracks.some((t) => t.id === added.id)).toBe(false);
    expect(activeTrackIds(result)).toContain(added.id);
  });
});

describe('rebuild from a date', () => {
  it('reproduces the same schedule when nothing changed', () => {
    const data = sample();
    for (const style of STYLES) {
      for (const division of data.divisions) {
        const first = buildSchedule({ data, divisionId: division.id, style });
        const again = buildSchedule({ data, divisionId: division.id, style, fromDate: data.season.gameDates[3]!, existingGames: first.games });
        expect(again.changedGameIds, `${division.code} ${style}`).toEqual([]);
        expect(again.games).toEqual(first.games);
      }
    }
  });

  it('keeps earlier games and reports every game that moved after a team cancels', () => {
    const data = sample();
    const d3 = data.divisions.find((d) => d.code === 'D3')!;
    const before = buildSchedule({ data, divisionId: d3.id, style: 'anchored' });
    const fromDate = data.season.gameDates[3]!;
    const slots = slotMap(data);
    const track6 = data.gameTracks.find((t) => t.divisionId === d3.id && t.position === 6)!;
    data.teams.find((t) => t.gameTrackId === track6.id)!.status = 'cancelled';
    const after = buildSchedule({ data, divisionId: d3.id, style: 'anchored', positions: 5, fromDate, existingGames: before.games });

    const early = (g: { gameSlotId: string }) => slots.get(g.gameSlotId)!.date < fromDate;
    expect(after.games.filter(early)).toEqual(before.games.filter(early));
    const later = after.games.filter((g) => !early(g));
    expect(later.length).toBe(2 * (data.season.gameDates.length - 3));
    for (const g of later) expect([g.homeTrackId, g.awayTrackId]).not.toContain(track6.id);

    const beforeById = new Map(before.games.map((g) => [g.id, g]));
    const afterById = new Map(after.games.map((g) => [g.id, g]));
    expect(new Set(after.games.map((g) => g.id)).size).toBe(after.games.length);
    const expected = new Set<string>();
    for (const g of after.games) {
      const old = beforeById.get(g.id);
      if (!old || JSON.stringify(old) !== JSON.stringify(g)) expected.add(g.id);
    }
    for (const g of before.games) if (!afterById.has(g.id)) expected.add(g.id);
    expect(new Set(after.changedGameIds)).toEqual(expected);
    expect(after.changedGameIds.length).toBeGreaterThan(0);
    for (const id of after.changedGameIds) expect(early(afterById.get(id) ?? beforeById.get(id)!)).toBe(false);
  });

  it('rebuilding after a coach limit changes moves only what it must', () => {
    const data = unconstrained();
    const d3 = data.divisions.find((d) => d.code === 'D3')!;
    const before = buildSchedule({ data, divisionId: d3.id, style: 'anchored' });
    const heads = headCoachByTrack(data);
    const track = data.gameTracks.find((t) => t.divisionId === d3.id && t.position === 4)!;
    data.coachAvailability.find((a) => a.personId === heads.get(track.id))!.gamesNotBefore = 600;
    const fromDate = data.season.gameDates[4]!;
    const after = buildSchedule({ data, divisionId: d3.id, style: 'anchored', fromDate, existingGames: before.games });
    const slots = slotMap(data);
    for (const g of after.games) {
      const s = slots.get(g.gameSlotId)!;
      if (s.date >= fromDate && (g.homeTrackId === track.id || g.awayTrackId === track.id)) expect(s.start).toBe(600);
    }
    const rebuilt = before.games.filter((g) => slots.get(g.gameSlotId)!.date >= fromDate).length;
    expect(after.changedGameIds.length).toBeLessThan(rebuilt);
  });
});

describe('determinism and speed', () => {
  it.each(STYLES)('returns identical output on repeated runs and copies (%s)', (style) => {
    const a = sample();
    const b = JSON.parse(JSON.stringify(a)) as SeasonData;
    for (const division of a.divisions) {
      const x = buildSchedule({ data: a, divisionId: division.id, style });
      const y = buildSchedule({ data: a, divisionId: division.id, style });
      const z = buildSchedule({ data: b, divisionId: division.id, style });
      expect(y).toEqual(x);
      expect(JSON.stringify(z)).toBe(JSON.stringify(x));
    }
  });

  it('does not mutate its input', () => {
    const data = sample();
    const copy = structuredClone(data);
    buildSeasonSchedules(data);
    for (const d of data.divisions) buildSchedule({ data, divisionId: d.id, style: 'rotating' });
    expect(data).toEqual(copy);
  });

  it('builds all five sample divisions in under 100 ms', () => {
    const data = sample();
    buildSeasonSchedules(data); // warm up the JIT
    const runs: number[] = [];
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      const results = buildSeasonSchedules(data);
      runs.push(performance.now() - t0);
      expect(results.length).toBe(5);
    }
    expect(Math.min(...runs)).toBeLessThan(100);
  });

  it('throws on an unknown division', () => {
    expect(() => buildSchedule({ data: sample(), divisionId: 'div_nope', style: 'anchored' })).toThrow(/Unknown division/);
  });
});
