/** Prints engine results on the sample season: `pnpm --filter @bvac/engine report` */
import { generateSeason } from '@bvac/seed';
import { placeDivision, satisfactionTotal } from '../src/index';

const data = generateSeason();
const t0 = performance.now();
for (const d of data.divisions) {
  const input = { data, divisionId: d.id, round: 2 as const, fixed: [] };
  const r = placeDivision(input);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const s = r.stats;
  console.log(
    `${d.code} ${d.settings.model.padEnd(6)} regs ${s.registrations} placed ${s.placed} wait ${s.waitlisted} | 1st ${pct(s.firstChoiceRate)} any ${pct(s.anyChoiceRate)} friends ${pct(s.friendRequestRate)} sibs ${pct(s.siblingTogetherRate)} coach ${pct(s.coachRequestRate)} | sizes ${s.smallestTeam}-${s.largestTeam} | flags ${r.flags.length} | utility ${Math.round(satisfactionTotal(input, r))}`,
  );
  const ms = placeDivision({ ...input, settingsOverride: { placementMethod: 'maxSatisfaction' } });
  console.log(`   maxSat: 1st ${pct(ms.stats.firstChoiceRate)} any ${pct(ms.stats.anyChoiceRate)} friends ${pct(ms.stats.friendRequestRate)} utility ${Math.round(satisfactionTotal({ ...input, settingsOverride: { placementMethod: 'maxSatisfaction' } }, ms))}`);
  for (const f of r.flags.filter((f) => f.severity !== 'info')) console.log('   flag:', f.code, f.message);
}
console.log(`total ${Math.round(performance.now() - t0)} ms (incl. maxSat runs)`);
const d3 = data.divisions[3]!;
const r = placeDivision({ data, divisionId: d3.id, round: 2, fixed: [] });
for (const p of r.placements.slice(0, 6)) console.log(p.state, p.teamId, p.reasons.map((x) => x.text).join(' · '));
