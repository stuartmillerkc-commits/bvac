/**
 * Every SportsEngine header name, column order and answer wording the bridge
 * reads or writes lives in this file.
 *
 * SportsEngine's real export and import layouts are UNCONFIRMED (see
 * docs/SPORTSENGINE.md): nobody on the project has seen a BVAC Saved Report
 * or the Season Management import templates yet. When a BVAC admin sends a
 * real file or template, edit the strings here. No other file should need to
 * change. The import side tolerates differences anyway: headers go through a
 * column-mapping step with synonyms and fuzzy matching, and answers are parsed
 * leniently.
 */
import { formatTime, formatWindow, type Division, type Factor, type ImportField, type Season, type Weekday } from '@bvac/core';

// ---------------------------------------------------------------------------
// Registration "Saved Report" (import)
// ---------------------------------------------------------------------------

/** "2026-27" for a season: spring 2027 and fall 2026 are both the 2026-27 school year. */
export function schoolYear(season: Pick<Season, 'term' | 'year'>): string {
  const start = season.term === 'spring' ? season.year - 1 : season.year;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** Placeholder replaced by `schoolYear(season)` in headers. */
export const SCHOOL_YEAR_TOKEN = '{schoolYear}';

/**
 * Column header for each import field, as the Saved Report would title it.
 * Custom-question columns use the question text from the question pack, so
 * BVAC's form and this file must agree.
 */
export const REPORT_HEADERS: Record<ImportField, string> = {
  externalId: 'Registration ID',
  submittedAt: 'Registration Date',
  playerFirstName: 'Player First Name',
  playerLastName: 'Player Last Name',
  playerBirthdate: 'Player Date of Birth',
  playerGender: 'Player Gender',
  divisionAnswer: `What age/grade is the player during the ${SCHOOL_YEAR_TOKEN} school year?`,
  shirtSize: 'Shirt Size',
  guardianFirstName: 'Parent/Guardian First Name',
  guardianLastName: 'Parent/Guardian Last Name',
  guardianEmail: 'Parent/Guardian Email',
  guardianPhone: 'Parent/Guardian Phone',
  city: 'City',
  practiceDays: 'Practice days available',
  onlyTheseDays: 'Are these the only days that work?',
  practiceTimes: 'Practice times available',
  firstChoiceTeam: '1st choice team',
  secondChoiceTeam: '2nd choice team',
  coachRequest: 'Coach request',
  playerRequest1Name: 'Player request 1',
  playerRequest1Type: 'Sibling or friend? (1)',
  playerRequest2Name: 'Player request 2',
  playerRequest2Type: 'Sibling or friend? (2)',
  mostImportant: 'What matters most? (1st)',
  secondMostImportant: 'What matters most? (2nd)',
  seasonsPlayed: 'Seasons played at BVAC',
  lastSeasonCoach: "Last season's coach",
  requestText: 'Request',
};

/** Header text for one field, with the school year filled in. */
export function reportHeader(field: ImportField, season: Pick<Season, 'term' | 'year'>): string {
  return REPORT_HEADERS[field].replace(SCHOOL_YEAR_TOKEN, schoolYear(season));
}

/**
 * Other names the same column might have in a real export. Used by
 * `suggestMapping` alongside fuzzy matching. Matching ignores case,
 * punctuation and any school year ("2026-27").
 */
export const HEADER_SYNONYMS: Record<ImportField, string[]> = {
  externalId: ['Registration Number', 'Registration #', 'Registrant ID', 'Confirmation Number', 'Order Number', 'Order ID', 'Entry ID', 'Submission ID'],
  submittedAt: ['Registration Date', 'Registered On', 'Submitted', 'Submitted At', 'Submission Date', 'Order Date', 'Date Registered', 'Registration Submitted'],
  playerFirstName: ['First Name', 'Participant First Name', 'Athlete First Name', 'Child First Name', 'Registrant First Name'],
  playerLastName: ['Last Name', 'Participant Last Name', 'Athlete Last Name', 'Child Last Name', 'Registrant Last Name'],
  playerBirthdate: ['Date of Birth', 'DOB', 'Birthdate', 'Birth Date', 'Player DOB', 'Player Birthdate', 'Participant Date of Birth', 'Athlete Date of Birth'],
  playerGender: ['Gender', 'Sex', 'Participant Gender', 'Athlete Gender', 'Player Sex'],
  divisionAnswer: ['Division', 'Age Group', 'Grade', 'Player Grade', 'Age/Grade', 'Which division', 'School Grade', 'What age/grade is the player'],
  shirtSize: ['T-Shirt Size', 'Jersey Size', 'Uniform Size', 'Player Shirt Size', 'Youth Shirt Size'],
  guardianFirstName: ['Parent First Name', 'Guardian First Name', 'Primary Contact First Name', 'Account Holder First Name', 'Parent/Guardian 1 First Name', 'Parent 1 First Name'],
  guardianLastName: ['Parent Last Name', 'Guardian Last Name', 'Primary Contact Last Name', 'Account Holder Last Name', 'Parent/Guardian 1 Last Name', 'Parent 1 Last Name'],
  guardianEmail: ['Email', 'Email Address', 'Parent Email', 'Guardian Email', 'Primary Contact Email', 'Account Holder Email', 'Parent/Guardian 1 Email', 'Parent 1 Email'],
  guardianPhone: ['Phone', 'Phone Number', 'Parent Phone', 'Guardian Phone', 'Primary Contact Phone', 'Cell Phone', 'Mobile Phone', 'Parent/Guardian 1 Phone', 'Parent 1 Phone'],
  city: ['Address City', 'Home City', 'Player City', 'Town'],
  practiceDays: ['Practice Days', 'Days available', 'Available days', 'Which days can you practice'],
  onlyTheseDays: ['Only these days', 'Are these the only days', 'Days required'],
  practiceTimes: ['Practice Times', 'Times available', 'Available times'],
  firstChoiceTeam: ['First choice team', '1st choice', 'First choice', 'Team choice 1', '1st team choice', 'Team option 1st choice'],
  secondChoiceTeam: ['Second choice team', '2nd choice', 'Second choice', 'Team choice 2', '2nd team choice', 'Team option 2nd choice'],
  coachRequest: ['Coach', 'Requested coach', 'Coach preference'],
  playerRequest1Name: ['Player request #1', 'Request 1 name', 'Friend or sibling 1', 'Teammate request 1'],
  playerRequest1Type: ['Sibling or friend 1', 'Request 1 type', 'Sibling or friend? 1', 'Relationship 1'],
  playerRequest2Name: ['Player request #2', 'Request 2 name', 'Friend or sibling 2', 'Teammate request 2'],
  playerRequest2Type: ['Sibling or friend 2', 'Request 2 type', 'Sibling or friend? 2', 'Relationship 2'],
  mostImportant: ['What matters most? 1st', 'What matters most', 'Most important', 'What matters most 1'],
  secondMostImportant: ['What matters most? 2nd', 'Second most important', 'What matters most 2', 'Next most important'],
  seasonsPlayed: ['Seasons played', 'Seasons at BVAC', 'Years played', 'How many seasons'],
  lastSeasonCoach: ['Last season coach', 'Previous coach', 'Last coach', 'Coach last season'],
  requestText: ['Requests', 'Special requests', 'Comments', 'Notes', 'Anything else'],
};

/**
 * Columns a Saved Report usually carries that the importer ignores. The sample
 * export includes them so the mapping screen looks like the real thing.
 */
export const REPORT_EXTRA_COLUMNS = {
  state: 'State',
  status: 'Registration Status',
  amountPaid: 'Amount Paid',
  waiver: 'Waiver Accepted',
} as const;

/** Column order of the sample Saved Report. */
export const REPORT_COLUMN_ORDER: (ImportField | keyof typeof REPORT_EXTRA_COLUMNS)[] = [
  'externalId',
  'submittedAt',
  'status',
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
  'state',
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
  'amountPaid',
  'waiver',
];

/** Fixed values for the extra columns in the sample export. */
export const REPORT_EXTRA_VALUES: Record<keyof typeof REPORT_EXTRA_COLUMNS, string> = {
  state: 'MO',
  status: 'Complete',
  amountPaid: '$100.00',
  waiver: 'Yes',
};

/**
 * Separator between the answers of a multi-select (checkbox) question in one
 * cell. The importer also splits on ";" and "|".
 */
export const MULTI_SELECT_SEPARATOR = ', ';

// ---------------------------------------------------------------------------
// Answer wording (question options)
// ---------------------------------------------------------------------------

/** Days offered in "Practice days available". */
export const PRACTICE_DAY_OPTIONS: { day: Weekday; label: string }[] = [
  { day: 'mon', label: 'Mon' },
  { day: 'tue', label: 'Tue' },
  { day: 'wed', label: 'Wed' },
  { day: 'thu', label: 'Thu' },
  { day: 'fri', label: 'Fri' },
];

export const ONLY_THESE_DAYS_ANSWERS = {
  yes: 'Yes, only the days checked',
  no: "No, they're preferences",
};

/**
 * Extra "Practice times available" option for families whose hours fit none
 * of the division's practice times. Without it, no checked time would read as
 * "any time".
 */
export const PRACTICE_TIMES_NONE = 'None of these times work';

export const REQUEST_TYPE_ANSWERS = {
  sibling: 'Sibling',
  friend: 'Friend',
} as const;

export const COACH_REQUEST_ANSWERS = {
  sameAsLastSeason: 'Same coach as last season',
  noPreference: 'No preference',
};

export const FACTOR_ANSWERS: Record<Factor, string> = {
  practiceTime: 'Practice time',
  coach: 'Coach',
  friends: 'Friends',
  lastTeam: 'Same team as last season',
};

export const SEASONS_PLAYED_OPTIONS = ['0', '1', '2', '3', '4', '5+'];

export const GENDER_ANSWERS = { M: 'Male', F: 'Female' } as const;

/** Answer to the division question: BVAC's existing wording ("1st and 2nd grade"). */
export function divisionAnswer(division: Pick<Division, 'label'>): string {
  return division.label;
}

/** A practice-time option: "5:30–6:30pm". */
export function practiceTimeLabel(start: number, end: number): string {
  return formatWindow({ day: 'mon', start, end }).replace(/^Mon /, '');
}

/** A team option as families see it in the 1st/2nd choice pulldowns. */
export function teamOptionLabel(teamLabel: string, practice: { day: Weekday; start: number; end: number }, fieldName: string): string {
  return `${teamLabel} · ${formatWindow(practice)} · ${fieldName}`;
}

/** Separator inside a team option label. The importer also accepts "-", "|" and ",". */
export const TEAM_OPTION_SEPARATOR = ' · ';

/**
 * When a practice time has no am/pm ("5:30–6:30"), hours from 1 up to this
 * value are read as pm. Practices are on weekday evenings.
 */
export const ASSUME_PM_UP_TO_HOUR = 9;

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** "03/14/2019" */
export function formatReportDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
}

/** "01/05/2027 07:42 PM" from "2027-01-05T19:42:00-06:00" (wall-clock time in BVAC's zone). */
export function formatReportDateTime(iso: string): string {
  const date = formatReportDate(iso.slice(0, 10));
  const h24 = Number(iso.slice(11, 13));
  const mm = iso.slice(14, 16);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${date} ${String(h12).padStart(2, '0')}:${mm} ${h24 >= 12 ? 'PM' : 'AM'}`;
}

/** UTC offset written on imported timestamps (BVAC is US Central; the project uses CST throughout). */
export const TIMESTAMP_OFFSET = '-06:00';

// ---------------------------------------------------------------------------
// Import defaults for answers the SportsEngine form doesn't ask
// ---------------------------------------------------------------------------

export const IMPORT_DEFAULTS = {
  /** "Any team that fits my days is fine": assumed when the family named no team. */
  acceptAnyFittingTeamWhenNoChoices: true,
  /** Window used for each checked day when no practice time was checked: the whole day. */
  allDay: { start: 0, end: 24 * 60 },
  /** Days used when times were checked but no day was. */
  defaultDays: ['mon', 'tue', 'wed', 'thu', 'fri'] as Weekday[],
  /** Gender when the answer is blank or unreadable (divisions are coed; the row also gets an import issue). */
  unknownGender: 'M' as 'M' | 'F',
  /** Submission time when the date is blank or unreadable: end of the regular window, so no early-window points. */
  unknownSubmittedTime: 'T23:59:00',
};

// ---------------------------------------------------------------------------
// Season Management "Teams Import" (export)
// ---------------------------------------------------------------------------

export const TEAMS_IMPORT_COLUMNS = [
  'Season',
  'Division',
  'Team Name',
  'Gender',
  'Team Option',
  'Practice Day',
  'Practice Time',
  'Practice Location',
  'Head Coach',
  'Head Coach Email',
  'Assistant Coaches',
  'External Team ID',
] as const;
export type TeamsImportColumn = (typeof TEAMS_IMPORT_COLUMNS)[number];

export const TEAM_GENDER_ANSWERS = { coed: 'Coed', boys: 'Male', girls: 'Female' } as const;

/** Separator between several names in one cell (assistant coaches). */
export const NAME_LIST_SEPARATOR = '; ';

// ---------------------------------------------------------------------------
// Season Management "Schedule Import" (export)
// ---------------------------------------------------------------------------

export const SCHEDULE_IMPORT_COLUMNS = [
  'Event Type',
  'Event Name',
  'Start Date',
  'Start Time',
  'End Date',
  'End Time',
  'Duration (minutes)',
  'Home Team',
  'Away Team',
  'Teams',
  'Location',
  'Sub-Location',
  'Event ID',
] as const;
export type ScheduleImportColumn = (typeof SCHEDULE_IMPORT_COLUMNS)[number];

export const SCHEDULE_EVENT_TYPES = { game: 'Game', practice: 'Event' } as const;
export const PRACTICE_EVENT_NAME = 'Practice';

/** "Division 3 > Option C": how a schedule row names a team. */
export function scheduleTeamRef(divisionName: string, teamName: string): string {
  return `${divisionName} > ${teamName}`;
}

/** "5:30 PM" */
export function formatScheduleTime(minutes: number): string {
  return formatTime(minutes)
    .replace(/^(\d+)(am|pm)$/, '$1:00$2')
    .replace(/(am|pm)$/, (s) => ` ${s.toUpperCase()}`);
}

/** "04/03/2027" */
export const formatScheduleDate = formatReportDate;

/**
 * Re-uploading a schedule can replace every event the import tool added
 * earlier (docs/SPORTSENGINE.md). Shown with every schedule export.
 */
export const SCHEDULE_REPLACE_WARNING =
  'Warning: re-uploading a schedule in SportsEngine can replace ALL events added by earlier uploads. ' +
  'Turn on "ignore games before today" (or upload only events from a start date), ' +
  'and delete the earlier practice events before importing changed practices.';

/**
 * Where the warning goes. SportsEngine may reject a CSV with a comment line,
 * which is unconfirmed, so the default is a README next to the file
 * (`scheduleImportReadme`). Switch to 'commentRow' to put it on the first line
 * of the CSV instead.
 */
export const SCHEDULE_WARNING_PLACEMENT: 'readme' | 'commentRow' = 'readme';

/** Prefix of a comment row when `SCHEDULE_WARNING_PLACEMENT` is 'commentRow'. */
export const COMMENT_ROW_PREFIX = '# ';

// ---------------------------------------------------------------------------
// Roster list (printable, follows SportsEngine's rostering tool)
// ---------------------------------------------------------------------------

export const ROSTER_LIST_COLUMNS = [
  'Division',
  'Team Option',
  'Team Name',
  'Coach',
  'Player Last Name',
  'Player First Name',
  'Date of Birth',
  'Registration ID',
] as const;

// ---------------------------------------------------------------------------
// Question pack wording
// ---------------------------------------------------------------------------

export const QUESTION_TYPES = {
  checkbox: 'Checkbox (pick all that apply)',
  radio: 'Radio (pick one)',
  pulldown: 'Pulldown (pick one)',
  text: 'Short text',
} as const;

export const SEAT_LIMIT_NOTE = (seats: number) =>
  `Seat limit: on this answer's item, turn on "Limit the total quantity to sell" and set it to ${seats}. ` +
  'When it sells out, hide the option by hand and add a waitlist option.';
