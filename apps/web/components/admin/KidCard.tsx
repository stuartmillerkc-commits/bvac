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
            <span className="badge warning">Not ranked</span>
          ))}
        {sen.seasons > 0 ? (
          <span className="badge" title={`${sen.seasons} earlier BVAC season${sen.seasons === 1 ? '' : 's'}`}>
            {sen.seasons} season{sen.seasons === 1 ? '' : 's'}
          </span>
        ) : (
          <span className="badge">New</span>
        )}
        {sen.seasonsWithCoach > 0 && (
          <span className="badge good" title={sen.returningWithCoach ? 'Played for this coach last season' : 'Played for this coach before'}>
            With coach ×{sen.seasonsWithCoach}
          </span>
        )}
        {reg.window !== 'early' && <span className="badge">{reg.window === 'late' ? 'Late' : 'Regular'}</span>}
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
        <summary>Why here</summary>
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
          Sibling {mark(req.sibling)}
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
          Coach {mark(req.coach)}
        </span>
      )}
      {req.unmatched > 0 && (
        <span className="badge warning" title="A requested name did not match a registered kid">
          {req.unmatched} unmatched
        </span>
      )}
    </div>
  );
}
