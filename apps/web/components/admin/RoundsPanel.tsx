'use client';

import Link from 'next/link';
import { compareStrings, formatDate, type Division, type ID, type PlacementRunResult, type Team } from '@bvac/core';
import { placeDivision } from '@bvac/engine';
import { useSeason } from '@/lib/season-store';
import { approve, inDivision, publishRound, roundStatus, sendRound } from './model';

/**
 * Rounds for one division: send the round's projected rosters to coaches,
 * approve, publish (fixes them), and undo the last publish from its snapshot.
 */
export function RoundsPanel({ division }: { division: Division }) {
  const { data, index, results, fixed, edits, updateEdits, asOf } = useSeason();
  const snapshots = edits.publishSnapshots[division.id] ?? [];
  const status = roundStatus(index, fixed, division.id, snapshots);
  const round = status.current === 'done' ? 2 : status.current;
  const own = inDivision(index, division.id);

  /** The engine run that defines this round's rosters. */
  const runFor = (r: 1 | 2): PlacementRunResult =>
    r === 2
      ? results[division.id]!
      : placeDivision({ data, divisionId: division.id, round: 1, fixed: fixed.filter(own), ...(asOf ? { asOf } : {}) });

  const send = () => updateEdits((e) => ({ ...e, fixed: sendRound(index, e.fixed, division.id, round, runFor(round)) }));
  const approveAll = () => updateEdits((e) => ({ ...e, fixed: approve(index, e.fixed, { divisionId: division.id }) }));
  const publish = () =>
    updateEdits((e) => ({
      ...e,
      fixed: publishRound(index, e.fixed, division.id, round, runFor(round)),
      publishSnapshots: { ...e.publishSnapshots, [division.id]: [...(e.publishSnapshots[division.id] ?? []), e.fixed.filter(own)] },
    }));
  const undo = () =>
    updateEdits((e) => {
      const list = e.publishSnapshots[division.id] ?? [];
      const last = list[list.length - 1];
      if (!last) return e;
      return {
        ...e,
        fixed: [...e.fixed.filter((p) => !own(p)), ...last],
        publishSnapshots: { ...e.publishSnapshots, [division.id]: list.slice(0, -1) },
      };
    });

  const date = round === 1 ? data.season.round1Publish : data.season.round2Publish;
  const waiting = status.proposed;
  const done = status.current === 'done';
  /** Where this round is: 0 send, 1 coaches approve, 2 publish, 3 all published. */
  const stage = done ? 3 : status.sent === 0 ? 0 : waiting > 0 ? 1 : 2;
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

  // Teams with kids waiting for their coach, linked to that coach's view.
  const waitingTeams = [
    ...new Set(fixed.filter((p) => own(p) && p.state === 'proposed' && p.teamId).map((p) => p.teamId!)),
  ]
    .map((id) => index.team.get(id))
    .filter((t): t is Team => !!t)
    .sort((a, b) => compareStrings(a.label, b.label));
  const coachFor = (teamId: ID) => data.coachAssignments.find((c) => c.teamId === teamId && c.role === 'head');

  const STEPS = ['Send to coaches', 'Coaches approve', 'Publish to families'];
  return (
    <section className="card adm-stack" aria-labelledby="rounds-title">
      <div className="adm-spread">
        <h2 id="rounds-title" style={{ margin: 0, fontSize: 18 }}>
          {done ? 'Both rounds published' : `Round ${round}`}
          {!done && (
            <span className="muted adm-small" style={{ fontWeight: 400 }}>
              {' '}
              · {round === 1 ? 'early registrants, filling teams to preferred size' : 'everyone else, filling teams to max'} · families hear{' '}
              {formatDate(date)}
            </span>
          )}
        </h2>
        <div className="adm-chips">
          <span className="badge state-proposed">{status.proposed} waiting for coaches</span>
          <span className="badge state-approved">{status.approved} approved</span>
          <span className="badge state-published">{status.published} published</span>
          {status.pinned > 0 && <span className="badge">{status.pinned} pinned</span>}
        </div>
      </div>

      {!done && (
        <ol className="adm-steps" aria-label={`Round ${round} steps`}>
          {STEPS.map((label, i) => (
            <li key={label} data-state={i < stage ? 'done' : i === stage ? 'current' : 'todo'} aria-current={i === stage ? 'step' : undefined}>
              <span className="adm-step-num" aria-hidden="true">
                {i < stage ? '✓' : i + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>
      )}

      <div className="adm-next" role="status">
        {stage === 0 && (
          <>
            {round === 2 && status.lastPublished > 0 && (
              <p>
                <b>Round 1 is published:</b> {plural(status.lastPublished, 'kid is', 'kids are')} on final teams.
              </p>
            )}
            <p>
              <b>Next step:</b> send round {round} to coaches. This holds{' '}
              {round === 1 ? "the early registrants' projected teams" : 'everyone else’s projected teams'} in place, so new sign-ups can&apos;t
              bump them, and asks each coach to look over their roster.
            </p>
          </>
        )}
        {stage === 1 && (
          <p>
            <b>Sent.</b> {plural(waiting, 'kid')} on {plural(waitingTeams.length, 'team')} {waiting === 1 ? 'is' : 'are'} waiting for coaches.{' '}
            <b>Next step:</b> each coach approves in the Coach view
            {waitingTeams.length > 0 && (
              <>
                {' '}
                (
                {waitingTeams.slice(0, 3).map((t, i) => {
                  const ca = coachFor(t.id);
                  const person = ca ? index.person.get(ca.personId) : undefined;
                  return (
                    <span key={t.id}>
                      {i > 0 && ', '}
                      {person ? <Link href={`/coach/?as=${person.id}`}>{`Coach ${person.lastName} (${t.label})`}</Link> : t.label}
                    </span>
                  );
                })}
                {waitingTeams.length > 3 ? `, and ${waitingTeams.length - 3} more` : ''})
              </>
            )}
            , or you approve them all here.
          </p>
        )}
        {stage === 2 && (
          <p>
            <b>Coaches approved all {status.sent}.</b> <b>Next step:</b> publish round {round} to make these teams final. Families can then
            be told their team.
          </p>
        )}
        {stage === 3 && (
          <p>
            <b>Every team in this division is final.</b> Next step: <Link href="/admin/exports/">download the files for SportsEngine</Link>.
          </p>
        )}
      </div>

      <div className="adm-row">
        {stage === 0 && (
          <button type="button" className="button small" onClick={send}>
            Send round {round} to coaches
          </button>
        )}
        {!done && (
          <button type="button" className={`button small${stage === 1 ? '' : ' secondary'}`} onClick={approveAll} disabled={waiting === 0}>
            Approve all as admin{waiting ? ` (${waiting})` : ''}
          </button>
        )}
        {!done && (
          <button type="button" className={`button small${stage === 2 ? '' : ' secondary'}`} onClick={publish}>
            Publish round {round}
          </button>
        )}
        {status.canUndo && (
          <button type="button" className="adm-btn" onClick={undo}>
            Undo last publish
          </button>
        )}
      </div>
      {!done && (
        <p className="muted adm-small" style={{ margin: 0 }}>
          {stage < 2 && `Publishing now also publishes kids coaches haven't approved yet. `}
          Published kids never move when the engine re-runs; only an admin can move them. Undo puts back the rosters from just before the last
          publish.
        </p>
      )}
    </section>
  );
}
