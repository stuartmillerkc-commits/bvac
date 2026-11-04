'use client';

import { formatDate, type Division, type PlacementRunResult } from '@bvac/core';
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
  return (
    <section className="card adm-stack" aria-labelledby="rounds-title">
      <div className="adm-spread">
        <h2 id="rounds-title" style={{ margin: 0, fontSize: 18 }}>
          {status.current === 'done' ? 'Both rounds published' : `Round ${round}`}
          <span className="muted adm-small" style={{ fontWeight: 400 }}>
            {' '}
            · {round === 1 ? 'early registrants, filling to preferred size' : 'everyone, filling to max'} · publishes {formatDate(date)}
          </span>
        </h2>
        <div className="adm-chips">
          <span className="badge state-proposed">{status.proposed} with coaches</span>
          <span className="badge state-approved">{status.approved} approved</span>
          <span className="badge state-published">{status.published} published</span>
          {status.pinned > 0 && <span className="badge">{status.pinned} pinned</span>}
        </div>
      </div>
      <div className="adm-row">
        <button type="button" className="button small secondary" onClick={send} disabled={status.current === 'done'}>
          Send round {round} to coaches
        </button>
        <button type="button" className="button small secondary" onClick={approveAll} disabled={waiting === 0}>
          Approve as admin{waiting ? ` (${waiting})` : ''}
        </button>
        <button type="button" className="button small" onClick={publish} disabled={status.current === 'done'}>
          Publish round {round}
        </button>
        <button type="button" className="adm-btn" onClick={undo} disabled={!status.canUndo}>
          Undo publish
        </button>
      </div>
      <p className="muted adm-small" style={{ margin: 0 }}>
        Sending holds the round&apos;s projected rosters in place and asks coaches to approve. Publishing makes them final for families; later
        re-runs never move published kids. Undo restores the rosters from just before the last publish.
        {waiting > 0 && status.current !== 'done' && ` ${waiting} placement${waiting === 1 ? ' is' : 's are'} still waiting for coach approval.`}
      </p>
    </section>
  );
}
