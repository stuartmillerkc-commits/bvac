/**
 * Domain model for BVAC Team Builder.
 *
 * Mirrors the "Data model" section of docs/DESIGN.md. Every package and the
 * web app share these types; change them only through a PR that updates
 * docs/BUILD_PLAN.md as well.
 *
 * Conventions:
 * - IDs are opaque strings with a short prefix ("plr_", "team_", ...).
 * - Dates are ISO strings: ISODate = "YYYY-MM-DD", ISODateTime = full ISO 8601.
 * - Times of day are minutes after midnight (17:30 = 1050), local to BVAC.
 */

export type ID = string;
export type ISODate = string;
export type ISODateTime = string;
/** Minutes after local midnight. 17:30 is 1050. */
export type Minutes = number;

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** A recurring weekly window, e.g. Tuesdays 17:00–19:00. */
export interface TimeWindow {
  day: Weekday;
  start: Minutes;
  end: Minutes;
}

export interface DateRange {
  start: ISODate;
  end: ISODate;
}

/**
 * School grade. Pre-K ages are negative so ranges stay numeric:
 * -2 = age 3, -1 = age 4, 0 = kindergarten (age 5), 1..12 = grades.
 */
export type Grade = number;

export type Gender = 'M' | 'F';

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** The five organizing models from docs/DESIGN.md "Organizing models". */
export type OrganizingModel =
  | 'ranked' // 1. Ranked choice
  | 'fcfs' // 2. First come, first served
  | 'coachSelect' // 3. Coach selection
  | 'availabilityCluster' // 4. Availability clustering (no pre-built slots)
  | 'hybrid'; // 5. Coach picks -> round 1 -> coach approval -> round 2 -> waitlist

/** Factors a family ranks in "What matters most to you". */
export const FACTORS = ['practiceTime', 'coach', 'friends', 'lastTeam'] as const;
export type Factor = (typeof FACTORS)[number];

export interface TeamSize {
  min: number;
  preferred: number;
  max: number;
}

/** Points per team. See docs/DESIGN.md "Placement engine", step 4. */
export interface PriorityPoints {
  earlyWindow: number;
  playedForCoachLastSeason: number;
  playedLastSeason: number;
  siblingOnTeam: number;
  perPriorSeason: number;
  perPriorSeasonCap: number;
  perSeasonWithCoach: number;
  perSeasonWithCoachCap: number;
}

export type PlacementMethod = 'priorityFirst' | 'maxSatisfaction';
export type GameTimeStyle = 'rotating' | 'anchored';

export interface DivisionSettings {
  model: OrganizingModel;
  placementMethod: PlacementMethod;
  teamSize: TeamSize;
  /** Protected picks per head coach, not counting their own children. */
  coachProtectedPicks: number;
  keepSiblingsTogether: boolean;
  maxPlayerRequests: number;
  /** BVAC's weight W per factor (docs/DESIGN.md step 3). */
  factorWeights: Record<Factor, number>;
  priority: PriorityPoints;
  round1Fill: 'preferred' | 'max';
  showCoachNames: boolean;
  showProjectedToFamilies: boolean;
  gameTimeStyle: GameTimeStyle;
  practicesPerWeek: number;
}

// ---------------------------------------------------------------------------
// Season structure
// ---------------------------------------------------------------------------

export type Sport = 'soccer' | 'basketball' | 'baseball' | 'volleyball';
export type Term = 'spring' | 'fall';

export interface Season {
  id: ID;
  sport: Sport;
  term: Term;
  year: number;
  /** "Soccer · Spring 2027" */
  name: string;
  /** Previous season of the same sport, used for "played last season". */
  previousSeasonLabel: string;
  windows: {
    coachSignup: DateRange;
    early: DateRange;
    regular: DateRange;
  };
  refundDeadline: ISODate;
  meetTheCoaches: ISODate;
  round1Publish: ISODate;
  round2Publish: ISODate;
  rostersFinal: ISODate;
  practices: DateRange;
  gameDates: ISODate[];
  makeupDates: ISODate[];
}

export interface Division {
  id: ID;
  seasonId: ID;
  /** "D3" */
  code: string;
  /** "Division 3" */
  name: string;
  /** "1st and 2nd grade" — the wording on BVAC's form. */
  label: string;
  minGrade: Grade;
  maxGrade: Grade;
  genderRule: 'coed' | 'boys' | 'girls';
  sortOrder: number;
  settings: DivisionSettings;
}

export interface Field {
  id: ID;
  name: string;
  park: string;
  address?: string;
}

/** A practice time that a coach can claim for a team. */
export interface PracticeSlot {
  id: ID;
  divisionId: ID;
  fieldId: ID;
  window: TimeWindow;
  /** How many teams can practice in this slot at once (field split). */
  teamCapacity: number;
}

export interface GameSlot {
  id: ID;
  divisionId: ID;
  date: ISODate;
  start: Minutes;
  durationMin: number;
  fieldId: ID;
  isMakeup: boolean;
}

/** A position in the pre-built game schedule ("Team 3"). */
export interface GameTrack {
  id: ID;
  divisionId: ID;
  position: number;
  /** Plain words, e.g. "Mostly 9am, two 11am games". Filled by the schedule builder. */
  description: string;
}

/** A game between two schedule positions; becomes real teams once claimed. */
export interface Game {
  id: ID;
  divisionId: ID;
  gameSlotId: ID;
  round: number;
  homeTrackId: ID;
  awayTrackId: ID;
}

export type TeamStatus = 'draft' | 'open' | 'full' | 'rostered' | 'cancelled';

/** A team option: practice slot + game track + coach. */
export interface Team {
  id: ID;
  divisionId: ID;
  /** "Option A" — display only; admins can rename. */
  label: string;
  /** Optional team name once rostered ("Blue Strikers"). */
  name?: string;
  practiceSlotId: ID;
  gameTrackId?: ID;
  status: TeamStatus;
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export interface Person {
  id: ID;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

export type CoachRole = 'head' | 'assistant';

export interface CoachAssignment {
  id: ID;
  personId: ID;
  teamId: ID;
  role: CoachRole;
  /** Players the coach locks onto the team before placement runs. */
  protectedPlayerIds: ID[];
}

export interface CoachAvailability {
  personId: ID;
  practiceWindows: TimeWindow[];
  blackoutDates: ISODate[];
  /** Earliest game start the coach can make, if any. */
  gamesNotBefore?: Minutes;
  /** Latest game start the coach can make, if any. */
  gamesNotAfter?: Minutes;
}

export interface Household {
  id: ID;
  guardianIds: ID[];
  city?: string;
}

export interface Player {
  id: ID;
  householdId: ID;
  firstName: string;
  lastName: string;
  /** Name the family uses, if different ("Jake" for Jacob). */
  nickname?: string;
  birthdate: ISODate;
  gender: Gender;
  /** Grade during the season's school year. */
  grade: Grade;
  shirtSize?: string;
}

/** One past season for one player. Drives seniority. */
export interface PlayerHistory {
  playerId: ID;
  /** "Fall 2026" */
  seasonLabel: string;
  /** Season index, higher = more recent. Lets the engine find "last season". */
  seasonOrder: number;
  divisionCode: string;
  teamName: string;
  coachPersonId?: ID;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export type RegistrationWindow = 'early' | 'regular' | 'late';

export type RegistrationSource =
  | 'demo' // generated sample data
  | 'native' // registered in this tool
  | 'sportsengine-csv'
  | 'sportsengine-email'
  | 'sportsengine-api'
  | 'preferences-page';

export type RegistrationStatus = 'active' | 'withdrawn';

export interface TeamChoice {
  teamId: ID;
  /** 1 = first choice. */
  rank: number;
}

export type PlayerRequestType = 'sibling' | 'friend';
export type RequestMatchStatus = 'matched' | 'ambiguous' | 'unmatched' | 'confirmed';

export interface PlayerRequest {
  id: ID;
  type: PlayerRequestType;
  /** Exactly what the family typed. */
  targetName: string;
  /** Resolved player, when matched or confirmed by an admin. */
  targetPlayerId?: ID;
  /** Candidates when the name was ambiguous. */
  candidatePlayerIds?: ID[];
  matchStatus: RequestMatchStatus;
}

export interface CoachRequest {
  coachPersonId?: ID;
  sameAsLastSeason?: boolean;
}

export type VolunteerRole = 'headCoach' | 'assistantCoach' | 'teamParent';

export interface Registration {
  id: ID;
  seasonId: ID;
  playerId: ID;
  divisionId: ID;
  window: RegistrationWindow;
  submittedAt: ISODateTime;
  source: RegistrationSource;
  /** Record id in BVAC's registration platform (SportsEngine). */
  externalId?: string;
  status: RegistrationStatus;
  availability: TimeWindow[];
  /** True = "we can only do these days" (the one hard family constraint). */
  availabilityRequired: boolean;
  choices: TeamChoice[];
  /** "Any team that fits my days is fine." */
  acceptAnyFittingTeam: boolean;
  requests: PlayerRequest[];
  coachRequest?: CoachRequest;
  /** Most important first. Missing factors count as least important. */
  factorRanking: Factor[];
  /** Family opted out of keeping same-division siblings together. */
  siblingsTogetherOptOut: boolean;
  note?: string;
  volunteer: VolunteerRole[];
}

// ---------------------------------------------------------------------------
// Placement output
// ---------------------------------------------------------------------------

export type PlacementState = 'projected' | 'proposed' | 'approved' | 'published' | 'waitlisted';

export type PlacementReasonCode =
  | 'coachChild'
  | 'protectedPick'
  | 'adminLocked'
  | 'choiceRank'
  | 'anyFittingTeam'
  | 'priority'
  | 'siblingTogether'
  | 'friendMet'
  | 'coachRequestMet'
  | 'returningWithCoach'
  | 'fit'
  | 'noFittingTeam'
  | 'teamsFull';

export interface PlacementReason {
  code: PlacementReasonCode;
  /** Human-readable, shown to admins and coaches. */
  text: string;
  points?: number;
}

export interface Placement {
  registrationId: ID;
  /** null when waitlisted. */
  teamId: ID | null;
  round: 1 | 2 | null;
  state: PlacementState;
  locked: boolean;
  /** Rank of the family's choice that was met; null if none or not ranked. */
  choiceRankMet: number | null;
  reasons: PlacementReason[];
}

export type FlagCode =
  | 'teamUnderMin'
  | 'teamOverMax'
  | 'noFittingTeam'
  | 'requestUnmet'
  | 'requestUnmatched'
  | 'coachRequestUnmet'
  | 'demandExceedsCapacity'
  | 'scheduleConflict'
  | 'importIssue';

export type FlagSeverity = 'info' | 'warning' | 'critical';

export interface Flag {
  code: FlagCode;
  severity: FlagSeverity;
  message: string;
  divisionId?: ID;
  teamId?: ID;
  registrationId?: ID;
}

export type CoachTaskType = 'approveRoster' | 'chooseN';

export interface CoachTask {
  id: ID;
  teamId: ID;
  type: CoachTaskType;
  registrationIds: ID[];
  chooseCount?: number;
  due: ISODate;
  status: 'open' | 'answered' | 'expired';
  answerRegistrationIds?: ID[];
}

export interface AuditEntry {
  id: ID;
  at: ISODateTime;
  actorPersonId: ID;
  action: string;
  detail?: string;
}

// ---------------------------------------------------------------------------
// Bundle
// ---------------------------------------------------------------------------

/** Everything for one season, as stored in the demo and passed between packages. */
export interface SeasonData {
  schemaVersion: 1;
  season: Season;
  divisions: Division[];
  fields: Field[];
  practiceSlots: PracticeSlot[];
  gameSlots: GameSlot[];
  gameTracks: GameTrack[];
  games: Game[];
  teams: Team[];
  people: Person[];
  coachAssignments: CoachAssignment[];
  coachAvailability: CoachAvailability[];
  households: Household[];
  players: Player[];
  playerHistory: PlayerHistory[];
  registrations: Registration[];
}
