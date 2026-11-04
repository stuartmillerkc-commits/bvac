/**
 * Importing a SportsEngine registration report into SeasonData.
 *
 * Records are matched by external id, then by player name + birthdate, so a
 * re-import updates and never duplicates. When a row's answers for a group of
 * fields (availability, team choices, requests, ...) read the same as what the
 * existing record would export, the existing values are kept, so a re-import
 * never loses detail added in the companion (3rd choices, confirmed friend
 * matches, exact availability).
 */
import {
  compareStrings,
  fullName,
  headCoach,
  indexSeason,
  type ColumnMapping,
  type CoachRequest,
  type Division,
  type Factor,
  type Flag,
  type FlagSeverity,
  type Household,
  type ID,
  type ImportField,
  type ImportResult,
  type Person,
  type Player,
  type PlayerRequest,
  type PlayerRequestType,
  type Registration,
  type RegistrationSource,
  type SeasonData,
  type SeasonIndex,
  type TeamChoice,
  type TimeWindow,
} from '@bvac/core';
import {
  availabilityFrom,
  formatTimestampForCompare,
  gradeFromBirthdate,
  lastSeasonCoachId,
  parseDate,
  parseDateTime,
  parseDays,
  parseDivision,
  parseFactor,
  parseGender,
  parseRequestType,
  parseSeasonsPlayed,
  parseTeamOption,
  parseTimeRanges,
  parseYesNo,
  registrationAnswers,
  sortedDivisions,
  windowFor,
} from './answers';
import { COACH_REQUEST_ANSWERS, IMPORT_DEFAULTS, REQUEST_TYPE_ANSWERS, TIMESTAMP_OFFSET } from './formats';
import { matchRequest, type MatchCandidate } from './matching';
import { deepEqual, editDistance, nameKey, normalize } from './text';

/** Seniority the family reported on the form. The core model has no field for it yet. */
export interface SelfReportedHistory {
  registrationId: ID;
  playerId: ID;
  seasonsPlayed?: number;
  lastSeasonCoachName?: string;
  lastSeasonCoachPersonId?: ID;
}

export interface BridgeImportResult extends ImportResult {
  /** Rows that matched an existing registration and changed nothing. */
  unchanged: number;
  /** "Seasons played" and "Last season's coach" answers, per registration. */
  selfReported: SelfReportedHistory[];
}

export interface ImportOptions {
  /** Spreadsheet row number of each entry in `rows`, for messages. Defaults to index + 2 (row 1 is the header). */
  lineNumbers?: readonly number[];
  /** Source stamped on new registrations. */
  source?: RegistrationSource;
}

const REQUEST_SLOTS = [
  { name: 'playerRequest1Name', type: 'playerRequest1Type' },
  { name: 'playerRequest2Name', type: 'playerRequest2Type' },
] as const satisfies { name: ImportField; type: ImportField }[];

class IdMaker {
  private readonly used = new Set<string>();
  private readonly next = new Map<string, number>();
  constructor(data: SeasonData) {
    for (const list of [data.people, data.households, data.players, data.registrations]) for (const x of list) this.used.add(x.id);
    for (const r of data.registrations) for (const q of r.requests) this.used.add(q.id);
  }
  make(prefix: string): ID {
    let n = this.next.get(prefix) ?? 1;
    let id = '';
    do id = `${prefix}_se_${String(n++).padStart(3, '0')}`;
    while (this.used.has(id));
    this.next.set(prefix, n);
    this.used.add(id);
    return id;
  }
}

interface PendingRequest {
  slot: number;
  typed: string;
  type: PlayerRequestType;
  /** Request kept from the existing registration (same name and type). */
  kept?: PlayerRequest;
}

interface RowWork {
  rowNo: number;
  regId: ID;
  requests: PendingRequest[];
  requestsMapped: boolean;
}

function playerKey(first: string, last: string, birthdate: string): string {
  return `${nameKey(first)}|${nameKey(last)}|${birthdate}`;
}

/** Import rows from a registration report. See the module comment for matching rules. */
export function importRegistrations(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  existing: SeasonData,
  options: ImportOptions = {},
): BridgeImportResult {
  const index = indexSeason(existing);
  const season = existing.season;
  const ids = new IdMaker(existing);
  const issues: Flag[] = [];
  let skipped = 0;

  const people = new Map(existing.people.map((p) => [p.id, p]));
  const households = new Map(existing.households.map((h) => [h.id, h]));
  const players = new Map(existing.players.map((p) => [p.id, p]));
  const registrations = new Map(existing.registrations.map((r) => [r.id, r]));
  const touched = { people: new Set<ID>(), households: new Set<ID>(), players: new Set<ID>(), registrations: new Set<ID>() };

  const regByExternal = new Map<string, ID>();
  for (const r of existing.registrations) if (r.externalId && r.seasonId === season.id) regByExternal.set(r.externalId, r.id);
  const playersByKey = new Map<string, ID[]>();
  const addPlayerKey = (p: Player) => {
    const k = playerKey(p.firstName, p.lastName, p.birthdate);
    const list = playersByKey.get(k) ?? [];
    if (!list.includes(p.id)) list.push(p.id);
    playersByKey.set(k, list);
  };
  existing.players.forEach(addPlayerKey);
  const personByEmail = new Map<string, ID>();
  for (const p of existing.people) if (p.email && !personByEmail.has(p.email.toLowerCase())) personByEmail.set(p.email.toLowerCase(), p.id);
  const householdOfGuardian = new Map<ID, ID>();
  for (const h of existing.households) for (const g of h.guardianIds) if (!householdOfGuardian.has(g)) householdOfGuardian.set(g, h.id);

  const work: RowWork[] = [];
  const seenExternal = new Map<string, number>();
  const selfReported = new Map<ID, SelfReportedHistory>();

  const issue = (rowNo: number, severity: FlagSeverity, message: string, extra: Partial<Flag> = {}) => {
    issues.push({ code: 'importIssue', severity, message: `Row ${rowNo}: ${message}`, ...extra });
  };

  rows.forEach((row, i) => {
    const rowNo = options.lineNumbers?.[i] ?? i + 2;
    const mapped = (f: ImportField) => !!mapping[f];
    const get = (f: ImportField) => (mapping[f] ? (row[mapping[f]!] ?? '') : '').trim();
    if (Object.values(mapping).every((h) => !h || !(row[h] ?? '').trim())) return;

    // Player identity ---------------------------------------------------------
    const firstName = get('playerFirstName');
    const lastName = get('playerLastName');
    if (!firstName || !lastName) {
      issue(rowNo, 'critical', 'player first and last name are required; row skipped.');
      skipped++;
      return;
    }
    const who = `${firstName} ${lastName}`;
    const birthdate = parseDate(get('playerBirthdate'));
    if (!birthdate) {
      const raw = get('playerBirthdate');
      issue(rowNo, 'critical', `${who}: ${raw ? `birthdate "${raw}" isn't a date` : 'birthdate is missing'}; row skipped.`);
      skipped++;
      return;
    }

    const externalId = get('externalId') || undefined;
    if (externalId) {
      const earlier = seenExternal.get(externalId);
      if (earlier !== undefined) issue(rowNo, 'info', `${who}: registration ${externalId} also appears on row ${earlier}; this later row wins.`);
      seenExternal.set(externalId, rowNo);
    }

    let reg: Registration | undefined;
    let player: Player | undefined;
    const regIdByExternal = externalId ? regByExternal.get(externalId) : undefined;
    if (regIdByExternal) {
      reg = registrations.get(regIdByExternal);
      player = reg ? players.get(reg.playerId) : undefined;
    }
    if (!player) {
      const candidates = (playersByKey.get(playerKey(firstName, lastName, birthdate)) ?? []).slice().sort(compareStrings);
      if (candidates.length > 1) issue(rowNo, 'warning', `${who}: ${candidates.length} players share this name and birthdate; used the first.`);
      player = candidates[0] ? players.get(candidates[0]) : undefined;
      if (player) {
        reg = [...registrations.values()]
          .filter((r) => r.playerId === player!.id && r.seasonId === season.id)
          .sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active') || compareStrings(a.id, b.id))[0];
        if (reg?.externalId && externalId && reg.externalId !== externalId) {
          issue(rowNo, 'info', `${who}: matched by name and birthdate to registration ${reg.externalId}; its id is now ${externalId}.`);
        }
      }
    }
    const before = reg ? index.registration.get(reg.id) : undefined;
    const prev = before ? registrationAnswers(index, before) : undefined;
    const same = (f: ImportField) => !mapped(f) || (prev !== undefined && normalize(get(f)) === normalize(prev[f]));

    // Division and grade --------------------------------------------------------
    let division: Division | undefined;
    const divisionText = get('divisionAnswer');
    if (mapped('divisionAnswer') && divisionText) division = parseDivision(existing, divisionText);
    const birthGrade = gradeFromBirthdate(season, birthdate);
    if (!division && reg && !(mapped('divisionAnswer') && divisionText)) division = index.division.get(reg.divisionId);
    if (!division) {
      division = sortedDivisions(existing).find((d) => birthGrade >= d.minGrade && birthGrade <= d.maxGrade);
      if (division) {
        issue(rowNo, 'warning', `${who}: ${divisionText ? `division answer "${divisionText}" not recognized` : 'no division answer'}; placed in ${division.name} from the birthdate.`, { divisionId: division.id });
      } else {
        issue(rowNo, 'critical', `${who}: ${divisionText ? `division answer "${divisionText}" not recognized` : 'no division answer'} and the birthdate fits no division; row skipped.`);
        skipped++;
        return;
      }
    }
    let grade = player && player.birthdate === birthdate && player.grade >= division.minGrade && player.grade <= division.maxGrade ? player.grade : birthGrade;
    if (grade < division.minGrade || grade > division.maxGrade) {
      issue(rowNo, 'warning', `${who}: the birthdate suggests a different age group than ${division.name} (${division.label}); kept the family's answer.`, { divisionId: division.id });
      grade = Math.min(division.maxGrade, Math.max(division.minGrade, grade));
    }

    // Guardian and household ------------------------------------------------------
    const gEmail = get('guardianEmail');
    const gFirst = get('guardianFirstName');
    const gLast = get('guardianLastName');
    const gPhone = get('guardianPhone');
    const upsertGuardian = (person: Person | undefined): Person | undefined => {
      if (!person) {
        if (!gEmail && !gFirst && !gLast) return undefined;
        const created: Person = { id: ids.make('person'), firstName: gFirst, lastName: gLast || lastName, email: gEmail };
        if (gPhone) created.phone = gPhone;
        people.set(created.id, created);
        touched.people.add(created.id);
        if (gEmail) personByEmail.set(gEmail.toLowerCase(), created.id);
        return created;
      }
      const updated: Person = { ...person };
      if (gFirst) updated.firstName = gFirst;
      if (gLast) updated.lastName = gLast;
      if (gPhone) updated.phone = gPhone;
      if (!deepEqual(updated, person)) {
        people.set(updated.id, updated);
        touched.people.add(updated.id);
      }
      return updated;
    };

    let household: Household | undefined = player ? households.get(player.householdId) : undefined;
    const byEmail = gEmail ? people.get(personByEmail.get(gEmail.toLowerCase()) ?? '') : undefined;
    if (household) {
      const inHousehold = household.guardianIds.map((g) => people.get(g)).find((p) => p && gEmail && p.email.toLowerCase() === gEmail.toLowerCase());
      if (inHousehold) upsertGuardian(inHousehold);
      else if (gEmail) {
        const guardian = upsertGuardian(byEmail);
        if (guardian && !household.guardianIds.includes(guardian.id)) {
          household = { ...household, guardianIds: [...household.guardianIds, guardian.id] };
          if (!householdOfGuardian.has(guardian.id)) householdOfGuardian.set(guardian.id, household.id);
        }
      }
    } else {
      const guardian = upsertGuardian(byEmail);
      const hhId = guardian ? householdOfGuardian.get(guardian.id) : undefined;
      household = hhId ? households.get(hhId) : undefined;
      if (!household) {
        household = { id: ids.make('hh'), guardianIds: guardian ? [guardian.id] : [] };
        if (guardian) householdOfGuardian.set(guardian.id, household.id);
      }
    }
    const city = get('city');
    if (city && household.city !== city) household = { ...household, city };
    if (!deepEqual(household, households.get(household.id))) {
      households.set(household.id, household);
      touched.households.add(household.id);
    }

    // Player ----------------------------------------------------------------------------
    const genderText = get('playerGender');
    let gender = parseGender(genderText);
    if (!gender) {
      gender = player?.gender ?? IMPORT_DEFAULTS.unknownGender;
      if (!player || genderText) issue(rowNo, 'warning', `${who}: gender "${genderText}" not recognized; set to ${gender}.`);
    }
    const shirt = get('shirtSize');
    const nextPlayer: Player = player
      ? { ...player, householdId: household.id, birthdate, gender, grade }
      : { id: ids.make('plr'), householdId: household.id, firstName, lastName, birthdate, gender, grade };
    if (player && regIdByExternal) {
      nextPlayer.firstName = firstName;
      nextPlayer.lastName = lastName;
    }
    if (shirt) nextPlayer.shirtSize = shirt;
    if (!player || !deepEqual(nextPlayer, player)) {
      players.set(nextPlayer.id, nextPlayer);
      touched.players.add(nextPlayer.id);
      addPlayerKey(nextPlayer);
    }

    // Registration answers ------------------------------------------------------------
    const divisionChanged = before !== undefined && before.divisionId !== division.id;
    const keep = (fields: ImportField[]) => before !== undefined && !divisionChanged && fields.every(same);

    let submittedAt: string;
    const parsedAt = mapped('submittedAt') ? parseDateTime(get('submittedAt')) : undefined;
    if (parsedAt && !(reg && formatTimestampForCompare(parsedAt) === formatTimestampForCompare(reg.submittedAt))) submittedAt = parsedAt;
    else if (reg) submittedAt = reg.submittedAt;
    else {
      submittedAt = parsedAt ?? `${season.windows.regular.end}${IMPORT_DEFAULTS.unknownSubmittedTime}${TIMESTAMP_OFFSET}`;
      if (!parsedAt) issue(rowNo, 'warning', `${who}: registration date ${get('submittedAt') ? `"${get('submittedAt')}" not recognized` : 'missing'}; treated as the end of the regular window.`, { divisionId: division.id });
    }
    if (reg && mapped('submittedAt') && get('submittedAt') && !parsedAt) {
      issue(rowNo, 'warning', `${who}: registration date "${get('submittedAt')}" not recognized; kept ${reg.submittedAt}.`, { divisionId: division.id });
    }

    // Availability.
    let availability: TimeWindow[];
    let noDaysGiven = false;
    if (keep(['practiceDays', 'practiceTimes']) && before) availability = before.availability;
    else if (!mapped('practiceDays') && !mapped('practiceTimes') && reg) availability = reg.availability;
    else {
      const days = parseDays(get('practiceDays'));
      const times = parseTimeRanges(get('practiceTimes'));
      if (days.unknown.length) issue(rowNo, 'warning', `${who}: practice day(s) not recognized: ${days.unknown.join(', ')}.`, { divisionId: division.id });
      if (times.unknown.length) issue(rowNo, 'warning', `${who}: practice time(s) not recognized: ${times.unknown.join(', ')}.`, { divisionId: division.id });
      const dayList = days.days.length ? days.days : IMPORT_DEFAULTS.defaultDays;
      const ranges = times.ranges.length ? times.ranges : [IMPORT_DEFAULTS.allDay];
      if (!days.days.length) {
        noDaysGiven = true;
        issue(rowNo, 'info', `${who}: no practice days given; treated as available any weekday.`, { divisionId: division.id });
      }
      // "None of these times work": days are known but no team can fit.
      availability = times.none ? [] : availabilityFrom(dayList, ranges);
    }
    let availabilityRequired: boolean;
    if (keep(['onlyTheseDays']) && before) availabilityRequired = before.availabilityRequired;
    else if (!mapped('onlyTheseDays') && reg) availabilityRequired = reg.availabilityRequired;
    else {
      const yn = parseYesNo(get('onlyTheseDays'));
      if (yn === undefined && get('onlyTheseDays')) issue(rowNo, 'warning', `${who}: "only these days" answer "${get('onlyTheseDays')}" not recognized; treated as preferences.`, { divisionId: division.id });
      availabilityRequired = yn ?? false;
    }
    // "Only these days" means nothing without days.
    if (noDaysGiven) availabilityRequired = false;

    // Team choices.
    let choices: TeamChoice[];
    if (keep(['firstChoiceTeam', 'secondChoiceTeam']) && before) choices = before.choices;
    else if (!mapped('firstChoiceTeam') && !mapped('secondChoiceTeam') && reg && !divisionChanged) choices = reg.choices;
    else {
      choices = [];
      for (const [f, n] of [['firstChoiceTeam', '1st'], ['secondChoiceTeam', '2nd']] as const) {
        const text = get(f);
        if (!text) continue;
        const team = parseTeamOption(index, division.id, text);
        if (!team) {
          issue(rowNo, 'warning', `${who}: ${n} choice "${text}" doesn't match a team option in ${division.name}.`, { divisionId: division.id });
          continue;
        }
        if (team.divisionId !== division.id) {
          const other = index.division.get(team.divisionId);
          issue(rowNo, 'warning', `${who}: ${n} choice "${text}" is a ${other?.name ?? 'different division'} team, not ${division.name}; ignored.`, { divisionId: division.id, teamId: team.id });
          continue;
        }
        if (choices.some((c) => c.teamId === team.id)) continue;
        choices.push({ teamId: team.id, rank: choices.length + 1 });
      }
    }
    const acceptAnyFittingTeam = reg && !divisionChanged ? reg.acceptAnyFittingTeam || choices.length === 0 : choices.length === 0 && IMPORT_DEFAULTS.acceptAnyFittingTeamWhenNoChoices;

    // Coach request.
    const lastCoachText = get('lastSeasonCoach');
    const lastCoachId = (nextPlayer.id && lastSeasonCoachId(index, nextPlayer.id)) || (lastCoachText ? findCoach(index, division.id, lastCoachText, true) : undefined);
    let coachRequest: CoachRequest | undefined;
    if (keep(['coachRequest']) && before) coachRequest = before.coachRequest;
    else if (!mapped('coachRequest') && reg) coachRequest = reg.coachRequest;
    else {
      const text = get('coachRequest');
      const v = normalize(text);
      if (!v || v === normalize(COACH_REQUEST_ANSWERS.noPreference) || /^(none|no|n a|na|any)$/.test(v)) coachRequest = undefined;
      else if (v === normalize(COACH_REQUEST_ANSWERS.sameAsLastSeason) || /same|last season|returning/.test(v)) {
        coachRequest = lastCoachId ? { coachPersonId: lastCoachId, sameAsLastSeason: true } : { sameAsLastSeason: true };
      } else {
        const coachId = findCoach(index, division.id, text, false);
        if (coachId) coachRequest = { coachPersonId: coachId };
        else issue(rowNo, 'warning', `${who}: coach request "${text}" doesn't match a coach.`, { divisionId: division.id });
      }
    }

    // What matters most.
    let factorRanking: Factor[];
    if (keep(['mostImportant', 'secondMostImportant']) && before) factorRanking = before.factorRanking;
    else if (!mapped('mostImportant') && !mapped('secondMostImportant') && reg) factorRanking = reg.factorRanking;
    else {
      factorRanking = [];
      for (const f of ['mostImportant', 'secondMostImportant'] as const) {
        const text = get(f);
        if (!text) continue;
        const factor = parseFactor(text);
        if (!factor) issue(rowNo, 'warning', `${who}: "what matters most" answer "${text}" not recognized.`, { divisionId: division.id });
        else if (!factorRanking.includes(factor)) factorRanking.push(factor);
      }
    }

    // Note (the existing free-text Request box).
    const note = mapped('requestText') ? get('requestText') || undefined : reg?.note;

    // Player requests (matched after every row is read).
    const requestsMapped = REQUEST_SLOTS.some((s) => mapped(s.name));
    const pending: PendingRequest[] = [];
    REQUEST_SLOTS.forEach((slot, s) => {
      const typed = get(slot.name);
      if (!typed) return;
      const typeText = get(slot.type);
      let type = parseRequestType(typeText);
      if (!type) {
        if (typeText) issue(rowNo, 'warning', `${who}: request ${s + 1} type "${typeText}" not recognized; treated as ${REQUEST_TYPE_ANSWERS.friend}.`, { divisionId: division.id });
        type = 'friend';
      }
      const kept =
        before && !divisionChanged && same(slot.name) && same(slot.type) ? before.requests[s] : undefined;
      pending.push({ slot: s, typed, type, ...(kept ? { kept } : {}) });
    });

    const regId = reg?.id ?? ids.make('reg');
    const next: Registration = {
      ...(reg ?? {
        id: regId,
        seasonId: season.id,
        playerId: nextPlayer.id,
        source: options.source ?? 'sportsengine-csv',
        status: 'active',
        requests: [],
        siblingsTogetherOptOut: false,
        volunteer: [],
      }),
      divisionId: division.id,
      window: windowFor(season, submittedAt),
      submittedAt,
      availability,
      availabilityRequired,
      choices,
      acceptAnyFittingTeam,
      factorRanking,
    } as Registration;
    if (externalId) next.externalId = externalId;
    if (coachRequest) next.coachRequest = coachRequest;
    else delete next.coachRequest;
    if (note) next.note = note;
    else delete next.note;
    registrations.set(regId, next);
    touched.registrations.add(regId);
    if (externalId) regByExternal.set(externalId, regId);
    work.push({ rowNo, regId, requests: pending, requestsMapped });

    const seasons = parseSeasonsPlayed(get('seasonsPlayed'));
    if (seasons !== undefined || lastCoachText) {
      const self: SelfReportedHistory = { registrationId: regId, playerId: nextPlayer.id };
      if (seasons !== undefined) self.seasonsPlayed = seasons;
      if (lastCoachText) self.lastSeasonCoachName = lastCoachText;
      const resolved = findCoach(index, division.id, lastCoachText, true);
      if (resolved) self.lastSeasonCoachPersonId = resolved;
      selfReported.set(regId, self);
    }
  });

  // Request matching, against everyone known after the import ------------------------
  const divisionOfPlayer = new Map<ID, ID>();
  for (const r of registrations.values()) if (r.seasonId === season.id && r.status === 'active') divisionOfPlayer.set(r.playerId, r.divisionId);
  const pool: MatchCandidate[] = [...players.values()]
    .map((p) => ({ player: p, divisionId: divisionOfPlayer.get(p.id) }))
    .sort((a, b) => compareStrings(a.player.id, b.player.id));
  const seenWork = new Set<ID>();
  for (const w of [...work].reverse()) {
    // With repeated rows the last one wins, so match only the latest.
    if (seenWork.has(w.regId)) continue;
    seenWork.add(w.regId);
    const reg = registrations.get(w.regId)!;
    if (!w.requestsMapped) continue;
    const player = players.get(reg.playerId)!;
    const division = index.division.get(reg.divisionId);
    const requests: PlayerRequest[] = w.requests.map((p) => {
      if (p.kept && (p.kept.matchStatus === 'matched' || p.kept.matchStatus === 'confirmed')) return p.kept;
      const m = matchRequest(p.typed, p.type, { pool, requesterId: player.id, requesterHouseholdId: player.householdId, divisionId: reg.divisionId });
      const req: PlayerRequest = { id: p.kept?.id ?? ids.make('req'), type: p.type, targetName: p.typed, matchStatus: m.status };
      if (m.targetPlayerId) req.targetPlayerId = m.targetPlayerId;
      if (m.candidatePlayerIds) req.candidatePlayerIds = m.candidatePlayerIds;
      const who = fullName(player);
      if (m.status === 'ambiguous') {
        const names = m.candidatePlayerIds!.map((id) => players.get(id)).filter((x): x is Player => !!x).map(fullName);
        issues.push({ code: 'importIssue', severity: 'warning', message: `Row ${w.rowNo}: ${who}'s ${p.type} request "${p.typed}" could be ${names.join(', ')}; confirm which.`, registrationId: reg.id, divisionId: reg.divisionId });
      } else if (m.status === 'unmatched') {
        issues.push({ code: 'importIssue', severity: 'warning', message: `Row ${w.rowNo}: ${who}'s ${p.type} request "${p.typed}" doesn't match a registered player${division ? ` in ${division.name}` : ''}.`, registrationId: reg.id, divisionId: reg.divisionId });
      }
      return req;
    });
    // Requests beyond the form's two slots (added in the companion) stay when the two slots are unchanged.
    const before = index.registration.get(reg.id);
    const extra = before && w.requests.length === REQUEST_SLOTS.length && w.requests.every((p) => p.kept) ? before.requests.slice(REQUEST_SLOTS.length) : [];
    registrations.set(reg.id, { ...reg, requests: [...requests, ...extra] });
  }
  // Issue rows refer to the registration once it exists.
  for (const f of issues) {
    if (f.registrationId) continue;
    const rowNo = Number(/^Row (\d+):/.exec(f.message)?.[1]);
    const w = work.find((x) => x.rowNo === rowNo);
    if (w) {
      f.registrationId = w.regId;
      f.divisionId ??= registrations.get(w.regId)?.divisionId;
    }
  }

  const rowOf = (f: Flag) => Number(/^Row (\d+):/.exec(f.message)?.[1] ?? 0);
  issues.sort((a, b) => rowOf(a) - rowOf(b));

  // Diff against the existing data ----------------------------------------------------------
  const changed = <T extends { id: ID }>(set: Set<ID>, now: Map<ID, T>, was: Map<ID, T>): T[] =>
    [...set].map((id) => now.get(id)!).filter((x) => !deepEqual(x, was.get(x.id)));
  const upserts = {
    people: changed(touched.people, people, index.person),
    households: changed(touched.households, households, index.household),
    players: changed(touched.players, players, index.player),
    registrations: changed(touched.registrations, registrations, index.registration),
  };
  const changedIds = new Set([...upserts.people, ...upserts.households, ...upserts.players, ...upserts.registrations].map((x) => x.id));
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  const counted = new Set<ID>();
  for (const w of work) {
    if (counted.has(w.regId)) continue;
    counted.add(w.regId);
    const reg = registrations.get(w.regId)!;
    if (!index.registration.has(reg.id)) {
      created++;
      continue;
    }
    const player = players.get(reg.playerId)!;
    const household = households.get(player.householdId);
    const related = [reg.id, player.id, ...(household ? [household.id, ...household.guardianIds] : [])];
    if (related.some((id) => changedIds.has(id))) updated++;
    else unchanged++;
  }

  return {
    upserts,
    created,
    updated,
    skipped,
    unchanged,
    issues,
    selfReported: [...selfReported.values()],
  };
}

/**
 * A coach by typed name: head coaches of the division first, then every
 * coach, then (for "last season's coach") anyone in player history.
 * Exact name first, then up to 2 typos.
 */
function findCoach(index: SeasonIndex, divisionId: ID, typed: string, includeHistory: boolean): ID | undefined {
  const key = nameKey(typed);
  if (!key) return undefined;
  const division = index.data.teams.filter((t) => t.divisionId === divisionId).map((t) => headCoach(index, t.id)?.id);
  const coaches = index.data.coachAssignments.map((c) => c.personId);
  const history = includeHistory ? index.data.playerHistory.map((h) => h.coachPersonId) : [];
  const scopes = [division, coaches, history].map((list) =>
    [...new Set(list.filter((x): x is ID => !!x))].sort(compareStrings).map((id) => index.person.get(id)).filter((p): p is Person => !!p),
  );
  for (const scope of scopes) {
    const exact = scope.filter((p) => nameKey(fullName(p)) === key);
    if (exact.length === 1) return exact[0]!.id;
    if (exact.length > 1) return undefined;
  }
  for (const scope of scopes) {
    const near = scope.filter((p) => editDistance(nameKey(fullName(p)), key, 2) <= 2);
    if (near.length === 1) return near[0]!.id;
  }
  return undefined;
}

/** Merge an import into season data: replace records by id, append new ones. */
export function applyImport(data: SeasonData, result: Pick<ImportResult, 'upserts'>): SeasonData {
  const merge = <T extends { id: ID }>(list: readonly T[], upserts: readonly T[]): T[] => {
    const byId = new Map(upserts.map((x) => [x.id, x]));
    const out = list.map((x) => byId.get(x.id) ?? x);
    const have = new Set(list.map((x) => x.id));
    for (const x of upserts) if (!have.has(x.id)) out.push(x);
    return out;
  };
  return {
    ...data,
    people: merge(data.people, result.upserts.people),
    households: merge(data.households, result.upserts.households),
    players: merge(data.players, result.upserts.players),
    registrations: merge(data.registrations, result.upserts.registrations),
  };
}
