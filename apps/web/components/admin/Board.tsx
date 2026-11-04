'use client';

import { useSearchParams } from 'next/navigation';
import { useState, type DragEvent, type ReactNode } from 'react';
import { compareStrings, formatWindow, fullName, type ID, type Placement, type Registration, type Team } from '@bvac/core';
import { useSeason, type CoachNote } from '@/lib/season-store';
import { GameList } from '@/components/GameList';
import { AdminHeader, DivisionPills } from './AdminNav';
import { BadgeLegend, KidCard } from './KidCard';
import { RoundsPanel } from './RoundsPanel';
import {
  activeTeams,
  coachName,
  divisionByCode,
  generalPriority,
  manualPlacement,
  moveImpact,
  placementMap,
  playerOf,
  registrationsAsOf,
  SEVERITY_LABEL,
  shortName,
  sortedDivisions,
  teamOfFrom,
  teamPractice,
} from './model';

const WAITLIST = 'waitlist';

interface LastMove {
  divisionId: ID;
  registrationId: ID;
  name: string;
  to: string;
  breaks: string[];
  gains: string[];
  wasPublished: boolean;
  /** Team of every kid in the division just before the move. */
  before: Map<ID, ID | null>;
}

export function Board() {
  const params = useSearchParams();
  const { index, results, fixed, setFixed, asOf, edits, updateEdits } = useSeason();
  const divisions = sortedDivisions(index);
  const division = divisionByCode(index, params.get('d')) ?? divisions[0]!;
  const result = results[division.id];
  const map = placementMap(result);
  const teamOf = teamOfFrom(map);
  const teams = activeTeams(index, division.id);
  const regs = registrationsAsOf(index, division.id, asOf);
  const [moveState, setLastMove] = useState<LastMove | null>(null);
  const lastMove = moveState?.divisionId === division.id ? moveState : null;
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const settings = division.settings;
  const pinnedIds = new Set(fixed.filter((p) => p.locked).map((p) => p.registrationId));

  const byTeam = new Map<string, Registration[]>([[WAITLIST, []], ...teams.map((t) => [t.id, []] as [string, Registration[]])]);
  for (const r of regs) {
    const p = map.get(r.id);
    if (!p) continue;
    byTeam.get(p.teamId ?? WAITLIST)?.push(r);
  }
  const lastNameOrder = (a: Registration, b: Registration) => {
    const pa = index.player.get(a.playerId)!;
    const pb = index.player.get(b.playerId)!;
    return compareStrings(pa.lastName, pb.lastName) || compareStrings(pa.firstName, pb.firstName) || compareStrings(a.id, b.id);
  };
  for (const [key, list] of byTeam) {
    if (key === WAITLIST) {
      list.sort((a, b) => generalPriority(index, b) - generalPriority(index, a) || compareStrings(a.submittedAt, b.submittedAt) || compareStrings(a.id, b.id));
    } else list.sort(lastNameOrder);
  }

  const move = (registrationId: ID, toTeamId: ID | null) => {
    const reg = index.registration.get(registrationId);
    if (!reg) return;
    const prev = map.get(registrationId);
    const from = prev?.teamId ?? null;
    if (from === toTeamId) return;
    const sizeAfter = toTeamId ? (byTeam.get(toTeamId)?.length ?? 0) + 1 : 0;
    const impact = moveImpact(index, reg, from, toTeamId, teamOf, sizeAfter);
    const player = index.player.get(reg.playerId)!;
    setLastMove({
      divisionId: division.id,
      registrationId,
      name: fullName(player),
      to: toTeamId ? (index.team.get(toTeamId)?.label ?? 'team') : 'the waitlist',
      ...impact,
      wasPublished: prev?.state === 'published',
      before: new Map(regs.map((r) => [r.id, map.get(r.id)?.teamId ?? null])),
    });
    setFixed([...fixed.filter((p) => p.registrationId !== registrationId), manualPlacement(reg, prev, toTeamId)]);
  };

  const togglePin = (registrationId: ID) => {
    const current = fixed.find((p) => p.registrationId === registrationId);
    if (current) {
      // Unpin: an admin lock on a projected card goes away; a round placement just loses the pin.
      if (current.state === 'projected' || current.state === 'waitlisted') setFixed(fixed.filter((p) => p !== current));
      else setFixed(fixed.map((p) => (p === current ? { ...p, locked: false } : p)));
      return;
    }
    const p = map.get(registrationId);
    if (!p) return;
    const pinned: Placement = {
      ...p,
      locked: true,
      reasons: [...p.reasons.filter((r) => r.code !== 'adminLocked'), { code: 'adminLocked', text: 'Pinned by an admin' }],
    };
    setFixed([...fixed, pinned]);
  };

  // Kids the engine moved as a side effect of the last manual move.
  const shifted = lastMove
    ? regs.filter((r) => r.id !== lastMove.registrationId && lastMove.before.has(r.id) && lastMove.before.get(r.id) !== (map.get(r.id)?.teamId ?? null))
    : [];

  const onDrop = (target: string) => (e: DragEvent) => {
    e.preventDefault();
    setDropTarget(null);
    const id = e.dataTransfer.getData('text/plain');
    if (id) move(id, target === WAITLIST ? null : target);
  };
  const dropProps = (target: string) => ({
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dropTarget !== target) setDropTarget(target);
    },
    onDragLeave: () => setDropTarget((t) => (t === target ? null : t)),
    onDrop: onDrop(target),
  });

  const notes = edits.coachNotes.filter((n) => n.status === 'open' && index.team.get(n.teamId)?.divisionId === division.id);
  const flags = (result?.flags ?? []).filter((f) => f.severity !== 'info');
  const urgent = flags.filter((f) => f.severity === 'critical').length;

  return (
    <div className="adm-stack">
      <AdminHeader title="Team board">
        <DivisionPills divisions={divisions} current={division} hrefFor={(d) => `/admin/board/?d=${d.code}`} />
      </AdminHeader>
      <p className="muted" style={{ margin: 0 }}>
        {division.name} · {division.label} · {regs.length} registered · teams of {settings.teamSize.min} to {settings.teamSize.max} players,{' '}
        {settings.teamSize.preferred} ideal. The engine suggested these teams; open &quot;Why this team?&quot; on any kid to see the reasons. To
        change one, drag the card or use its &quot;Move to…&quot; menu. Moved kids are pinned, so the engine leaves them there.
      </p>

      <RoundsPanel division={division} />

      {lastMove && (
        <div className={`adm-notice${lastMove.breaks.length ? ' warning' : ''}`} role="status">
          <div className="adm-spread">
            <span>
              <b>
                Moved {lastMove.name} to {lastMove.to}.
              </b>{' '}
              {lastMove.breaks.length ? `Breaks: ${lastMove.breaks.join(' · ')}.` : 'Nothing broken.'}
              {lastMove.gains.length > 0 && ` Gains: ${lastMove.gains.join(' · ')}.`}
              {lastMove.wasPublished && ' This kid was published: tell the family.'}
              {shifted.length > 0 &&
                ` The engine re-ran and moved ${shifted.length} other kid${shifted.length === 1 ? '' : 's'}: ${shifted
                  .slice(0, 4)
                  .map((r) => {
                    const t = map.get(r.id)?.teamId;
                    return `${shortName(index.player.get(r.playerId)!)} → ${t ? index.team.get(t)?.label : 'waitlist'}`;
                  })
                  .join(', ')}${shifted.length > 4 ? '…' : ''}.`}
            </span>
            <button type="button" className="adm-btn" onClick={() => setLastMove(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {notes.length > 0 && <CoachNotes notes={notes} map={map} onUpdate={updateEdits} />}

      {flags.length > 0 ? (
        <details className="card" id="flags" open={urgent > 0 || undefined}>
          <summary>
            <b>
              {flags.length} thing{flags.length === 1 ? '' : 's'} to check
            </b>{' '}
            <span className="muted adm-small">
              {urgent > 0 ? `${urgent} urgent · ` : ''}teams too small, not enough seats, families with no team on their days
            </span>
          </summary>
          <ul className="adm-small" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {flags.map((f, i) => (
              <li key={i}>
                <span className={`badge ${f.severity}`}>{SEVERITY_LABEL[f.severity]}</span> {f.message}
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <p className="adm-notice" id="flags" style={{ margin: 0 }}>
          Nothing to check in {division.name}: every team is within size and every family has a team that fits their days.
        </p>
      )}

      <BadgeLegend />

      <nav className="adm-jump" aria-label="Jump to a team">
        <span className="muted">Jump to:</span>
        {teams.map((t) => (
          <a key={t.id} href={`#col-${t.id}`}>
            {t.label} ({(byTeam.get(t.id) ?? []).length})
          </a>
        ))}
        <a href="#col-waitlist">Waitlist ({byTeam.get(WAITLIST)!.length})</a>
      </nav>

      <div className="adm-board">
        {teams.map((t) => (
          <TeamColumn key={t.id} team={t} kids={byTeam.get(t.id) ?? []} drop={dropTarget === t.id} dropProps={dropProps(t.id)}>
            {(byTeam.get(t.id) ?? []).map((r) => (
              <KidCard
                key={r.id}
                reg={r}
                placement={map.get(r.id)}
                teamOf={teamOf}
                teams={teams}
                onMove={move}
                onTogglePin={togglePin}
                pinned={pinnedIds.has(r.id)}
                flash={lastMove?.registrationId === r.id}
              />
            ))}
          </TeamColumn>
        ))}
        <section id="col-waitlist" className={`adm-col${dropTarget === WAITLIST ? ' drop' : ''}`} aria-label="Waitlist" {...dropProps(WAITLIST)}>
          <h3>Waitlist</h3>
          <p className="muted adm-small" style={{ margin: 0 }}>
            {byTeam.get(WAITLIST)!.length === 0
              ? 'Nobody is waiting. Drag a kid here to take them off a team.'
              : `${byTeam.get(WAITLIST)!.length} kid${byTeam.get(WAITLIST)!.length === 1 ? '' : 's'} with no seat yet, first in line at the top (early sign-up and seasons played count most). Open "Why waitlisted?" for each family's reason.`}
          </p>
          {byTeam.get(WAITLIST)!.map((r) => (
            <KidCard
              key={r.id}
              reg={r}
              placement={map.get(r.id)}
              teamOf={teamOf}
              teams={teams}
              onMove={move}
              onTogglePin={togglePin}
              pinned={pinnedIds.has(r.id)}
              flash={lastMove?.registrationId === r.id}
            />
          ))}
        </section>
      </div>
    </div>
  );
}

function TeamColumn({
  team,
  kids,
  drop,
  dropProps,
  children,
}: {
  team: Team;
  kids: Registration[];
  drop: boolean;
  dropProps: Record<string, unknown>;
  children: ReactNode;
}) {
  const { index, trackDescriptions } = useSeason();
  const { slot, field } = teamPractice(index, team);
  const track = team.gameTrackId ? index.gameTrack.get(team.gameTrackId) : undefined;
  const pattern = team.gameTrackId ? trackDescriptions.get(team.gameTrackId) : undefined;
  const size = index.division.get(team.divisionId)!.settings.teamSize;
  return (
    <section id={`col-${team.id}`} className={`adm-col${drop ? ' drop' : ''}`} aria-label={team.label} {...dropProps}>
      <div>
        <h3>
          {team.label}
          {team.name ? <span className="muted"> · {team.name}</span> : null}
        </h3>
        <div className="adm-small muted">
          {slot ? formatWindow(slot.window) : 'No practice slot'}
          {field ? ` · ${field.name}` : ''}
        </div>
        <div className="adm-small">Coach {coachName(index, team.id)}</div>
        <div className="adm-small muted">
          {track ? `Games: ${pattern || `schedule position ${track.position}`}` : 'No game track yet'}
        </div>
        <GameList gameTrackId={team.gameTrackId} summary="Games" />
      </div>
      <SizeBar n={kids.length} {...size} />
      {children}
      {kids.length === 0 && <p className="muted adm-small">No players yet. Drag a kid here, or use a kid&apos;s &quot;Move to…&quot; menu.</p>}
    </section>
  );
}

export function SizeBar({ n, min, preferred, max }: { n: number; min: number; preferred: number; max: number }) {
  const scale = Math.max(max, n) || 1;
  const pct = (x: number) => `${Math.min(100, (x / scale) * 100)}%`;
  const cls = n > max ? 'over' : n < min ? 'under' : '';
  return (
    <div>
      <div className="adm-spread adm-small">
        <b>
          {n} player{n === 1 ? '' : 's'}
        </b>
        <span className="muted">
          min {min} · pref {preferred} · max {max}
        </span>
      </div>
      <div
        className={`adm-sizebar ${cls}`}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={n}
        aria-label={`Team size ${n} of max ${max}`}
      >
        <span style={{ width: pct(n) }} />
        <i style={{ left: pct(min) }} />
        <i style={{ left: pct(preferred) }} />
      </div>
    </div>
  );
}

function CoachNotes({
  notes,
  map,
  onUpdate,
}: {
  notes: CoachNote[];
  map: Map<ID, Placement>;
  onUpdate: ReturnType<typeof useSeason>['updateEdits'];
}) {
  const { index } = useSeason();
  const setStatus = (id: ID, status: CoachNote['status']) =>
    onUpdate((e) => ({ ...e, coachNotes: e.coachNotes.map((n) => (n.id === id ? { ...n, status } : n)) }));
  const applySwap = (n: CoachNote) =>
    onUpdate((e) => {
      const a = index.registration.get(n.registrationId);
      const b = n.otherRegistrationId ? index.registration.get(n.otherRegistrationId) : undefined;
      const ta = map.get(n.registrationId)?.teamId ?? null;
      const tb = n.otherRegistrationId ? (map.get(n.otherRegistrationId)?.teamId ?? null) : null;
      if (!a || !b || !ta || !tb) return e;
      const ids = new Set([a.id, b.id]);
      return {
        ...e,
        fixed: [
          ...e.fixed.filter((p) => !ids.has(p.registrationId)),
          manualPlacement(a, map.get(a.id), tb),
          manualPlacement(b, map.get(b.id), ta),
        ],
        coachNotes: e.coachNotes.map((x) => (x.id === n.id ? { ...x, status: 'done' } : x)),
      };
    });
  const name = (id: ID | undefined) => {
    const p = id ? playerOf(index, id) : undefined;
    return p ? fullName(p) : 'a player';
  };
  const teamLabel = (regId: ID | undefined) => {
    const t = regId ? map.get(regId)?.teamId : null;
    return t ? (index.team.get(t)?.label ?? '') : 'waitlist';
  };
  return (
    <section className="card adm-stack" aria-labelledby="notes-title">
      <h2 id="notes-title" style={{ margin: 0, fontSize: 18 }}>
        Coach notes
      </h2>
      <ul className="adm-roster">
        {notes.map((n) => {
          const author = index.person.get(n.authorPersonId);
          return (
            <li key={n.id}>
              <div>
                <b>{author ? `Coach ${author.lastName}` : 'A coach'}</b> ({index.team.get(n.teamId)?.label}){' '}
                {n.kind === 'flag'
                  ? `flagged ${name(n.registrationId)} for review`
                  : `proposes swapping ${name(n.registrationId)} (${teamLabel(n.registrationId)}) with ${name(n.otherRegistrationId)} (${teamLabel(n.otherRegistrationId)})`}
                {n.text ? `: “${n.text}”` : ''}
              </div>
              <div className="adm-row">
                {n.kind === 'swap' && (
                  <button type="button" className="button small" onClick={() => applySwap(n)}>
                    Apply swap
                  </button>
                )}
                <button type="button" className="adm-btn" onClick={() => setStatus(n.id, 'done')}>
                  {n.kind === 'swap' ? 'Mark handled' : 'Reviewed'}
                </button>
                {n.kind === 'swap' && (
                  <button type="button" className="adm-btn" onClick={() => setStatus(n.id, 'dismissed')}>
                    Decline
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="muted adm-small" style={{ margin: 0 }}>
        In the full tool the other coach approves a swap too. Applying it pins both kids on their new teams.
      </p>
    </section>
  );
}
