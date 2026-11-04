'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { dayLong, formatDate, teamPracticeWindow, type Division, type Grade, type Weekday } from '@bvac/core';
import { useSeason } from '@/lib/season-store';
import {
  divisionForGrade,
  gradeFromBirthdate,
  gradeOptions,
  gradeText,
  isFirstComeFirstServed,
  schoolYearLabel,
  visibleTeams,
} from './helpers';
import { seatRuleText } from './SeatChip';
import { TeamOptionCard } from './TeamOptionCard';
import { useTrackDescriptions } from './useTrackDescriptions';
import s from './family.module.css';

const MODEL_NAMES: Record<Division['settings']['model'], string> = {
  ranked: 'Ranked choice',
  fcfs: 'First come, first served',
  coachSelect: 'Coach selection',
  availabilityCluster: 'Availability clustering',
  hybrid: 'Ranked choice with coach review',
};

export function TeamFinder() {
  const { data, index } = useSeason();
  const params = useSearchParams();
  const divisions = useMemo(() => [...data.divisions].sort((a, b) => a.sortOrder - b.sortOrder), [data.divisions]);
  const fromUrl = params.get('division');
  const [divisionCode, setDivisionCode] = useState<string>(
    divisions.find((d) => d.code === fromUrl)?.code ?? divisions[0]?.code ?? '',
  );
  const [nights, setNights] = useState<Weekday[]>([]);
  const [onlyTheseNights, setOnlyTheseNights] = useState(false);
  const tracks = useTrackDescriptions();

  const division = divisions.find((d) => d.code === divisionCode) ?? divisions[0];

  const chooseDivision = (code: string) => {
    setDivisionCode(code);
    setNights([]);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('division', code);
      window.history.replaceState(null, '', url);
    } catch {
      // URL sync is a convenience only.
    }
  };

  if (!division) return <p>No divisions in this season yet.</p>;

  const teams = visibleTeams(index, division.id);
  const teamNights = [...new Set(teams.map((t) => teamPracticeWindow(index, t).day))];
  const matches = (day: Weekday) => nights.length === 0 || nights.includes(day);
  const shown = teams.filter((t) => matches(teamPracticeWindow(index, t).day));
  const others = onlyTheseNights ? [] : teams.filter((t) => !matches(teamPracticeWindow(index, t).day));
  const fcfs = isFirstComeFirstServed(division);
  const season = data.season;

  return (
    <div className={`${s.page} ${s.stack}`}>
      <header>
        <h1>Team Finder</h1>
        <p className={`muted ${s.intro}`}>
          Every {season.name} team option, with its practice night, field, game times and coach. Find the ones that fit your week, then
          pick them as your 1st and 2nd choice when you register. Early registration runs {formatDate(season.windows.early.start)} –{' '}
          {formatDate(season.windows.early.end)}.
        </p>
      </header>

      <section className={`card ${s.toolbar}`} aria-label="Filters">
        <div className={s.fieldset} role="group" aria-labelledby="finder-division-label">
          <span id="finder-division-label" className={s.label}>
            Division
          </span>
          <div className={s.tabs}>
            {divisions.map((d) => (
              <button
                key={d.id}
                type="button"
                className={s.tab}
                aria-pressed={d.code === division.code}
                onClick={() => chooseDivision(d.code)}
              >
                {d.name}
                <span className={s.tabSub}>{d.label}</span>
              </button>
            ))}
          </div>
        </div>

        <DivisionHelper divisions={divisions} onPick={chooseDivision} />

        <fieldset className={s.fieldset}>
          <legend className={s.label}>Nights that work for us</legend>
          <div className={s.choices}>
            {teamNights.map((day) => (
              <label key={day} className={s.pill}>
                <input
                  type="checkbox"
                  checked={nights.includes(day)}
                  onChange={(e) => setNights((prev) => (e.target.checked ? [...prev, day] : prev.filter((x) => x !== day)))}
                />
                {dayLong(day)}
              </label>
            ))}
          </div>
          <label className={s.check}>
            <input type="checkbox" role="switch" checked={onlyTheseNights} onChange={(e) => setOnlyTheseNights(e.target.checked)} />
            Only show these nights
          </label>
        </fieldset>
      </section>

      <section className={s.stack} aria-labelledby="finder-results">
        <div>
          <h2 id="finder-results" style={{ marginBottom: 4 }}>
            {division.name} · {division.label}
          </h2>
          <p className="muted" style={{ margin: 0 }}>
            {MODEL_NAMES[division.settings.model]} · teams of {division.settings.teamSize.preferred}–{division.settings.teamSize.max} ·{' '}
            {teams.length} team options
          </p>
        </div>
        <p className={s.ruleNote}>{seatRuleText(fcfs)}</p>
        <p className={s.srOnly} aria-live="polite">
          {shown.length} team options match.
        </p>
        {shown.length ? (
          <div className={s.teamGrid}>
            {shown.map((t) => (
              <TeamOptionCard key={t.id} team={t} division={division} gamePattern={t.gameTrackId ? tracks.get(t.gameTrackId) : undefined} />
            ))}
          </div>
        ) : (
          <p className="card">
            No {division.name} team practices on {nights.map(dayLong).join(' or ')}. Try another night, or register anyway: BVAC uses
            these numbers to recruit coaches for the nights families ask for most.
          </p>
        )}
        {others.length > 0 && nights.length > 0 ? (
          <>
            <h3 className={s.sectionTitle}>Other nights</h3>
            <div className={s.teamGrid}>
              {others.map((t) => (
                <TeamOptionCard
                  key={t.id}
                  team={t}
                  division={division}
                  dimmed
                  gamePattern={t.gameTrackId ? tracks.get(t.gameTrackId) : undefined}
                />
              ))}
            </div>
          </>
        ) : null}
      </section>

      <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
        All practices and games are at the BVAC Holke Rd. complex. Practices run {formatDate(season.practices.start)} –{' '}
        {formatDate(season.practices.end)}; games are on Saturdays from {formatDate(season.gameDates[0] ?? season.practices.start)}. Grades
        are for the {schoolYearLabel(season)} school year.
      </p>
    </div>
  );
}

function DivisionHelper({ divisions, onPick }: { divisions: Division[]; onPick: (code: string) => void }) {
  const { data } = useSeason();
  const [grade, setGrade] = useState<string>('');
  const [birthdate, setBirthdate] = useState('');
  const fromBirthdate = birthdate ? gradeFromBirthdate(birthdate, data.season) : null;
  const g: Grade | null = grade !== '' ? Number(grade) : fromBirthdate;
  const found = g !== null ? divisionForGrade(divisions, g) : undefined;
  const year = schoolYearLabel(data.season);
  return (
    <details className={s.helper}>
      <summary>Which division am I in?</summary>
      <div className={s.formGrid} style={{ marginTop: 12 }}>
        <label className={s.field}>
          <span className={s.label}>School grade in {year}</span>
          <select value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">Choose a grade</option>
            {gradeOptions(divisions).map((x) => (
              <option key={x} value={x}>
                {gradeText(x)}
              </option>
            ))}
          </select>
        </label>
        <label className={s.field}>
          <span className={s.label}>Or birthdate</span>
          <input type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} />
          <span className={s.hint}>An estimate from the usual school cutoff. BVAC goes by school grade.</span>
        </label>
      </div>
      <div aria-live="polite" style={{ marginTop: 8 }}>
        {g !== null ? (
          found ? (
            <div className={s.row}>
              <span>
                {grade === '' ? `Likely ${gradeText(g)} · ` : ''}
                <strong>{found.name}</strong> ({found.label})
              </span>
              <button type="button" className="button secondary" onClick={() => onPick(found.code)}>
                Show {found.name}
              </button>
            </div>
          ) : (
            <span className="muted">
              {g < (divisions[0]?.minGrade ?? 0)
                ? 'Too young for this season. Soccer starts at age 3.'
                : 'Older than our soccer divisions this season. Call the BVAC office to ask about older age groups.'}
            </span>
          )
        ) : null}
      </div>
    </details>
  );
}
