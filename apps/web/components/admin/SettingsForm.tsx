'use client';

import { useSearchParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import {
  FACTORS,
  FACTOR_LABELS,
  type Division,
  type DivisionSettings,
  type OrganizingModel,
  type PriorityPoints,
} from '@bvac/core';
import { useSeason } from '@/lib/season-store';
import { AdminHeader, DivisionPills } from './AdminNav';
import { divisionByCode, sortedDivisions } from './model';

const MODELS: { value: OrganizingModel; label: string; help: string }[] = [
  {
    value: 'ranked',
    label: 'Ranked choice',
    help: 'Coaches claim slots first. Families rank team options and factors. The engine places by priority rules in rounds. Best for most divisions.',
  },
  {
    value: 'fcfs',
    label: 'First come, first served',
    help: 'Families pick a team option with open seats, like booking a class. Simplest to explain, but rewards whoever registers first and friend groups scatter.',
  },
  {
    value: 'coachSelect',
    label: 'Coach selection',
    help: 'Coaches get protected picks, then approve a suggested list. Good for older divisions with strong coach–player continuity; slower.',
  },
  {
    value: 'availabilityCluster',
    label: 'Availability clustering (not in this demo)',
    help: 'No pre-built slots: the engine finds practice times that cover the most kids, then admins recruit coaches. The demo places these like ranked choice.',
  },
  {
    value: 'hybrid',
    label: 'Hybrid',
    help: 'Coach protected picks → ranked-choice round 1 → coach approval → round 2 → waitlist. The full process; best results, most steps.',
  },
];

const PRIORITY_FIELDS: { key: keyof PriorityPoints; label: string; help: string }[] = [
  { key: 'earlyWindow', label: 'Registered in early window', help: 'Every team.' },
  { key: 'playedForCoachLastSeason', label: 'Played for this coach last season', help: "That coach's team only." },
  { key: 'playedLastSeason', label: 'Played BVAC last season', help: 'Every team.' },
  { key: 'siblingOnTeam', label: 'Sibling already on this team', help: 'Another-division sibling, or a family that opted out of grouping.' },
  { key: 'perPriorSeason', label: 'Each earlier BVAC season', help: 'Every team.' },
  { key: 'perPriorSeasonCap', label: '…up to a maximum of', help: 'Cap for earlier seasons.' },
  { key: 'perSeasonWithCoach', label: 'Each earlier season with this coach', help: "That coach's team only." },
  { key: 'perSeasonWithCoachCap', label: '…up to a maximum of', help: 'Cap for seasons with the coach.' },
];

export function SettingsForm() {
  const params = useSearchParams();
  const { index } = useSeason();
  const divisions = sortedDivisions(index);
  const division = divisionByCode(index, params.get('d')) ?? divisions[0]!;
  // Lives here because saving re-keys the form below.
  const [savedFor, setSavedFor] = useState<string | null>(null);
  return (
    <div className="adm-stack">
      <AdminHeader title="Division settings">
        <DivisionPills divisions={divisions} current={division} hrefFor={(d) => `/admin/settings/?d=${d.code}`} />
      </AdminHeader>
      {/* Re-key on saved values so the form picks up settings loaded from this browser. */}
      <DivisionForm
        key={`${division.id}:${JSON.stringify(division.settings)}`}
        division={division}
        saved={savedFor === division.id}
        setSaved={(v) => setSavedFor(v ? division.id : null)}
      />
    </div>
  );
}

function DivisionForm({ division, saved, setSaved }: { division: Division; saved: boolean; setSaved: (v: boolean) => void }) {
  const { setDivisionSettings, updateEdits, edits } = useSeason();
  const [draft, setDraft] = useState<DivisionSettings>(division.settings);
  const set = (patch: Partial<DivisionSettings>) => {
    setSaved(false);
    setDraft((d) => ({ ...d, ...patch }));
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(division.settings);
  const size = draft.teamSize;
  const sizeError = size.min > size.preferred || size.preferred > size.max ? 'Team sizes must be min ≤ preferred ≤ max.' : null;
  const hasOverride = !!edits.divisionSettings[division.id];
  const id = (k: string) => `set-${division.code}-${k}`;
  const num = (v: string, min = 0) => Math.max(min, Math.round(Number(v) || 0));

  return (
    <form
      className="adm-form adm-stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (sizeError) return;
        setDivisionSettings(division.id, draft);
        setSaved(true);
      }}
    >
      <p className="muted" style={{ margin: 0 }}>
        {division.name} ({division.label}). Changes re-run this division&apos;s placements as soon as you save. Pinned and published placements
        stay where they are.
      </p>

      <fieldset>
        <legend>How teams are formed</legend>
        <Field label="Organizing model" htmlFor={id('model')} help={MODELS.find((m) => m.value === draft.model)?.help}>
          <select id={id('model')} className="adm-select" value={draft.model} onChange={(e) => set({ model: e.target.value as OrganizingModel })}>
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Placement method"
          htmlFor={id('method')}
          help={
            draft.placementMethod === 'priorityFirst'
              ? 'Deferred acceptance: families rank teams, teams rank kids by the priority points below, and nobody is bumped from a team they ranked higher by a kid with lower priority. Fair and easy to explain.'
              : 'Looks for the rosters with the highest total fit, with priority as one weighted term. It may give more kids their top choice, but is harder to explain to a family who got their 3rd choice.'
          }
        >
          <select
            id={id('method')}
            className="adm-select"
            value={draft.placementMethod}
            onChange={(e) => set({ placementMethod: e.target.value as DivisionSettings['placementMethod'] })}
          >
            <option value="priorityFirst">Priority-first (recommended)</option>
            <option value="maxSatisfaction">Maximize satisfaction</option>
          </select>
        </Field>
        <Field
          label="Round 1 fill level"
          htmlFor={id('fill')}
          help="Round 1 places early registrants. Filling only to preferred size leaves room for regular registrants in round 2, which fills to max."
        >
          <select id={id('fill')} className="adm-select" value={draft.round1Fill} onChange={(e) => set({ round1Fill: e.target.value as 'preferred' | 'max' })}>
            <option value="preferred">Preferred size</option>
            <option value="max">Max size</option>
          </select>
        </Field>
      </fieldset>

      <fieldset>
        <legend>Team size</legend>
        <div className="adm-field">
          <div className="adm-inline-fields">
            {(['min', 'preferred', 'max'] as const).map((k) => (
              <label key={k} htmlFor={id(`size-${k}`)}>
                <span>{k === 'min' ? 'Minimum' : k === 'preferred' ? 'Preferred' : 'Maximum'}</span>
                <input
                  id={id(`size-${k}`)}
                  className="adm-input"
                  type="number"
                  min={1}
                  max={30}
                  value={size[k]}
                  onChange={(e) => set({ teamSize: { ...size, [k]: num(e.target.value, 1) } })}
                  aria-invalid={!!sizeError}
                />
              </label>
            ))}
          </div>
          <p className="help">Teams under the minimum are flagged. The number of teams needed is registrations ÷ preferred size.</p>
          {sizeError && (
            <p className="help" role="alert" style={{ color: 'var(--color-critical)' }}>
              {sizeError}
            </p>
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend>Coaches, siblings and requests</legend>
        <Field
          label="Coach protected picks"
          htmlFor={id('picks')}
          help="Players each head coach can lock onto their team before placement runs (returning players, an assistant coach's kids). The coach's own children are always locked and don't count."
        >
          <input
            id={id('picks')}
            className="adm-input"
            type="number"
            min={0}
            max={10}
            value={draft.coachProtectedPicks}
            onChange={(e) => set({ coachProtectedPicks: num(e.target.value) })}
          />
        </Field>
        <Check
          checked={draft.keepSiblingsTogether}
          onChange={(v) => set({ keepSiblingsTogether: v })}
          label="Keep same-division siblings together"
          help="Siblings in the same division are placed as one unit. A family can still opt out on the form."
        />
        <Field
          label="Player requests per kid"
          htmlFor={id('requests')}
          help="Friend or sibling requests each kid can make. More requests means more chains that can't all be met. Mutual friend requests count more."
        >
          <input
            id={id('requests')}
            className="adm-input"
            type="number"
            min={0}
            max={5}
            value={draft.maxPlayerRequests}
            onChange={(e) => set({ maxPlayerRequests: num(e.target.value) })}
          />
        </Field>
      </fieldset>

      <fieldset>
        <legend>Factor weights</legend>
        <p className="help muted adm-small" style={{ margin: 0 }}>
          BVAC&apos;s weight W for each factor in a team&apos;s fit score. Each family&apos;s own &quot;what matters most&quot; ranking scales these for
          their kid only (1st ×4, 2nd ×3, 3rd ×2, 4th ×1). Used to order teams a family didn&apos;t rank.
        </p>
        <div className="adm-inline-fields">
          {FACTORS.map((f) => (
            <label key={f} htmlFor={id(`w-${f}`)}>
              <span>{FACTOR_LABELS[f]}</span>
              <input
                id={id(`w-${f}`)}
                className="adm-input"
                type="number"
                min={0}
                max={100}
                value={draft.factorWeights[f]}
                onChange={(e) => set({ factorWeights: { ...draft.factorWeights, [f]: num(e.target.value) } })}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Priority points</legend>
        <p className="help muted adm-small" style={{ margin: 0 }}>
          Each team ranks its applicants by these points, so a returning player has priority on their coach&apos;s team, not every team. Ties go
          to the earlier registration.
        </p>
        <div className="adm-inline-fields" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {PRIORITY_FIELDS.map((p) => (
            <label key={p.key} htmlFor={id(`p-${p.key}`)}>
              <span>{p.label}</span>
              <input
                id={id(`p-${p.key}`)}
                className="adm-input"
                type="number"
                min={0}
                max={100}
                style={{ width: 90 }}
                value={draft.priority[p.key]}
                onChange={(e) => set({ priority: { ...draft.priority, [p.key]: num(e.target.value) } })}
              />
              <span className="muted adm-small">{p.help}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>What families see</legend>
        <Check
          checked={draft.showCoachNames}
          onChange={(v) => set({ showCoachNames: v })}
          label="Show coach names to families"
          help="On: the Team Finder shows each option's coach. Off: times only. Coach requests need names."
        />
        <Check
          checked={draft.showProjectedToFamilies}
          onChange={(v) => set({ showProjectedToFamilies: v })}
          label="Show projected placements to families"
          help="Off (recommended): families see only seats open / filling / likely full until a round publishes."
        />
      </fieldset>

      <fieldset>
        <legend>Schedule</legend>
        <Field
          label="Game time style"
          htmlFor={id('style')}
          help={
            draft.gameTimeStyle === 'anchored'
              ? 'Each schedule position has a home time ("mostly 9am") with 2–3 games at other times, so teams don\'t only play the other 9am teams. Recommended.'
              : 'Every team gets about the same mix of early and late games.'
          }
        >
          <select
            id={id('style')}
            className="adm-select"
            value={draft.gameTimeStyle}
            onChange={(e) => set({ gameTimeStyle: e.target.value as DivisionSettings['gameTimeStyle'] })}
          >
            <option value="anchored">Anchored</option>
            <option value="rotating">Rotating</option>
          </select>
        </Field>
        <Field label="Practices per week" htmlFor={id('practices')} help="1 is the default. With 2, a team option needs two practice slots (not in this demo).">
          <input
            id={id('practices')}
            className="adm-input"
            type="number"
            min={1}
            max={3}
            value={draft.practicesPerWeek}
            onChange={(e) => set({ practicesPerWeek: num(e.target.value, 1) })}
          />
        </Field>
      </fieldset>

      <div className="adm-row adm-sticky-save">
        <button type="submit" className="button" disabled={!dirty || !!sizeError}>
          Save settings
        </button>
        <button type="button" className="button secondary" disabled={!dirty} onClick={() => setDraft(division.settings)}>
          Discard changes
        </button>
        <button
          type="button"
          className="adm-btn"
          disabled={!hasOverride}
          onClick={() =>
            updateEdits((e) => {
              const next = { ...e.divisionSettings };
              delete next[division.id];
              return { ...e, divisionSettings: next };
            })
          }
        >
          Restore season defaults
        </button>
        <span role="status" className="adm-small muted">
          {saved && !dirty ? 'Saved. Placements updated.' : dirty ? 'Unsaved changes' : ''}
        </span>
      </div>
    </form>
  );
}

function Field({ label, htmlFor, help, children }: { label: string; htmlFor: string; help?: string | undefined; children: ReactNode }) {
  return (
    <div className="adm-field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {help && <p className="help">{help}</p>}
    </div>
  );
}

function Check({ checked, onChange, label, help }: { checked: boolean; onChange: (v: boolean) => void; label: string; help: string }) {
  return (
    <label className="adm-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <b style={{ fontWeight: 600 }}>{label}</b>
        <span className="help muted adm-small" style={{ display: 'block' }}>
          {help}
        </span>
      </span>
    </label>
  );
}
