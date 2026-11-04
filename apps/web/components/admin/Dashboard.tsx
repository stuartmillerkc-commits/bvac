'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Flag, FlagSeverity } from '@bvac/core';
import { useSeason } from '@/lib/season-store';
import { AdminHeader } from './AdminNav';
import { AsOfControl } from './AsOfControl';
import { DemandGrid } from './DemandGrid';
import { ReplayFeed } from './ReplayFeed';
import { activeTeams, placementMap, registrationsAsOf, roundStatus, SEVERITY_LABEL, sortedDivisions, type RoundStatus } from './model';

const MODEL_LABEL = {
  ranked: 'Ranked choice',
  fcfs: 'First come, first served',
  coachSelect: 'Coach selection',
  availabilityCluster: 'Availability clustering',
  hybrid: 'Hybrid',
} as const;

const SEVERITY_ORDER: FlagSeverity[] = ['critical', 'warning', 'info'];

export function Dashboard() {
  const { index, results, asOf, fixed, edits, resetDemo } = useSeason();
  const divisions = sortedDivisions(index);
  const openNotes = edits.coachNotes.filter((n) => n.status === 'open');

  return (
    <div className="adm-stack">
      <AdminHeader title="Season dashboard">
        <ResetButton onReset={resetDemo} />
      </AdminHeader>
      <AsOfControl />
      <ReplayFeed />

      <section className="card adm-stack" aria-labelledby="divisions-title">
        <h2 id="divisions-title" style={{ margin: 0 }}>
          Divisions
        </h2>
        <div className="table-wrap">
          <table className="adm-cards-table">
            <thead>
              <tr>
                <th scope="col">Division</th>
                <th scope="col">Registered (early / regular / late)</th>
                <th scope="col">Teams vs needed</th>
                <th scope="col">Placed</th>
                <th scope="col">Waitlist</th>
                <th scope="col">1st choice</th>
                <th scope="col">To check</th>
                <th scope="col">Next step</th>
              </tr>
            </thead>
            <tbody>
              {divisions.map((d) => {
                const regs = registrationsAsOf(index, d.id, asOf);
                const count = (w: string) => regs.filter((r) => r.window === w).length;
                const teams = activeTeams(index, d.id);
                const needed = Math.ceil(regs.length / d.settings.teamSize.preferred);
                const r = results[d.id];
                const rs = roundStatus(index, fixed, d.id, edits.publishSnapshots[d.id]);
                const flags = r?.flags ?? [];
                return (
                  <tr key={d.id}>
                    <th scope="row">
                      <Link href={`/admin/board/?d=${d.code}`} title={`Open the ${d.name} team board`}>
                        {d.name}
                      </Link>
                      <div className="muted adm-small" style={{ fontWeight: 400 }}>
                        {d.label} · {MODEL_LABEL[d.settings.model]}
                      </div>
                    </th>
                    <td data-label="Registered (early / regular / late)">
                      <span>
                        <b>{regs.length}</b> <span className="muted">({count('early')} / {count('regular')} / {count('late')})</span>
                      </span>
                    </td>
                    <td data-label="Teams vs needed">
                      <div>
                        <span className={`badge ${teams.length < needed ? 'warning' : 'good'}`}>
                          {teams.length} of {needed}
                        </span>
                        {teams.length < needed && (
                          <div className="muted adm-small">
                            needs {needed - teams.length} more coach{needed - teams.length === 1 ? '' : 'es'}
                          </div>
                        )}
                      </div>
                    </td>
                    <td data-label="Placed">{r?.stats.placed ?? '—'}</td>
                    <td data-label="Waitlist">{r?.stats.waitlisted ? <span className="badge warning">{r.stats.waitlisted}</span> : 0}</td>
                    <td data-label="1st choice">{r && r.stats.placed ? `${Math.round(r.stats.firstChoiceRate * 100)}%` : '—'}</td>
                    <td data-label="To check">
                      <Link href={`/admin/board/?d=${d.code}#flags`} className="adm-plain-link" aria-label={`Things to check in ${d.name}`}>
                        <FlagCounts flags={flags} />
                      </Link>
                    </td>
                    <td data-label="Next step" className="adm-small">
                      <div>
                        <NextStep code={d.code} rs={rs} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted adm-small" style={{ margin: 0 }}>
          Teams needed = registrations ÷ ideal team size, rounded up; each extra team needs a coach and a practice slot. &quot;1st choice&quot; is the
          share of placed kids on their family&apos;s 1st choice team. Counts follow the &quot;As of&quot; date above.
        </p>
      </section>

      {openNotes.length > 0 && (
        <div className="adm-notice">
          {openNotes.length} open coach note{openNotes.length === 1 ? '' : 's'} (flagged kids or swap requests). See them on the team board for that division.
        </div>
      )}

      <section className="card adm-stack" aria-labelledby="seats-title">
        <h2 id="seats-title" style={{ margin: 0 }}>
          Seats and flags by division
        </h2>
        {divisions.map((d) => (
          <DivisionDetail key={d.id} divisionId={d.id} />
        ))}
      </section>

      <DemandGrid />
    </div>
  );
}

/** What the admin should do next in a division's rounds, linked to its board. */
function NextStep({ code, rs }: { code: string; rs: RoundStatus }) {
  const board = `/admin/board/?d=${code}`;
  if (rs.current === 'done')
    return (
      <>
        Both rounds published. <Link href="/admin/exports/">Export for SportsEngine</Link>
      </>
    );
  const round = rs.current;
  const [status, action] =
    rs.sent === 0
      ? [round === 2 ? 'Round 1 published.' : '', `Review and send round ${round}`]
      : rs.proposed > 0
        ? [`Round ${round}: ${rs.approved} of ${rs.sent} approved by coaches.`, 'Check on coaches']
        : [`Round ${round} approved.`, `Publish round ${round}`];
  return (
    <>
      {status && <div className="muted">{status}</div>}
      <Link href={board}>{action} →</Link>
    </>
  );
}

function FlagCounts({ flags }: { flags: Flag[] }) {
  const counts = SEVERITY_ORDER.map((s) => [s, flags.filter((f) => f.severity === s).length] as const).filter(([, n]) => n > 0);
  if (!counts.length) return <span className="badge good">None</span>;
  return (
    <span className="adm-chips">
      {counts.map(([s, n]) => (
        <span
          key={s}
          className={`badge ${s}`}
          title={s === 'critical' ? 'Needs action, e.g. not enough seats' : s === 'warning' ? 'Worth a look, e.g. a small team' : 'Friend or coach requests the engine could not meet'}
        >
          {s === 'info' ? `${n} unmet request${n === 1 ? '' : 's'}` : s === 'critical' ? `${n} urgent` : `${n} to check`}
        </span>
      ))}
    </span>
  );
}

function DivisionDetail({ divisionId }: { divisionId: string }) {
  const { index, results } = useSeason();
  const d = index.division.get(divisionId)!;
  const r = results[divisionId];
  const map = placementMap(r);
  const teams = activeTeams(index, divisionId);
  const size = (teamId: string) => [...map.values()].filter((p) => p.teamId === teamId).length;
  const flags = [...(r?.flags ?? [])].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
  const important = flags.filter((f) => f.severity !== 'info');
  const notes = flags.filter((f) => f.severity === 'info');
  const max = d.settings.teamSize.max;
  return (
    <details>
      <summary>
        <b>{d.name}</b>{' '}
        <span className="muted adm-small">
          {teams.reduce((sum, t) => sum + Math.max(0, max - size(t.id)), 0)} seats left · {important.length} thing
          {important.length === 1 ? '' : 's'} to check
        </span>
      </summary>
      <div className="adm-stack" style={{ padding: '8px 0 12px' }}>
        <div className="adm-chips">
          {teams.map((t) => {
            const n = size(t.id);
            const left = max - n;
            return (
              <span key={t.id} className={`badge ${left <= 0 ? 'critical' : n >= d.settings.teamSize.preferred ? 'warning' : 'good'}`}>
                {t.label}: {n}/{max}, {left > 0 ? `${left} left` : 'full'}
              </span>
            );
          })}
        </div>
        {important.length > 0 && (
          <ul className="adm-small" style={{ margin: 0, paddingLeft: 18 }}>
            {important.map((f, i) => (
              <li key={i}>
                <span className={`badge ${f.severity}`}>{SEVERITY_LABEL[f.severity]}</span> {f.message}
              </li>
            ))}
          </ul>
        )}
        {notes.length > 0 && (
          <details>
            <summary className="adm-small">{notes.length} unmet friend or coach requests</summary>
            <ul className="adm-small muted" style={{ margin: 0, paddingLeft: 18 }}>
              {notes.map((f, i) => (
                <li key={i}>{f.message}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </details>
  );
}

function ResetButton({ onReset }: { onReset: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <div className="adm-row">
      {armed && <span className="adm-small muted">Clears every change made in this browser.</span>}
      <button
        type="button"
        className={`button small${armed ? ' danger' : ' secondary'}`}
        onClick={() => {
          if (armed) {
            onReset();
            setArmed(false);
          } else setArmed(true);
        }}
        onBlur={() => setArmed(false)}
      >
        {armed ? 'Yes, reset demo' : 'Reset demo'}
      </button>
    </div>
  );
}
