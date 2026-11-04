/**
 * Interfaces between packages. Each task in docs/BUILD_PLAN.md implements one
 * of these; the web app depends only on these shapes, so tasks can be built
 * in parallel against stubs.
 */
import type {
  DivisionSettings,
  Flag,
  Game,
  GameTimeStyle,
  GameTrack,
  ID,
  ISODate,
  ISODateTime,
  Placement,
  Registration,
  SeasonData,
  Team,
} from './types';

// ---------------------------------------------------------------------------
// Task 1 — @bvac/engine
// ---------------------------------------------------------------------------

export interface PlacementRunInput {
  data: SeasonData;
  divisionId: ID;
  round: 1 | 2;
  /**
   * Placements the engine must keep exactly as given: admin locks, coach
   * protected picks already confirmed, and anything published earlier.
   */
  fixed: Placement[];
  /** Only registrations submitted at or before this time are placed. Omit for all. */
  asOf?: ISODateTime;
  /** Try a scenario without editing the division ("what if max were 12?"). */
  settingsOverride?: Partial<DivisionSettings>;
}

export interface PlacementRunStats {
  registrations: number;
  placed: number;
  waitlisted: number;
  /** Share of placed kids who got their 1st choice, 0..1. */
  firstChoiceRate: number;
  /** Share of placed kids who got any ranked choice, 0..1. */
  anyChoiceRate: number;
  /** Share of matched friend requests satisfied, 0..1. */
  friendRequestRate: number;
  /** Share of same-division sibling groups kept together, 0..1. */
  siblingTogetherRate: number;
  coachRequestRate: number;
  smallestTeam: number;
  largestTeam: number;
}

export interface PlacementRunResult {
  divisionId: ID;
  round: 1 | 2;
  /** One entry per active registration in the division (placed or waitlisted). */
  placements: Placement[];
  flags: Flag[];
  stats: PlacementRunStats;
}

export type PlaceDivision = (input: PlacementRunInput) => PlacementRunResult;

// ---------------------------------------------------------------------------
// Task 2 — @bvac/schedule
// ---------------------------------------------------------------------------

export interface ScheduleBuildInput {
  data: SeasonData;
  divisionId: ID;
  style: GameTimeStyle;
  /** Number of schedule positions. Defaults to the division's game tracks. */
  positions?: number;
  /**
   * Rebuild only games on or after this date, keeping earlier `existingGames`
   * (used when the team count changes mid-season).
   */
  fromDate?: ISODate;
  existingGames?: Game[];
}

export interface ScheduleBuildResult {
  divisionId: ID;
  games: Game[];
  /** Tracks with plain-words descriptions filled in ("Mostly 9am, two 10am games"). */
  tracks: GameTrack[];
  flags: Flag[];
  /** Games that changed vs `existingGames`, for "tell families before publishing". */
  changedGameIds: ID[];
}

export type BuildSchedule = (input: ScheduleBuildInput) => ScheduleBuildResult;

// ---------------------------------------------------------------------------
// Task 3 — @bvac/se-bridge
// ---------------------------------------------------------------------------

/** Fields the importer knows how to fill from a registration export row. */
export const IMPORT_FIELDS = [
  'externalId',
  'submittedAt',
  'playerFirstName',
  'playerLastName',
  'playerBirthdate',
  'playerGender',
  'divisionAnswer',
  'shirtSize',
  'guardianFirstName',
  'guardianLastName',
  'guardianEmail',
  'guardianPhone',
  'city',
  'practiceDays',
  'onlyTheseDays',
  'practiceTimes',
  'firstChoiceTeam',
  'secondChoiceTeam',
  'coachRequest',
  'playerRequest1Name',
  'playerRequest1Type',
  'playerRequest2Name',
  'playerRequest2Type',
  'mostImportant',
  'secondMostImportant',
  'seasonsPlayed',
  'lastSeasonCoach',
  'requestText',
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

/** Import field -> column header in the uploaded file. */
export type ColumnMapping = Partial<Record<ImportField, string>>;

export interface ImportResult {
  /** New or updated records, keyed for merging into SeasonData. */
  upserts: Pick<SeasonData, 'people' | 'households' | 'players' | 'registrations'>;
  created: number;
  updated: number;
  skipped: number;
  issues: Flag[];
}

export interface RosterExportRow {
  divisionName: string;
  teamLabel: string;
  teamName: string;
  coachName: string;
  playerFirstName: string;
  playerLastName: string;
  playerBirthdate: ISODate;
  externalId?: string;
}

export interface BridgeApi {
  /** Guess a mapping from the file's headers. */
  suggestMapping(headers: string[]): ColumnMapping;
  /** Parse CSV text (or rows from an .xlsx) into registrations matched against existing data. */
  importRegistrations(rows: Record<string, string>[], mapping: ColumnMapping, existing: SeasonData): ImportResult;
  /** CSV for SportsEngine Season Management "Teams Import". */
  exportTeamsCsv(data: SeasonData, teams: Team[]): string;
  /** CSV for SportsEngine Season Management "Schedule Import": games + practice events. */
  exportScheduleCsv(data: SeasonData, teams: Team[], games: Game[]): string;
  /** Sorted list an admin follows in SportsEngine's rostering tool. */
  rosterList(data: SeasonData, placements: Placement[]): RosterExportRow[];
  /** Text to paste into the SportsEngine registration builder: questions and options. */
  questionPack(data: SeasonData): string;
}

/** Helper type used by the web app for "registrations arriving" replays. */
export interface RegistrationEvent {
  at: ISODateTime;
  registration: Registration;
}
