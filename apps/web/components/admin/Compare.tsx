'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { FACTORS, FACTOR_LABELS, type Division, type DivisionSettings, type PlacementRunResult } from '@bvac/core';
import { placeDivision } from '@bvac/engine';
import { useSeason } from '@/lib/season-store';
import { AdminHeader, DivisionPills } from './AdminNav';
import { divisionByCode, inDivision, sortedDivisions } from './model';

type Override = Partial<DivisionSettings>;

interface Scenario {
  name: string;
  override: Override;
}

const PRESETS: { label: string; a: Scenario; b: (s: DivisionSettings) => Scenario }[] = [
  {
    label: 'Priority-first vs maximize satisfaction',
    a: { name: 'Priority-first', override: { placementMethod: 'priorityFirst' } },
    b: () => ({ name: 'Maximize satisfaction', override: { placementMethod: 'maxSatisfaction' } }),
  },
  {
    label: 'Max team size +1',
    a: { name: 'Current sizes', override: {} },
    b: (s) => ({ name: `Max ${s.teamSize.max + 1}`, override: { teamSize: { ...s.teamSize, max: s.teamSize.max + 1 } } }),
  },
  {
    label: 'Siblings together on vs off',
    a: { name: 'Siblings together', override: { keepSiblingsTogether: true } },
    b: () => ({ name: 'Siblings not grouped', override: { keepSiblingsTogether: false } }),
  },
  {
    label: 'Friends count double',
    a: { name: 'Current weights', override: {} },
    b: (s) => ({ name: 'Friends ×2', override: { factorWeights: { ...s.factorWeights, friends: s.factorWeights.friends * 2 } } }),
  },
];

const STAT_ROWS: { key: keyof PlacementRunResult['stats']; label: string; pct?: boolean; higherIsBetter?: boolean }[] = [
  { key: 'placed', label: 'Placed', higherIsBetter: true },
  { key: 'waitlisted', label: 'Waitlisted', higherIsBetter: false },
  { key: 'firstChoiceRate', label: 'Got 1st choice', pct: true, higherIsBetter: true },
  { key: 'anyChoiceRate', label: 'Got a ranked choice', pct: true, higherIsBetter: true },
  { key: 'friendRequestRate', label: 'Friend requests met', pct: true, higherIsBetter: true },
  { key: 'siblingTogetherRate', label: 'Sibling groups together', pct: true, higherIsBetter: true },
  { key: 'coachRequestRate', label: 'Coach requests met', pct: true, higherIsBetter: true },
  { key: 'smallestTeam', label: 'Smallest team', higherIsBetter: true },
  { key: 'largestTeam', label: 'Largest team' },
];

export function Compare() {
  const params = useSearchParams();
  const { index } = useSeason();
  const divisions = sortedDivisions(index);
  const division = divisionByCode(index, params.get('d')) ?? divisions.find((d) => d.settings.model !== 'fcfs') ?? divisions[0]!;
  return (
    <div className="adm-stack">
      <AdminHeader title="Compare scenarios">
        <DivisionPills divisions={divisions} current={division} hrefFor={(d) => `/admin/compare/?d=${d.code}`} />
      </AdminHeader>
      <CompareDivision key={division.id} division={division} />
    </div>
  );
}

function CompareDivision({ division }: { division: Division }) {
  const { data, index, fixed, asOf } = useSeason();
  const s = division.settings;
  const [a, setA] = useState<Scenario>(PRESETS[0]!.a);
  const [b, setB] = useState<Scenario>(PRESETS[0]!.b(s));
  const [round, setRound] = useState<1 | 2>(2);

  const own = useMemo(() => fixed.filter(inDivision(index, division.id)), [fixed, index, division.id]);
  const divisionId = division.id;
  const ra = useMemo(
    () => placeDivision({ data, divisionId, round, fixed: own, settingsOverride: a.override, ...(asOf ? { asOf } : {}) }),
    [data, divisionId, round, own, a, asOf],
  );
  const rb = useMemo(
    () => placeDivision({ data, divisionId, round, fixed: own, settingsOverride: b.override, ...(asOf ? { asOf } : {}) }),
    [data, divisionId, round, own, b, asOf],
  );

  const teamA = new Map(ra.placements.map((p) => [p.registrationId, p.teamId]));
  const changed = rb.placements.filter((p) => teamA.has(p.registrationId) && teamA.get(p.registrationId) !== p.teamId).length;
  const sizes = (r: PlacementRunResult) => {
    const n = new Map<string, number>();
    for (const p of r.placements) if (p.teamId) n.set(p.teamId, (n.get(p.teamId) ?? 0) + 1);
    return n;
  };

  return (
    <>
      <section className="card adm-stack" aria-label="Scenarios">
        <div className="adm-row">
          <span className="adm-small muted">Quick picks:</span>
          <div className="adm-pills" role="group" aria-label="Preset comparisons">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                aria-pressed={a.name === p.a.name && b.name === p.b(s).name}
                onClick={() => {
                  setA(p.a);
                  setB(p.b(s));
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="adm-row">
          <label className="adm-row adm-small">
            Round
            <select className="adm-select" value={round} onChange={(e) => setRound(Number(e.target.value) as 1 | 2)}>
              <option value={1}>Round 1 (early, to preferred size)</option>
              <option value={2}>Round 2 (everyone, to max)</option>
            </select>
          </label>
          <span className="muted adm-small">
            Both scenarios keep this division&apos;s pinned and published placements. Nothing here changes the real settings.
          </span>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <ScenarioEditor label="Scenario A" scenario={a} settings={s} onChange={setA} />
          <ScenarioEditor label="Scenario B" scenario={b} settings={s} onChange={setB} />
        </div>
      </section>

      <section className="card adm-stack" aria-labelledby="results-title">
        <h2 id="results-title" style={{ margin: 0 }}>
          Results
        </h2>
        <p style={{ margin: 0 }}>
          <b>{changed}</b> of {rb.placements.length} kids are on a different team (or waitlist) in B than in A.
        </p>
        <div className="table-wrap">
          <table className="adm-compare">
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col">A · {a.name}</th>
                <th scope="col">B · {b.name}</th>
                <th scope="col">Difference</th>
              </tr>
            </thead>
            <tbody>
              {STAT_ROWS.map((row) => {
                const va = ra.stats[row.key];
                const vb = rb.stats[row.key];
                const fmt = (v: number) => (row.pct ? `${Math.round(v * 100)}%` : String(v));
                const diff = row.pct ? Math.round(vb * 100) - Math.round(va * 100) : vb - va;
                const cls =
                  row.higherIsBetter === undefined || diff === 0 ? '' : (diff > 0) === row.higherIsBetter ? 'better' : 'worse';
                return (
                  <tr key={row.key}>
                    <th scope="row">{row.label}</th>
                    <td>{fmt(va)}</td>
                    <td>{fmt(vb)}</td>
                    <td className={cls}>{diff === 0 ? '—' : `${diff > 0 ? '+' : ''}${diff}${row.pct ? ' pts' : ''}`}</td>
                  </tr>
                );
              })}
              <tr>
                <th scope="row">Team-size spread</th>
                <td>{ra.stats.largestTeam - ra.stats.smallestTeam}</td>
                <td>{rb.stats.largestTeam - rb.stats.smallestTeam}</td>
                <td>—</td>
              </tr>
              <tr>
                <th scope="row">Flags (warnings or worse)</th>
                <td>{ra.flags.filter((f) => f.severity !== 'info').length}</td>
                <td>{rb.flags.filter((f) => f.severity !== 'info').length}</td>
                <td>—</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Team size</th>
                {(index.teamsByDivision.get(division.id) ?? [])
                  .filter((t) => t.status !== 'cancelled')
                  .map((t) => (
                    <th key={t.id} scope="col">
                      {t.label}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['A', ra],
                  ['B', rb],
                ] as const
              ).map(([label, r]) => {
                const n = sizes(r);
                return (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    {(index.teamsByDivision.get(division.id) ?? [])
                      .filter((t) => t.status !== 'cancelled')
                      .map((t) => (
                        <td key={t.id}>{n.get(t.id) ?? 0}</td>
                      ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function ScenarioEditor({
  label,
  scenario,
  settings,
  onChange,
}: {
  label: string;
  scenario: Scenario;
  settings: DivisionSettings;
  onChange: (s: Scenario) => void;
}) {
  const eff: DivisionSettings = { ...settings, ...scenario.override };
  const set = (patch: Override) => onChange({ name: 'Custom', override: { ...scenario.override, ...patch } });
  const id = label.replace(/\W+/g, '-').toLowerCase();
  return (
    <fieldset className="adm-stack" style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 12, margin: 0, minWidth: 0 }}>
      <legend style={{ fontWeight: 700 }}>
        {label}: {scenario.name}
      </legend>
      <label className="adm-field adm-small">
        Placement method
        <select
          className="adm-select"
          value={eff.placementMethod}
          onChange={(e) => set({ placementMethod: e.target.value as DivisionSettings['placementMethod'] })}
        >
          <option value="priorityFirst">Priority-first (deferred acceptance)</option>
          <option value="maxSatisfaction">Maximize satisfaction</option>
        </select>
      </label>
      <div className="adm-inline-fields">
        {(['min', 'preferred', 'max'] as const).map((k) => (
          <label key={k} htmlFor={`${id}-${k}`}>
            <span className="adm-small">Size {k}</span>
            <input
              id={`${id}-${k}`}
              className="adm-input"
              type="number"
              min={1}
              max={30}
              style={{ width: 70 }}
              value={eff.teamSize[k]}
              onChange={(e) => set({ teamSize: { ...eff.teamSize, [k]: Math.max(1, Number(e.target.value) || 1) } })}
            />
          </label>
        ))}
      </div>
      <label className="adm-field adm-small">
        Round 1 fills to
        <select className="adm-select" value={eff.round1Fill} onChange={(e) => set({ round1Fill: e.target.value as 'preferred' | 'max' })}>
          <option value="preferred">Preferred size</option>
          <option value="max">Max size</option>
        </select>
      </label>
      <label className="adm-check adm-small">
        <input type="checkbox" checked={eff.keepSiblingsTogether} onChange={(e) => set({ keepSiblingsTogether: e.target.checked })} />
        Keep same-division siblings together
      </label>
      <div className="adm-inline-fields">
        {FACTORS.map((f) => (
          <label key={f} htmlFor={`${id}-${f}`}>
            <span className="adm-small">{FACTOR_LABELS[f]}</span>
            <input
              id={`${id}-${f}`}
              className="adm-input"
              type="number"
              min={0}
              max={100}
              style={{ width: 70 }}
              value={eff.factorWeights[f]}
              onChange={(e) => set({ factorWeights: { ...eff.factorWeights, [f]: Math.max(0, Number(e.target.value) || 0) } })}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
