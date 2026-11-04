/**
 * @bvac/se-bridge — Task 3 in docs/BUILD_PLAN.md.
 *
 * STUB: every function throws. Task 3 implements CSV/XLSX import with column
 * mapping and request matching, the SportsEngine Teams/Schedule import CSVs,
 * the roster drag list, and the question pack for the registration builder.
 */
import type { BridgeApi } from '@bvac/core';

export const BRIDGE_IS_STUB = true;

const notYet = (name: string) => () => {
  throw new Error(`@bvac/se-bridge: ${name} is not implemented yet (Task 3)`);
};

export const bridge: BridgeApi = {
  suggestMapping: notYet('suggestMapping'),
  importRegistrations: notYet('importRegistrations'),
  exportTeamsCsv: notYet('exportTeamsCsv'),
  exportScheduleCsv: notYet('exportScheduleCsv'),
  rosterList: notYet('rosterList'),
  questionPack: notYet('questionPack'),
};
