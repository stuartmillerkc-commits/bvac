'use client';

import Link from 'next/link';
import { formatDate } from '@bvac/core';
import { useSeason } from '@/lib/season-store';

export default function Home() {
  const { data, index, results } = useSeason();
  const s = data.season;
  return (
    <>
      <section className="home-hero">
        <h1>Teams that fit every family&apos;s week</h1>
        <p className="muted" style={{ maxWidth: 720 }}>
          Coaches pick practice nights first. Families see real team options, with practice and game times, before they register in
          SportsEngine. As registrations come in, teams build themselves using BVAC&apos;s rules for siblings, friends, seniority and
          team size, and admins and coaches review before anything is final.
        </p>
        <p style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', margin: 0 }}>
          <Link className="button" href="/tour/">
            Take the 10-minute tour
          </Link>
          <Link className="button secondary" href="/finder/">
            Browse teams as a family
          </Link>
        </p>
      </section>

      <section className="grid" style={{ marginBottom: 32 }}>
        <RoleCard href="/finder/" title="Families" body="Browse team options by night and see which still have room." />
        <RoleCard href="/register/" title="SportsEngine form (mock)" body="The structured questions BVAC could add to its existing form." />
        <RoleCard href="/coach/" title="Coaches" body="Claim a practice slot, watch the roster form, approve or swap." />
        <RoleCard href="/admin/" title="Admins" body="Team board, rounds, flags, comparisons and SportsEngine exports." />
      </section>

      <section className="card">
        <h2>{s.name}</h2>
        <p className="muted">
          Early registration {formatDate(s.windows.early.start)} – {formatDate(s.windows.early.end)} · Round 1 {formatDate(s.round1Publish)} ·
          Regular registration {formatDate(s.windows.regular.start)} – {formatDate(s.windows.regular.end)} · Rosters final{' '}
          {formatDate(s.rostersFinal)}
        </p>
        <div className="table-wrap" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th>Division</th>
                <th>Grades</th>
                <th>Registered</th>
                <th>Teams</th>
                <th>Placed</th>
                <th>Waitlist</th>
                <th>1st choice</th>
              </tr>
            </thead>
            <tbody>
              {data.divisions.map((d) => {
                const r = results[d.id];
                return (
                  <tr key={d.id}>
                    <td>{d.name}</td>
                    <td>{d.label}</td>
                    <td>{index.registrationsByDivision.get(d.id)?.length ?? 0}</td>
                    <td>{index.teamsByDivision.get(d.id)?.length ?? 0}</td>
                    <td>{r?.stats.placed ?? '—'}</td>
                    <td>{r?.stats.waitlisted ? <span className="badge warning">{r.stats.waitlisted}</span> : 0}</td>
                    <td>{r ? `${Math.round(r.stats.firstChoiceRate * 100)}%` : '—'}</td>
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

function RoleCard({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href} className="card role-card" style={{ textDecoration: 'none', color: 'inherit' }}>
      <h3>{title}</h3>
      <p className="muted" style={{ margin: 0 }}>
        {body}
      </p>
    </Link>
  );
}
