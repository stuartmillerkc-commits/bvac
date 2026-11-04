/**
 * Writes the sample SportsEngine Saved Report used by the demo and tests:
 *   pnpm --filter @bvac/se-bridge fixture
 * A test fails when the committed copy is out of date.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateSeason } from '@bvac/seed';
import { sampleSportsEngineExport } from '../src/exports';

export const FIXTURE_FILE = 'sportsengine-saved-report.csv';

const out = fileURLToPath(new URL(`../fixtures/${FIXTURE_FILE}`, import.meta.url));
writeFileSync(out, sampleSportsEngineExport(generateSeason()));
console.log(`Wrote ${out}`);
