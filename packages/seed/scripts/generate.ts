import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateSeasonData } from '@bvac/core';
import { generateSeason, summarizeSeason } from '../src/index';

const data = generateSeason();
const problems = validateSeasonData(data);
if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}
const dir = fileURLToPath(new URL('../data/', import.meta.url));
writeFileSync(`${dir}spring-2027.json`, `${JSON.stringify(data, null, 1)}\n`);
writeFileSync(`${dir}SUMMARY.md`, summarizeSeason(data));
console.log(`Wrote ${data.registrations.length} registrations, ${data.teams.length} teams to packages/seed/data/`);
