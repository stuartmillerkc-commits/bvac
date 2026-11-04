'use client';

import { formatWindow, fullName, type ID, type Placement, type Registration, type Team } from '@bvac/core';
import { useSeason } from '@/lib/season-store';
import { STATE_LABEL, gradeText, ordinal, requestStatus, seniority, type TeamOf } from './model';

export interface KidCardProps {
  reg: Registration;
  placement: Placement | undefined;
  teamOf: TeamOf;
  /** Teams this kid can be moved to (same division). */
  teams: Team[];
  onMove?: (registrationId: ID, teamId: ID | null) => void;
  onTogglePin?: (registrationId: ID) => void;
  flash?: boolean;
  /** An admin pin (the placement is in the store's fixed list and locked). */
  pinned?: boolean;
  /** Coach view: hide admin controls. */
  readOnly?: boolean;
}

export function KidCard({ reg, placement, teamOf, teams, onMove, onTogglePin, flash, pinned = false, readOnly }: KidCardProps) {
  const { index } = useSeason();
  const player = index.player.get(reg.playerId);
  if (!player) return null;
  const teamId = placement?.teamId ?? null;
  const sen = seniority(index, reg.playerId, teamId);
  const req = requestStatus(index, reg, teamId, teamOf);
  const state = placement?.state ?? 'projected';
  const locked = !!placement?.locked;
  // Locked by the engine but not pinned: a coach's child or protected pick.
  const coachPick = locked && !pinned ? placement?.reasons.find((r) => r.code === 'coachChild' || r.code === 'protectedPick') : undefined;
  const name = fullName(player);
  const canDrag = !readOnly && !!onMove;

  return (
    <article
      className={`adm-card${pinned || coachPick ? ' locked' : ''}${flash ? ' flash' : ''}`}
      draggable={canDrag}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', reg.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      aria-label={`${name}, ${gradeText(player.grade)}`}
      data-registration={reg.id}
    >
      <div className="adm-spread" style={{ gap: 4 }}>
        <span className="name">{name}</span>
        <span className="muted adm-small">{gradeText(player.grade)}</span>
      </div>
      <div className="adm-chips">
        {placement?.teamId &&
          (placement.choiceRankMet ? (
            <span className={`badge ${placement.choiceRankMet === 1 ? 'good' : ''}`}>{ordinal(placement.choiceRankMet)} choice</span>
          ) : (
            <span className="badge warning" title="The family didn't rank this team; it fits their days and they said any team is OK">
              Didn&apos;t rank this team
            </span>
          ))}
        {sen.seasons > 0 ? (
          <span className="badge" title={`${sen.seasons} earlier BVAC season${sen.seasons === 1 ? '' : 's'}`}>
            {sen.seasons} BVAC season{sen.seasons === 1 ? '' : 's'}
          </span>
        ) : (
          <span className="badge">New to BVAC</span>
        )}
        {sen.seasonsWithCoach > 0 && (
          <span className="badge good" title={sen.returningWithCoach ? 'Played for this coach last season' : 'Played for this coach before'}>
            With coach ×{sen.seasonsWithCoach}
          </span>
        )}
        {reg.window !== 'early' && <span className="badge">{reg.window === 'late' ? 'Late sign-up' : 'Regular sign-up'}</span>}
        {state !== 'projected' && state !== 'waitlisted' && <span className={`badge state-${state}`}>{STATE_LABEL[state]}</span>}
        {pinned && state !== 'published' && <span className="badge solid">Pinned</span>}
        {coachPick && (
          <span className="badge good" title={coachPick.text}>
            {coachPick.code === 'coachChild' ? "Coach's child" : 'Coach pick'}
          </span>
        )}
      </div>
      <RequestChips req={req} />
      <details>
        <summary>{teamId ? 'Why this team?' : 'Why waitlisted?'}</summary>
        <ul className="adm-reasons">
          {(placement?.reasons ?? []).map((r, i) => (
            <li key={i}>{r.text}</li>
          ))}
          <li>
            Days: {reg.availability.length ? reg.availability.map(formatWindow).join(', ') : 'none given'}
            {reg.availabilityRequired ? ' (required)' : ' (preferred)'}
          </li>
          {reg.choices.length > 0 && (
            <li>
              Ranked:{' '}
              {[...reg.choices]
                .sort((a, b) => a.rank - b.rank)
                .map((c) => index.team.get(c.teamId)?.label ?? '?')
                .join(', ')}
              {reg.acceptAnyFittingTeam ? ' · any fitting team OK' : ''}
            </li>
          )}
          {reg.requests.map((q) => (
            <li key={q.id}>
              {q.type === 'sibling' ? 'Sibling' : 'Friend'} request: {q.targetName}
              {q.matchStatus === 'unmatched' ? ' (no match found)' : q.matchStatus === 'ambiguous' ? ' (needs confirming)' : ''}
            </li>
          ))}
        </ul>
      </details>
      {!readOnly && (onMove || onTogglePin) && (
        <div className="adm-card-actions">
          {onTogglePin && !coachPick && (
            <button type="button" className="adm-btn" onClick={() => onTogglePin(reg.id)} aria-pressed={pinned} disabled={state === 'published'}>
              {pinned ? 'Unpin' : 'Pin'}
            </button>
          )}
          {onMove && (
            <select
              className="adm-select"
              aria-label={`Move ${name} to`}
              value=""
              onChange={(e) => {
                const v = e.target.value;
                if (v) onMove(reg.id, v === 'waitlist' ? null : v);
              }}
            >
              <option value="">Move to…</option>
              {teams
                .filter((t) => t.id !== teamId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              {teamId && <option value="waitlist">Waitlist</option>}
            </select>
          )}
        </div>
      )}
    </article>
  );
}

export function RequestChips({ req }: { req: ReturnType<typeof requestStatus> }) {
  const mark = (ok: boolean) => (ok ? '✓' : '✗');
  if (req.sibling === null && !req.friend && req.coach === null && !req.unmatched) return null;
  return (
    <div className="adm-chips" aria-label="Requests">
      {req.sibling !== null && (
        <span className={`badge ${req.sibling ? 'good' : 'warning'}`} title={req.sibling ? 'Sibling together' : 'Sibling on another team'}>
          {req.sibling ? 'Sibling together' : 'Sibling apart'}
        </span>
      )}
      {req.friend && (
        <span
          className={`badge ${req.friend.met === req.friend.total ? 'good' : req.friend.met ? '' : 'warning'}`}
          title={`${req.friend.met} of ${req.friend.total} friend requests met`}
        >
          Friend {req.friend.met}/{req.friend.total}
        </span>
      )}
      {req.coach !== null && (
        <span className={`badge ${req.coach ? 'good' : 'warning'}`} title={req.coach ? 'Coach request met' : 'Coach request not met'}>
          Coach request {mark(req.coach)}
        </span>
      )}
      {req.unmatched > 0 && (
        <span className="badge warning" title="A requested name did not match a registered kid">
          {req.unmatched} name{req.unmatched === 1 ? '' : 's'} not found
        </span>
      )}
    </div>
  );
}

/** Plain-language key for the labels on kid cards (board and coach view). */
export function BadgeLegend({ coach = false }: { coach?: boolean }) {
  const rows: [string, string, string][] = [
    ['good', '1st choice', "The family's 1st choice team (2nd, 3rd… likewise)."],
    ['warning', "Didn't rank this team", 'Not one of their picks, but it fits their days and they said any team is OK.'],
    ['', '2 BVAC seasons', 'Seasons played at BVAC before. "New to BVAC" means first season.'],
    ['good', 'With coach ×2', 'Seasons played for this coach. Counts toward priority on this team only.'],
    ['', 'Regular sign-up', 'Registered after the early deadline (late sign-ups go to the waitlist). Early sign-ups have no label.'],
    ['good', 'Friend 1/2', 'Friend requests met: 1 of the 2 requested friends is on this team.'],
    ['good', 'Sibling together', 'A requested sibling is on the same team ("apart" if not).'],
    ['warning', 'Coach request ✗', 'The family asked for a coach and did not get them (✓ if they did).'],
    ['warning', '1 name not found', "A requested friend's name didn't match any registered kid yet."],
  ];
  if (!coach) {
    rows.push(['', 'Pinned', 'Moved or pinned by an admin. The engine will not move this kid.']);
    rows.push(['', "Coach's child / Coach pick", "Locked to this team before placement runs (the coach's own kid or protected pick)."]);
  }
  rows.push(['', coach ? 'Needs your approval' : 'Waiting for coach', 'Sent to the coach in this round and not approved yet.']);
  return (
    <details className="card adm-legend">
      <summary>
        <b>What the labels mean</b>
      </summary>
      <dl>
        {rows.map(([cls, label, text]) => (
          <div key={label} style={{ display: 'contents' }}>
            <dt>
              <span className={`badge ${cls}`}>{label}</span>
            </dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
