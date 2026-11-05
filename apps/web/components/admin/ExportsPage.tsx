'use client';

import { useMemo, useState } from 'react';
import { practiceEvents } from '@bvac/schedule';
import { exportScheduleCsv, exportTeamsCsv, questionPack, rosterList, rosterListCsv, scheduleImportReadme } from '@bvac/se-bridge';
import { downloadText } from '@/lib/download';
import { useSeason } from '@/lib/season-store';
import { AdminHeader } from './AdminNav';

/** Files that go back into SportsEngine, plus the question pack for its registration builder. */
export function ExportsPage() {
  const { data, results, games } = useSeason();
  const [copied, setCopied] = useState(false);
  const [publishedOnly, setPublishedOnly] = useState(false);
  const teams = useMemo(() => data.teams.filter((t) => t.status !== 'cancelled'), [data.teams]);
  const placements = useMemo(() => Object.values(results).flatMap((r) => r.placements), [results]);
  const rosterPlacements = publishedOnly ? placements.filter((p) => p.state === 'published') : placements;
  const roster = useMemo(() => rosterList(data, rosterPlacements), [data, rosterPlacements]);
  const practices = useMemo(() => practiceEvents(data, teams).length, [data, teams]);
  const pack = useMemo(() => questionPack(data), [data]);
  const publishedCount = placements.filter((p) => p.state === 'published').length;
  const slug = 'bvac-soccer-spring-2027';

  return (
    <div className="adm-stack">
      <div className="no-print">
        <AdminHeader title="Exports for SportsEngine" />
        <p className="muted" style={{ margin: 0, maxWidth: 760 }}>
          SportsEngine stays the place families see their team. These files move the companion&apos;s decisions into it: teams and the
          schedule by CSV import, players by the rostering list. Column names are guesses until we see BVAC&apos;s SportsEngine account, and
          they live in one settings file so they&apos;re quick to adjust.
        </p>
      </div>

      <section className="card adm-stack no-print" aria-labelledby="exp-teams">
        <h2 id="exp-teams" style={{ margin: 0 }}>
          Teams
        </h2>
        <p className="muted adm-small" style={{ margin: 0 }}>
          {teams.length} teams for Season Management → Teams Import. Upload this first.
        </p>
        <div>
          <button type="button" className="button small" onClick={() => downloadText(`${slug}-teams.csv`, exportTeamsCsv(data, teams))}>
            Download teams CSV
          </button>
        </div>
      </section>

      <section className="card adm-stack no-print" aria-labelledby="exp-schedule">
        <h2 id="exp-schedule" style={{ margin: 0 }}>
          Game and practice schedule
        </h2>
        <p className="muted adm-small" style={{ margin: 0 }}>
          {games.length} games and {practices} practices for Season Management → Schedule Import.
        </p>
        <div className="adm-notice adm-small">
          Re-uploading a schedule can replace every event from earlier uploads. Read the instructions file before importing a second time.
        </div>
        <div className="adm-row">
          <button type="button" className="button small" onClick={() => downloadText(`${slug}-schedule.csv`, exportScheduleCsv(data, teams, games))}>
            Download schedule CSV
          </button>
          <button
            type="button"
            className="adm-btn"
            onClick={() => downloadText(`${slug}-schedule-README.txt`, scheduleImportReadme(data), 'text/plain;charset=utf-8')}
          >
            Download instructions
          </button>
        </div>
      </section>

      <section className="card adm-stack print-area" aria-labelledby="exp-roster">
        <div className="adm-spread">
          <h2 id="exp-roster" style={{ margin: 0 }}>
            Roster list for SportsEngine&apos;s rostering tool
          </h2>
          <div className="adm-row no-print">
            <label className="adm-small">
              <input type="checkbox" checked={publishedOnly} onChange={(e) => setPublishedOnly(e.target.checked)} /> Published only (
              {publishedCount})
            </label>
            <button type="button" className="adm-btn" onClick={() => window.print()}>
              Print
            </button>
            <button type="button" className="button small" onClick={() => downloadText(`${slug}-roster-list.csv`, rosterListCsv(roster))}>
              Download CSV
            </button>
          </div>
        </div>
        <p className="muted adm-small" style={{ margin: 0 }}>
          {roster.length} players in the order you work through Rostering → Assign Players: division, team, last name.
          {!publishedOnly && ' Includes projected placements that are not published yet.'}
        </p>
        {roster.length === 0 ? (
          <p className="muted">No placements to list yet.</p>
        ) : (
          <div className="table-wrap" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Division</th>
                  <th scope="col">Team</th>
                  <th scope="col">Coach</th>
                  <th scope="col">Player</th>
                  <th scope="col">Birthdate</th>
                  <th scope="col">SportsEngine ID</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((r, i) => (
                  <tr key={`${r.externalId ?? ''}-${i}`}>
                    <td>{r.divisionName}</td>
                    <td>{r.teamLabel}</td>
                    <td>{r.coachName}</td>
                    <td>
                      {r.playerLastName}, {r.playerFirstName}
                    </td>
                    <td>{r.playerBirthdate}</td>
                    <td>{r.externalId ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card adm-stack no-print" aria-labelledby="exp-pack">
        <h2 id="exp-pack" style={{ margin: 0 }}>
          Question pack for the SportsEngine registration form
        </h2>
        <p className="muted adm-small" style={{ margin: 0 }}>
          The structured questions to add in SportsEngine&apos;s Registration Builder, with types, options per division and seat limits. Copy
          and paste it, or hand it to whoever edits the form.
        </p>
        <label htmlFor="pack" className="adm-sr">
          Question pack text
        </label>
        <textarea id="pack" readOnly value={pack} rows={14} style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }} />
        <div className="adm-row">
          <button
            type="button"
            className="button small"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(pack);
              } catch {
                const el = document.getElementById('pack') as HTMLTextAreaElement | null;
                el?.select();
                document.execCommand('copy');
              }
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            Copy question pack
          </button>
          <button type="button" className="adm-btn" onClick={() => downloadText(`${slug}-question-pack.txt`, pack, 'text/plain;charset=utf-8')}>
            Download
          </button>
          {copied && (
            <span role="status" className="adm-small">
              Copied.
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
