'use client';

import Link from 'next/link';
import { useState } from 'react';
import { compareStrings } from '@bvac/core';
import { useSeason } from '@/lib/season-store';

interface Step {
  title: string;
  who: string;
  href: string;
  cta: string;
  doThis: string[];
  pointOut: string;
}

/**
 * The guided walk-through for showing BVAC the whole story, in the order the
 * season actually runs. docs/DEMO_SCRIPT.md is the matching talk track.
 */
export function Tour() {
  const { data, index, resetDemo } = useSeason();
  const [reset, setReset] = useState(false);
  const d3 = data.divisions.find((d) => d.code === 'D3') ?? data.divisions[0]!;
  const d3Coach = data.coachAssignments
    .filter((c) => c.role === 'head' && index.team.get(c.teamId)?.divisionId === d3.id)
    .sort((a, b) => compareStrings(index.team.get(a.teamId)!.label, index.team.get(b.teamId)!.label))[0];
  const coachName = d3Coach ? index.person.get(d3Coach.personId) : undefined;

  const steps: Step[] = [
    {
      title: 'Coaches claim practice slots',
      who: 'Coach · December',
      href: '/coach/?as=person_demo_coach_1',
      cta: 'Open the coach view as a new coach',
      doThis: ['Pick an open practice slot and a schedule position.', 'Claim it. The team option now exists, with its game times.'],
      pointOut: 'Coaches commit first, so families see real practice nights before they register. No more guessing.',
    },
    {
      title: 'Families browse the Team Finder',
      who: 'Family · before registering',
      href: '/finder/?division=D3',
      cta: 'Open the Team Finder',
      doThis: ['Tick the nights that work, e.g. Tuesday and Thursday.', 'Open "See every game" on a team.'],
      pointOut: 'Every option shows practice night, field, game pattern, coach and seats left. This is the page BVAC links from its soccer page.',
    },
    {
      title: 'Register in SportsEngine (mock)',
      who: 'Family · registration',
      href: '/register/?division=D3',
      cta: 'Open the mock SportsEngine form',
      doThis: ['Fill in a made-up child and pick 1st and 2nd choice teams.', 'Add a friend request; watch it match a registered kid.', 'Submit, then follow the "team preferences" link.'],
      pointOut: "These are BVAC's existing SportsEngine fields plus seven structured questions SportsEngine already supports. Payment stays in SportsEngine.",
    },
    {
      title: 'Watch registrations arrive',
      who: 'Admin · January–March',
      href: '/admin/',
      cta: 'Open the admin dashboard',
      doThis: ['Press "Play from Jan 4".', 'Read the "What changed" feed as kids register and teams fill.'],
      pointOut: 'Teams build themselves as sign-ups come in, with a reason for every placement and flags when a division needs another team.',
    },
    {
      title: 'Review the team board',
      who: 'Admin',
      href: `/admin/board/?d=${d3.code}`,
      cta: `Open the ${d3.name} board`,
      doThis: ['Expand a kid card to see why they are on that team.', 'Drag a kid (or use "Move to…") and read what the move breaks.'],
      pointOut: 'Admins have the last word. The engine proposes; any placement can be moved or pinned.',
    },
    {
      title: 'Send round 1 to coaches',
      who: 'Admin · after the early deadline',
      href: `/admin/board/?d=${d3.code}`,
      cta: 'Open the rounds panel',
      doThis: ['Click "Send round 1 to coaches".'],
      pointOut: 'Rosters are now held for coach review. New registrations can no longer bump these kids.',
    },
    {
      title: 'A coach approves the roster',
      who: 'Coach',
      href: d3Coach ? `/coach/?as=${d3Coach.personId}` : '/coach/',
      cta: coachName ? `Sign in as Coach ${coachName.lastName}` : 'Open the coach view',
      doThis: ['Look over the projected roster and each kid’s reasons.', 'Approve it, or flag a kid or propose a swap.'],
      pointOut: 'Coaches see their roster forming without seeing guardian contacts until publish.',
    },
    {
      title: 'Publish round 1',
      who: 'Admin',
      href: `/admin/board/?d=${d3.code}`,
      cta: 'Back to the board',
      doThis: ['Click "Publish round 1".', 'Optionally "Undo publish" to show it can be rolled back.'],
      pointOut: 'Published placements never move on re-runs. Early registrants get certainty in February, not March.',
    },
    {
      title: 'Hand it back to SportsEngine',
      who: 'Admin · rosters final',
      href: '/admin/exports/',
      cta: 'Open the exports',
      doThis: ['Download the teams and schedule CSVs.', 'Print the roster list for the SportsEngine rostering tool.', 'Copy the question pack.'],
      pointOut: 'SportsEngine stays the system families use. This tool makes the decisions and hands over the files.',
    },
    {
      title: 'Bring in real SportsEngine exports',
      who: 'Admin · any time',
      href: '/admin/import/',
      cta: 'Open the import',
      doThis: ['Click "Use the sample file".', 'Read the import report, then add the 8 new families.'],
      pointOut: 'Works with BVAC’s Saved Report export today. Re-imports never duplicate, and problems are listed by row.',
    },
  ];

  return (
    <div className="tour">
      <h1>Guided tour</h1>
      <p className="muted" style={{ maxWidth: 720 }}>
        Ten steps, about ten minutes, in the order a season runs. Each step opens the page it&apos;s about; come back here for the next one. The
        demo saves changes in this browser, so start fresh before showing it to someone.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            resetDemo();
            setReset(true);
          }}
        >
          Start fresh
        </button>
        {reset && (
          <span role="status" className="muted">
            Demo reset to the sample season.
          </span>
        )}
      </div>
      <ol className="tour-steps">
        {steps.map((s, i) => (
          <li key={i} className="card tour-step">
            <div className="tour-num" aria-hidden="true">
              {i + 1}
            </div>
            <div>
              <div className="muted tour-who">{s.who}</div>
              <h2>{s.title}</h2>
              <ul>
                {s.doThis.map((t, j) => (
                  <li key={j}>{t}</li>
                ))}
              </ul>
              <p className="tour-point">
                <b>Point out:</b> {s.pointOut}
              </p>
              <Link className="button small" href={s.href}>
                {s.cta}
              </Link>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
