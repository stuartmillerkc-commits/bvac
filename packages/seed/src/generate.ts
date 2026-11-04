/**
 * Builds the fictional "Soccer · Spring 2027" season used by the demo and tests.
 *
 * Everything is deterministic for a given seed. The shape follows BVAC's real
 * soccer form (five grade-based divisions, 6 fields at the Holke Rd. complex),
 * but every person, team and registration is made up.
 */
import {
  addDays,
  compareStrings,
  defaultDivisionSettings,
  fitsAvailability,
  toMinutes,
  type CoachAssignment,
  type CoachAvailability,
  type Division,
  type DivisionSettings,
  type Factor,
  type Field,
  type GameSlot,
  type GameTrack,
  type Gender,
  type Grade,
  type Household,
  type ID,
  type ISODate,
  type Person,
  type Player,
  type PlayerHistory,
  type PlayerRequest,
  type PracticeSlot,
  type Registration,
  type RegistrationWindow,
  type Season,
  type SeasonData,
  type Team,
  type TimeWindow,
  type VolunteerRole,
  type Weekday,
} from '@bvac/core';
import { ADULT_FIRST_NAMES, BOY_NAMES, GIRL_NAMES, LAST_NAMES, NICKNAMES, TEAM_COLORS, TEAM_MASCOTS } from './names';
import { Rng } from './random';

export interface GenerateOptions {
  seed?: number;
}

export const DEFAULT_SEED = 2027;

// ---------------------------------------------------------------------------
// Fixed season shape
// ---------------------------------------------------------------------------

const SEASON_ID = 'season_soccer_spring_2027';

const SEASON: Season = {
  id: SEASON_ID,
  sport: 'soccer',
  term: 'spring',
  year: 2027,
  name: 'Soccer · Spring 2027',
  previousSeasonLabel: 'Fall 2026',
  windows: {
    coachSignup: { start: '2026-12-01', end: '2027-01-03' },
    early: { start: '2027-01-04', end: '2027-01-31' },
    regular: { start: '2027-02-14', end: '2027-03-07' },
  },
  refundDeadline: '2027-02-13',
  meetTheCoaches: '2027-02-06',
  round1Publish: '2027-02-13',
  round2Publish: '2027-03-13',
  rostersFinal: '2027-03-20',
  practices: { start: '2027-03-22', end: '2027-05-22' },
  gameDates: ['2027-04-03', '2027-04-10', '2027-04-17', '2027-04-24', '2027-05-01', '2027-05-08', '2027-05-15'],
  makeupDates: ['2027-05-22'],
};

/** Past seasons for history, oldest first; seasonOrder = index + 1. */
const PAST_SEASONS = ['Spring 2025', 'Fall 2025', 'Spring 2026', 'Fall 2026'] as const;
/** Grades back from the 2026-27 grade for each past season above. */
const PAST_SEASON_GRADE_OFFSET = [2, 1, 1, 0] as const;

interface DivisionSpec {
  code: string;
  label: string;
  minGrade: Grade;
  maxGrade: Grade;
  size: [number, number, number];
  teams: number;
  overrides?: Partial<DivisionSettings>;
  /** Practice slots: [day, start, end, field number, team capacity]. */
  slots: [Weekday, string, string, number, number][];
  /** Saturday game times and fields. */
  gameTimes: string[];
  gameFields: number[];
  gameMinutes: number;
  /** Extra one-off game slots: [time, field]. */
  extraGames?: [string, number][];
}

const DIVISIONS: DivisionSpec[] = [
  {
    code: 'D1',
    label: '3-4 years old',
    minGrade: -2,
    maxGrade: -1,
    size: [6, 8, 10],
    teams: 5,
    overrides: { model: 'fcfs', coachProtectedPicks: 0 },
    slots: [
      ['mon', '17:30', '18:15', 5, 2],
      ['tue', '17:30', '18:15', 5, 2],
      ['tue', '18:15', '19:00', 5, 2],
      ['wed', '17:30', '18:15', 6, 2],
      ['thu', '17:30', '18:15', 6, 2],
    ],
    gameTimes: ['08:00', '08:45'],
    gameFields: [5, 6],
    gameMinutes: 40,
  },
  {
    code: 'D2',
    label: '5 yr. old - Kindergarten',
    minGrade: 0,
    maxGrade: 0,
    size: [6, 8, 10],
    teams: 6,
    slots: [
      ['mon', '17:30', '18:15', 6, 2],
      ['mon', '18:15', '19:00', 6, 2],
      ['tue', '18:15', '19:00', 6, 2],
      ['wed', '18:15', '19:00', 5, 2],
      ['thu', '18:15', '19:00', 5, 2],
    ],
    gameTimes: ['09:30', '10:15'],
    gameFields: [5, 6],
    gameMinutes: 40,
  },
  {
    code: 'D3',
    label: '1st and 2nd grade',
    minGrade: 1,
    maxGrade: 2,
    size: [7, 9, 11],
    teams: 6,
    slots: [
      ['mon', '17:30', '18:30', 3, 1],
      ['tue', '17:30', '18:30', 3, 1],
      ['wed', '17:30', '18:30', 3, 1],
      ['thu', '17:30', '18:30', 3, 1],
      ['mon', '18:30', '19:30', 4, 1],
      ['tue', '18:30', '19:30', 4, 1],
      ['wed', '18:30', '19:30', 4, 1],
      ['thu', '18:30', '19:30', 4, 1],
    ],
    gameTimes: ['08:00', '09:00', '10:00'],
    gameFields: [3, 4],
    gameMinutes: 50,
  },
  {
    code: 'D4',
    label: '3rd and 4th grade',
    minGrade: 3,
    maxGrade: 4,
    size: [8, 10, 12],
    teams: 6,
    slots: [
      ['mon', '17:30', '18:30', 1, 1],
      ['tue', '17:30', '18:30', 1, 1],
      ['wed', '17:30', '18:30', 1, 1],
      ['thu', '17:30', '18:30', 1, 1],
      ['tue', '17:30', '18:30', 2, 1],
      ['thu', '17:30', '18:30', 2, 1],
      ['mon', '17:30', '18:30', 4, 1],
      ['wed', '17:30', '18:30', 4, 1],
    ],
    gameTimes: ['08:00', '09:00'],
    gameFields: [1, 2],
    gameMinutes: 55,
    extraGames: [['11:00', 3]],
  },
  {
    code: 'D5',
    label: '5th and 6th grade',
    minGrade: 5,
    maxGrade: 6,
    size: [9, 11, 13],
    teams: 4,
    slots: [
      ['mon', '18:30', '19:30', 1, 1],
      ['tue', '18:30', '19:30', 1, 1],
      ['wed', '18:30', '19:30', 1, 1],
      ['thu', '18:30', '19:30', 1, 1],
      ['mon', '18:30', '19:30', 2, 1],
      ['wed', '18:30', '19:30', 2, 1],
    ],
    gameTimes: ['10:00', '11:00'],
    gameFields: [1, 2],
    gameMinutes: 55,
  },
];

/** Kids per grade (-2 = age 3 ... 6 = 6th grade); about 300 total. */
const GRADE_WEIGHTS: [Grade, number][] = [
  [-2, 22],
  [-1, 26],
  [0, 58],
  [1, 38],
  [2, 38],
  [3, 33],
  [4, 33],
  [5, 26],
  [6, 26],
];

const TARGET_KIDS = 300;

/** How likely a family lists each weekday. Tue/Thu are the popular nights. */
const DAY_POPULARITY: [Weekday, number][] = [
  ['mon', 0.5],
  ['tue', 0.78],
  ['wed', 0.45],
  ['thu', 0.72],
  ['fri', 0.12],
];

const SHIRT_BY_GRADE = (g: Grade): string =>
  g <= -1 ? 'Youth XS' : g <= 1 ? 'Youth Small' : g <= 3 ? 'Youth Medium' : g <= 5 ? 'Youth Large' : 'Adult Small';

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export function generateSeason(options: GenerateOptions = {}): SeasonData {
  const rng = new Rng(options.seed ?? DEFAULT_SEED);
  const counters = new Map<string, number>();
  const id = (prefix: string): ID => {
    const n = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, n);
    return `${prefix}_${String(n).padStart(3, '0')}`;
  };

  // Fields ------------------------------------------------------------------
  const fields: Field[] = [1, 2, 3, 4, 5, 6].map((n) => ({
    id: `field_${n}`,
    name: `Field ${n}`,
    park: 'BVAC Holke Rd. complex',
    address: '19404 E. Holke Rd., Independence, MO',
  }));

  // Divisions, slots, game slots, tracks --------------------------------------
  const divisions: Division[] = [];
  const practiceSlots: PracticeSlot[] = [];
  const gameSlots: GameSlot[] = [];
  const gameTracks: GameTrack[] = [];
  const specByDivision = new Map<ID, DivisionSpec>();

  DIVISIONS.forEach((spec, i) => {
    const divisionId = `div_${spec.code.toLowerCase()}`;
    specByDivision.set(divisionId, spec);
    const [min, preferred, max] = spec.size;
    divisions.push({
      id: divisionId,
      seasonId: SEASON_ID,
      code: spec.code,
      name: `Division ${i + 1}`,
      label: spec.label,
      minGrade: spec.minGrade,
      maxGrade: spec.maxGrade,
      genderRule: 'coed',
      sortOrder: i + 1,
      settings: defaultDivisionSettings({ min, preferred, max }, spec.overrides),
    });
    for (const [day, start, end, field, cap] of spec.slots) {
      practiceSlots.push({
        id: id('slot'),
        divisionId,
        fieldId: `field_${field}`,
        window: { day, start: toMinutes(start), end: toMinutes(end) },
        teamCapacity: cap,
      });
    }
    const dates: [ISODate, boolean][] = [
      ...SEASON.gameDates.map((d): [ISODate, boolean] => [d, false]),
      ...SEASON.makeupDates.map((d): [ISODate, boolean] => [d, true]),
    ];
    for (const [date, isMakeup] of dates) {
      const pairs: [string, number][] = [
        ...spec.gameTimes.flatMap((t) => spec.gameFields.map((f): [string, number] => [t, f])),
        ...(spec.extraGames ?? []),
      ];
      for (const [time, field] of pairs) {
        gameSlots.push({
          id: id('gslot'),
          divisionId,
          date,
          start: toMinutes(time),
          durationMin: spec.gameMinutes,
          fieldId: `field_${field}`,
          isMakeup,
        });
      }
    }
    for (let p = 1; p <= spec.teams; p++) {
      gameTracks.push({ id: id('track'), divisionId, position: p, description: '' });
    }
  });

  // Households and players ----------------------------------------------------
  const people: Person[] = [];
  const households: Household[] = [];
  const players: Player[] = [];
  const usedNames = new Set<string>();

  const makeAdult = (lastName: string): Person => {
    const firstName = rng.pick(ADULT_FIRST_NAMES);
    const person: Person = {
      id: id('person'),
      firstName,
      lastName,
      email: `${firstName}.${lastName}${rng.int(1, 99)}@example.com`.toLowerCase(),
      phone: `816-555-01${String(rng.int(0, 99)).padStart(2, '0')}`,
    };
    people.push(person);
    return person;
  };

  const birthdateFor = (grade: Grade): ISODate => {
    // School year 2026-27: kindergarten (0) born Sep 2020 - Aug 2021.
    const start = `${2020 - grade}-09-01`;
    return addDays(start, rng.int(0, 364));
  };

  const makePlayer = (householdId: ID, lastName: string, grade: Grade): Player => {
    let gender: Gender = rng.chance(0.5) ? 'M' : 'F';
    let firstName = rng.pick(gender === 'M' ? BOY_NAMES : GIRL_NAMES);
    // Keep full names unique so seeded "matched" requests are unambiguous by full name.
    for (let tries = 0; usedNames.has(`${firstName} ${lastName}`) && tries < 20; tries++) {
      gender = rng.chance(0.5) ? 'M' : 'F';
      firstName = rng.pick(gender === 'M' ? BOY_NAMES : GIRL_NAMES);
    }
    usedNames.add(`${firstName} ${lastName}`);
    const nickname = NICKNAMES[firstName] && rng.chance(0.5) ? NICKNAMES[firstName] : undefined;
    const player: Player = {
      id: id('plr'),
      householdId,
      firstName,
      lastName,
      birthdate: birthdateFor(grade),
      gender,
      grade,
      shirtSize: SHIRT_BY_GRADE(grade),
    };
    if (nickname) player.nickname = nickname;
    players.push(player);
    return player;
  };

  const clampGrade = (g: number): Grade => Math.max(-2, Math.min(6, g));

  while (players.length < TARGET_KIDS) {
    const lastName = rng.pick(LAST_NAMES);
    const householdId = id('hh');
    const guardians = [makeAdult(lastName)];
    if (rng.chance(0.6)) guardians.push(makeAdult(rng.chance(0.85) ? lastName : rng.pick(LAST_NAMES)));
    households.push({ id: householdId, guardianIds: guardians.map((g) => g.id), city: rng.weighted([['Independence', 8], ['Blue Springs', 2], ['Lee\'s Summit', 1], ['Grain Valley', 1]]) });
    const kids = rng.weighted([[1, 74], [2, 22], [3, 4]] as const);
    const first = rng.weighted(GRADE_WEIGHTS);
    makePlayer(householdId, lastName, first);
    for (let k = 1; k < kids; k++) {
      const offset = rng.weighted([[0, 1], [1, 3], [2, 4], [3, 3], [4, 2]] as const);
      makePlayer(householdId, lastName, clampGrade(first + (rng.chance(0.5) ? offset : -offset)));
    }
  }

  const divisionForGrade = (grade: Grade): Division => divisions.find((d) => grade >= d.minGrade && grade <= d.maxGrade)!;
  const playerDivision = new Map(players.map((p) => [p.id, divisionForGrade(p.grade)]));
  const guardiansOf = new Map(households.map((h) => [h.id, h.guardianIds]));
  const kidsOf = new Map<ID, Player[]>();
  for (const p of players) kidsOf.set(p.householdId, [...(kidsOf.get(p.householdId) ?? []), p]);

  // Coaches and teams -----------------------------------------------------------
  const teams: Team[] = [];
  const coachAssignments: CoachAssignment[] = [];
  const coachAvailability: CoachAvailability[] = [];
  const headCoachOfTeam = new Map<ID, ID>();
  const coachTeamByPerson = new Map<ID, Team>();
  const coachingParents = new Set<ID>();

  for (const division of divisions) {
    const spec = specByDivision.get(division.id)!;
    const slots = practiceSlots.filter((s) => s.divisionId === division.id);
    const tracks = gameTracks.filter((t) => t.divisionId === division.id);
    // Coaches claim slots: popular nights first, then spread out.
    const claimOrder = rng.shuffle(slots).sort((a, b) => dayRank(b.window.day) - dayRank(a.window.day));
    const remaining = new Map(slots.map((s) => [s.id, s.teamCapacity]));
    const claimed: PracticeSlot[] = [];
    for (const slot of claimOrder) {
      while (claimed.length < spec.teams && (remaining.get(slot.id) ?? 0) > 0 && claimed.filter((c) => c.id === slot.id).length < 1) {
        claimed.push(slot);
        remaining.set(slot.id, remaining.get(slot.id)! - 1);
      }
    }
    // Second pass lets shared slots (capacity 2) take a second team if needed.
    for (const slot of claimOrder) {
      while (claimed.length < spec.teams && (remaining.get(slot.id) ?? 0) > 0) {
        claimed.push(slot);
        remaining.set(slot.id, remaining.get(slot.id)! - 1);
      }
    }
    claimed.sort((a, b) => dayRank(a.window.day, true) - dayRank(b.window.day, true) || a.window.start - b.window.start);

    // Candidate parent-coaches: guardians with a kid in this division.
    const parentCandidates = rng.shuffle(
      players.filter((p) => playerDivision.get(p.id)!.id === division.id).flatMap((p) => guardiansOf.get(p.householdId)!.slice(0, 1)),
    );

    claimed.forEach((slot, i) => {
      const team: Team = {
        id: id('team'),
        divisionId: division.id,
        label: `Option ${String.fromCharCode(65 + i)}`,
        practiceSlotId: slot.id,
        gameTrackId: tracks[i]?.id,
        status: 'open',
      };
      teams.push(team);
      let coach: Person | undefined;
      if (rng.chance(0.7)) {
        coach = people.find((p) => p.id === parentCandidates.find((c) => !coachingParents.has(c)));
      }
      if (!coach) coach = makeAdult(rng.pick(LAST_NAMES));
      coachingParents.add(coach.id);
      headCoachOfTeam.set(team.id, coach.id);
      coachTeamByPerson.set(coach.id, team);
      coachAssignments.push({ id: id('coach'), personId: coach.id, teamId: team.id, role: 'head', protectedPlayerIds: [] });
      const avail: CoachAvailability = {
        personId: coach.id,
        practiceWindows: [slot.window, ...(rng.chance(0.5) ? [{ ...slot.window, day: rng.pick(['mon', 'tue', 'wed', 'thu'] as const) }] : [])],
        blackoutDates: rng.chance(0.3) ? [rng.pick(SEASON.gameDates)] : [],
      };
      if (rng.chance(0.2)) avail.gamesNotBefore = toMinutes('09:00');
      if (rng.chance(0.1)) avail.gamesNotAfter = toMinutes('10:00');
      coachAvailability.push(avail);
      if (rng.chance(0.3)) {
        const assistant = makeAdult(rng.pick(LAST_NAMES));
        coachAssignments.push({ id: id('coach'), personId: assistant.id, teamId: team.id, role: 'assistant', protectedPlayerIds: [] });
      }
    });
  }

  // Former coaches who appear only in history.
  const formerCoaches = Array.from({ length: 8 }, () => makeAdult(rng.pick(LAST_NAMES)));

  // History -------------------------------------------------------------------
  const playerHistory: PlayerHistory[] = [];
  const lastSeasonCoach = new Map<ID, ID>();
  for (const p of players) {
    const division = playerDivision.get(p.id)!;
    // Grade the kid was in during each past season (school years: Spring 2025 = 2024-25, ...).
    const seasonGrades = PAST_SEASON_GRADE_OFFSET.map((offset) => p.grade - offset);
    const eligible = seasonGrades.filter((g) => g >= -2).length;
    const returning = rng.chance(0.25 + 0.08 * eligible);
    if (!returning || eligible === 0) continue;
    const ownCoachTeam = guardiansOf.get(p.householdId)!.map((g) => coachTeamByPerson.get(g)).find(Boolean);
    for (let s = 0; s < PAST_SEASONS.length; s++) {
      const isLast = s === PAST_SEASONS.length - 1;
      const seasonGrade = seasonGrades[s]!;
      if (seasonGrade < -2) continue;
      // Most returners played last season; some sat it out.
      if (isLast ? rng.chance(0.15) : !rng.chance(0.55)) continue;
      let coachId: ID;
      if (ownCoachTeam && rng.chance(0.8)) coachId = headCoachOfTeam.get(ownCoachTeam.id)!;
      else if (rng.chance(0.5)) {
        const divTeams = teams.filter((t) => t.divisionId === division.id);
        coachId = headCoachOfTeam.get(rng.pick(divTeams).id)!;
      } else coachId = rng.pick(formerCoaches).id;
      if (isLast) lastSeasonCoach.set(p.id, coachId);
      playerHistory.push({
        playerId: p.id,
        seasonLabel: PAST_SEASONS[s]!,
        seasonOrder: s + 1,
        divisionCode: divisionForGrade(seasonGrade).code,
        teamName: `${rng.pick(TEAM_COLORS)} ${rng.pick(TEAM_MASCOTS)}`,
        coachPersonId: coachId,
      });
    }
  }

  // Protected picks: coach's own kids plus up to N returners from last season.
  for (const ca of coachAssignments.filter((c) => c.role === 'head')) {
    const team = teams.find((t) => t.id === ca.teamId)!;
    const division = divisions.find((d) => d.id === team.divisionId)!;
    const own = players.filter(
      (p) => playerDivision.get(p.id)!.id === division.id && guardiansOf.get(p.householdId)!.includes(ca.personId),
    );
    const returners = players.filter(
      (p) => playerDivision.get(p.id)!.id === division.id && lastSeasonCoach.get(p.id) === ca.personId && !own.includes(p),
    );
    const picks = rng.shuffle(returners).slice(0, rng.int(0, division.settings.coachProtectedPicks));
    ca.protectedPlayerIds = [...own, ...picks].map((p) => p.id);
  }

  // Registrations -----------------------------------------------------------------
  const registrations: Registration[] = [];
  const regByPlayer = new Map<ID, Registration>();
  const slotById = new Map(practiceSlots.map((s) => [s.id, s]));
  const teamWindow = (t: Team): TimeWindow => slotById.get(t.practiceSlotId)!.window;

  for (const p of players) {
    const division = playerDivision.get(p.id)!;
    const divTeams = teams.filter((t) => t.divisionId === division.id);
    const returning = lastSeasonCoach.has(p.id);
    const coachParentTeam = guardiansOf.get(p.householdId)!.map((g) => coachTeamByPerson.get(g)).find((t) => t?.divisionId === division.id);

    const window: RegistrationWindow = coachParentTeam
      ? 'early'
      : rng.weighted([['early', returning ? 66 : 52], ['regular', returning ? 31 : 43], ['late', 4]] as const);
    const submittedAt = submittedAtFor(rng, window);

    // Availability.
    let days = DAY_POPULARITY.filter(([, prob]) => rng.chance(prob)).map(([d]) => d);
    if (days.length === 0) days = [rng.weighted(DAY_POPULARITY)];
    const startTime = rng.weighted([['17:00', 5], ['17:30', 3], ['18:00', 1], ['18:30', 1]] as const);
    const endTime = rng.weighted([['19:00', 3], ['19:30', 3], ['20:00', 4]] as const);
    let availability: TimeWindow[] = days.map((day) => ({ day, start: toMinutes(startTime), end: toMinutes(endTime) }));
    if (coachParentTeam && !availability.some((w) => fitsAvailability(teamWindow(coachParentTeam), [w]))) {
      availability = [...availability, { ...teamWindow(coachParentTeam), start: teamWindow(coachParentTeam).start - 30 }];
    }
    const availabilityRequired = rng.chance(0.35);

    // Team choices among teams that fit; coach's kids pick their parent's team.
    const fitting = divTeams.filter((t) => fitsAvailability(teamWindow(t), availability));
    let ranked: Team[];
    if (coachParentTeam) ranked = [coachParentTeam];
    else {
      const lastCoach = lastSeasonCoach.get(p.id);
      const lastCoachTeam = divTeams.find((t) => headCoachOfTeam.get(t.id) === lastCoach);
      // Draw each team's random key once, then sort. Never call rng inside a sort
      // comparator: engines call it a different number of times (Node vs browser).
      const keyed = fitting.map((t) => ({ t, key: dayRank(teamWindow(t).day) + (rng.next() - 0.5) * 0.75 }));
      ranked = keyed.sort((a, b) => b.key - a.key || compareStrings(a.t.id, b.t.id)).map((k) => k.t);
      if (lastCoachTeam && fitting.includes(lastCoachTeam) && rng.chance(0.6)) ranked = [lastCoachTeam, ...ranked.filter((t) => t !== lastCoachTeam)];
    }
    const choiceCount = division.settings.model === 'fcfs' ? 1 : rng.weighted([[1, 3], [2, 4], [3, 3]] as const);
    const choices = ranked.slice(0, choiceCount).map((t, i) => ({ teamId: t.id, rank: i + 1 }));

    // Factor ranking.
    const top = rng.weighted([['practiceTime', 55], ['friends', 20], ['coach', 15], ['lastTeam', 10]] as const) as Factor;
    const rest = rng.shuffle((['practiceTime', 'coach', 'friends', 'lastTeam'] as Factor[]).filter((f) => f !== top));
    const factorRanking = rng.chance(0.2) ? [top, rest[0]!] : [top, ...rest];

    const volunteer: VolunteerRole[] = [];
    if (rng.chance(0.06)) volunteer.push('headCoach');
    if (rng.chance(0.1)) volunteer.push('assistantCoach');
    if (rng.chance(0.05)) volunteer.push('teamParent');

    const registration: Registration = {
      id: id('reg'),
      seasonId: SEASON_ID,
      playerId: p.id,
      divisionId: division.id,
      window,
      submittedAt,
      source: 'demo',
      externalId: `SE-${100000 + registrations.length * 7 + rng.int(0, 6)}`,
      status: 'active',
      availability,
      availabilityRequired,
      choices,
      acceptAnyFittingTeam: choices.length === 0 || rng.chance(0.4),
      requests: [],
      factorRanking,
      siblingsTogetherOptOut: rng.chance(0.08),
      volunteer,
    };
    const lastCoach = lastSeasonCoach.get(p.id);
    if (lastCoach && divTeams.some((t) => headCoachOfTeam.get(t.id) === lastCoach) && rng.chance(0.45)) {
      registration.coachRequest = { coachPersonId: lastCoach, sameAsLastSeason: true };
    } else if (rng.chance(0.12)) {
      registration.coachRequest = { coachPersonId: headCoachOfTeam.get(rng.pick(divTeams).id)! };
    }
    if (rng.chance(0.08)) registration.note = rng.pick(NOTES);
    registrations.push(registration);
    regByPlayer.set(p.id, registration);
  }

  // Requests ----------------------------------------------------------------------
  const playersByDivision = new Map<ID, Player[]>();
  for (const p of players) {
    const d = playerDivision.get(p.id)!.id;
    playersByDivision.set(d, [...(playersByDivision.get(d) ?? []), p]);
  }
  const addRequest = (from: Player, req: Omit<PlayerRequest, 'id'>) => {
    const reg = regByPlayer.get(from.id)!;
    const division = playerDivision.get(from.id)!;
    if (reg.requests.length >= division.settings.maxPlayerRequests) return false;
    if (req.targetPlayerId && reg.requests.some((r) => r.targetPlayerId === req.targetPlayerId)) return false;
    reg.requests.push({ id: id('req'), ...req });
    return true;
  };

  // Siblings: same-division siblings ask for each other; some cross-division too.
  for (const kids of kidsOf.values()) {
    for (const a of kids) {
      for (const b of kids) {
        if (a === b) continue;
        const same = playerDivision.get(a.id) === playerDivision.get(b.id);
        if (same || rng.chance(0.15)) {
          addRequest(a, { type: 'sibling', targetName: `${b.firstName} ${b.lastName}`, targetPlayerId: b.id, matchStatus: 'matched' });
        }
      }
    }
  }

  // Friends.
  const notRegisteredNames = ['Jordan Pike', 'Ellis Vance', 'Harper Quill', 'Rowan Tate', 'Sky Morrow', 'Finn Ashby'];
  for (const p of players) {
    const division = playerDivision.get(p.id)!;
    const roll = rng.next();
    const count = roll < 0.13 ? 2 : roll < 0.48 ? 1 : 0;
    for (let k = 0; k < count; k++) {
      if (rng.chance(0.08)) {
        addRequest(p, { type: 'friend', targetName: rng.pick(notRegisteredNames), matchStatus: 'unmatched' });
        continue;
      }
      const pool = playersByDivision.get(division.id)!.filter((q) => q.householdId !== p.householdId);
      const friend = rng.pick(pool);
      const written = friendNameAsTyped(rng, friend);
      const status = matchStatusFor(written, friend, pool);
      const ok = addRequest(p, {
        type: 'friend',
        targetName: written,
        ...(status.matchStatus === 'matched' ? { targetPlayerId: friend.id } : {}),
        ...(status.candidates ? { candidatePlayerIds: status.candidates } : {}),
        matchStatus: status.matchStatus,
      });
      // About half of friend requests are mutual.
      if (ok && rng.chance(0.5)) {
        addRequest(friend, { type: 'friend', targetName: `${p.firstName} ${p.lastName}`, targetPlayerId: p.id, matchStatus: 'matched' });
      }
    }
  }

  registrations.sort((a, b) => compareStrings(a.submittedAt, b.submittedAt) || compareStrings(a.id, b.id));

  return {
    schemaVersion: 1,
    season: SEASON,
    divisions,
    fields,
    practiceSlots,
    gameSlots,
    gameTracks,
    games: [],
    teams,
    people,
    coachAssignments,
    coachAvailability,
    households,
    players,
    playerHistory,
    registrations,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Popularity rank of a weekday (Tue/Thu highest) or, with `calendar`, Mon..Sun order. */
function dayRank(day: Weekday, calendar = false): number {
  const order: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  if (calendar) return order.indexOf(day);
  return DAY_POPULARITY.find(([d]) => d === day)?.[1] ?? 0;
}

function submittedAtFor(rng: Rng, window: RegistrationWindow): string {
  let date: ISODate;
  if (window === 'early') {
    // Rush in the first three days, then a steady trickle.
    date = rng.chance(0.3) ? addDays(SEASON.windows.early.start, rng.int(0, 2)) : addDays(SEASON.windows.early.start, rng.int(3, 27));
  } else if (window === 'regular') {
    date = rng.chance(0.25) ? addDays(SEASON.windows.regular.end, -rng.int(0, 2)) : addDays(SEASON.windows.regular.start, rng.int(0, 21));
  } else {
    date = addDays(SEASON.windows.regular.end, rng.int(1, 10));
  }
  const minutes = rng.weighted([[rng.int(6 * 60, 9 * 60), 2], [rng.int(12 * 60, 13 * 60), 1], [rng.int(19 * 60, 23 * 60), 4]] as const);
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  // BVAC is in US Central time; January–March is CST (UTC-6).
  return `${date}T${hh}:${mm}:00-06:00`;
}

function friendNameAsTyped(rng: Rng, friend: Player): string {
  const style = rng.weighted([['full', 60], ['initial', 15], ['nickname', 12], ['first', 8], ['typo', 5]] as const);
  switch (style) {
    case 'full':
      return `${friend.firstName} ${friend.lastName}`;
    case 'initial':
      return `${friend.firstName} ${friend.lastName[0]}.`;
    case 'nickname':
      return `${friend.nickname ?? friend.firstName} ${friend.lastName}`;
    case 'first':
      return friend.nickname ?? friend.firstName;
    case 'typo':
      return `${friend.firstName} ${friend.lastName.length > 4 ? friend.lastName.slice(0, -2) + friend.lastName.slice(-1) : friend.lastName + 'e'}`;
  }
}

/** The seed's own simple matcher, so request statuses are realistic. Task 3 builds the real one. */
function matchStatusFor(
  written: string,
  friend: Player,
  pool: readonly Player[],
): { matchStatus: PlayerRequest['matchStatus']; candidates?: ID[] } {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, '').trim();
  const w = norm(written);
  const exact = pool.filter((q) => norm(`${q.firstName} ${q.lastName}`) === w || (q.nickname && norm(`${q.nickname} ${q.lastName}`) === w));
  if (exact.length === 1) return { matchStatus: 'matched' };
  const [first, last] = w.split(' ');
  const loose = pool.filter((q) => {
    const firsts = [norm(q.firstName), q.nickname ? norm(q.nickname) : ''];
    if (!first || !firsts.includes(first)) return false;
    return !last || norm(q.lastName).startsWith(last.replace('.', ''));
  });
  if (loose.length === 1 && loose[0] === friend) return { matchStatus: 'matched' };
  if (loose.length > 1) return { matchStatus: 'ambiguous', candidates: loose.slice(0, 5).map((q) => q.id) };
  return { matchStatus: 'unmatched' };
}

const NOTES = [
  'We carpool with the family down the street, so the same night would help.',
  'Mom works late on Mondays.',
  'First season playing, a little shy.',
  'Would love an earlier practice if possible.',
  'Can help with snacks!',
  'Played with Coach last fall and loved it.',
  'Has church choir Wednesday evenings.',
];
