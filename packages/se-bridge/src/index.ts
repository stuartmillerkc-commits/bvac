/**
 * @bvac/se-bridge — Task 3 in docs/BUILD_PLAN.md.
 *
 * The SportsEngine bridge: registration report import (CSV parsing, column
 * mapping, answer parsing, record and request matching), the Season
 * Management Teams and Schedule import CSVs, the rostering list, the question
 * pack for the registration builder, and a sample Saved Report for the demo.
 *
 * Every SportsEngine header and answer wording is in ./formats.ts, because the
 * real formats are unconfirmed. See README.md for the expected losses on a
 * round trip.
 */
import type { BridgeApi } from '@bvac/core';
import { exportScheduleCsv, exportTeamsCsv, rosterList } from './exports';
import { importRegistrations } from './import';
import { suggestMapping } from './mapping';
import { questionPack } from './question-pack';

export const BRIDGE_IS_STUB = false;

export const bridge: BridgeApi = {
  suggestMapping,
  importRegistrations: (rows, mapping, existing) => importRegistrations(rows, mapping, existing),
  exportTeamsCsv: (data, teams) => exportTeamsCsv(data, teams),
  exportScheduleCsv: (data, teams, games) => exportScheduleCsv(data, teams, games),
  rosterList,
  questionPack,
};

export { parseCsv, parseCsvRecords, toCsv, recordsToCsv, csvField, type CsvRecords } from './csv';
export { suggestMapping, headerScore, headerKey, MAPPING_THRESHOLD } from './mapping';
export {
  importRegistrations,
  applyImport,
  type BridgeImportResult,
  type ImportOptions,
  type SelfReportedHistory,
} from './import';
export { matchRequest, parseTypedName, type MatchContext, type MatchResult, type MatchCandidate, type MatchHow } from './matching';
export {
  sampleSportsEngineExport,
  sampleReportHeaders,
  exportTeamsCsv,
  teamsImportRows,
  exportScheduleCsv,
  scheduleImportRows,
  scheduleImportReadme,
  rosterList,
  rosterListCsv,
  seTeamName,
  type ScheduleExportOptions,
} from './exports';
export { questionPack, questionPackItems, type PackQuestion, type PackOption, type PackDivisionOptions, type QuestionType } from './question-pack';
export {
  registrationAnswers,
  teamOption,
  practiceTimeOptions,
  parseTimeRange,
  parseDate,
  parseDateTime,
  parseDays,
  parseDivision,
  parseTeamOption,
  gradeFromBirthdate,
} from './answers';
export { nameVariants, NICKNAME_GROUPS } from './nicknames';
export { editDistance, normalize } from './text';
export * as formats from './formats';
