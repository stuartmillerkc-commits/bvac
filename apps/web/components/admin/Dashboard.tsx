'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Flag, FlagSeverity } from '@bvac/core';
import { useSeason } from '@/lib/season-store';
import { AdminHeader } from './AdminNav';
import { AsOfControl } from './AsOfControl';
import { DemandGrid } from './DemandGrid';
import { ReplayFeed } from './ReplayFeed';
import { activeTeams, placementMap, registrationsAsOf, roundStatus, sortedDivisions } from './model';

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
          <table>
            <thead>
              <tr>
                <th scope="col">Division</th>
                <th scope="col">Registered (early / regular / late)</th>
                <th scope="col">Teams vs needed</th>
                <th scope="col">Placed</th>
                <th scope="col">Waitlist</th>
                <th scope="col">1st choice</th>
                <th scope="col">Rounds</th>
                <th scope="col">Flags</th>
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
                    <td>
                      <b>{regs.length}</b> <span className="muted">({count('early')} / {count('regular')} / {count('late')})</span>
                    </td>
                    <td>
                      <span className={`badge ${teams.length < needed ? 'warning' : 'good'}`}>
                        {teams.length} of {needed}
                      </span>
                    </td>
                    <td>{r?.stats.placed ?? '—'}</td>
                    <td>{r?.stats.waitlisted ? <span className="badge warning">{r.stats.waitlisted}</span> : 0}</td>
                    <td>{r && r.stats.placed ? `${Math.round(r.stats.firstChoiceRate * 100)}%` : '—'}</td>
                    <td className="adm-small">
                      {rs.current === 'done'
                        ? 'Round 2 published'
                        : rs.proposed + rs.approved > 0
                          ? `Round ${rs.current} sent to coaches`
                          : rs.current === 2
                            ? 'Round 1 published'
                            : 'Round 1 not sent'}
                      {(rs.proposed > 0 || rs.approved > 0) && (
                        <div className="muted">
                          {rs.proposed} with coaches · {rs.approved} approved
                        </div>
                      )}
                    </td>
                    <td>
                      <FlagCounts flags={flags} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted adm-small" style={{ margin: 0 }}>
          Teams needed = registrations ÷ preferred team size, rounded up. Counts follow the &quot;As of&quot; date above. Click a division to open
          its team board.
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

function FlagCounts({ flags }: { flags: Flag[] }) {
  const counts = SEVERITY_ORDER.map((s) => [s, flags.filter((f) => f.severity === s).length] as const).filter(([, n]) => n > 0);
  if (!counts.length) return <span className="badge good">None</span>;
  return (
    <span className="adm-chips">
      {counts.map(([s, n]) => (
        <span key={s} className={`badge ${s}`} title={`${n} ${s}`}>
          {n} {s === 'info' ? 'notes' : s}
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
          {teams.reduce((sum, t) => sum + Math.max(0, max - size(t.id)), 0)} seats left · {important.length} flag
          {important.length === 1 ? '' : 's'}
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
                <span className={`badge ${f.severity}`}>{f.severity}</span> {f.message}
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
