'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  compareStrings,
  compareWindows,
  formatDate,
  formatTime,
  formatWindow,
  fullName,
  type CoachAssignment,
  type GameTrack,
  type ID,
  type Person,
  type Team,
} from '@bvac/core';
import { useSeason, type CoachNote } from '@/lib/season-store';
import { BadgeLegend, RequestChips } from './KidCard';
import { SizeBar } from './Board';
import {
  STATE_LABEL,
  activeTeams,
  approve,
  gradeText,
  nowCentral,
  ordinal,
  placementMap,
  requestStatus,
  seniority,
  sortedDivisions,
  teamOfFrom,
  teamPractice,
} from './model';
import './admin.css';

/** Two fictional coaches with no team yet, so the demo can show slot claiming. */
export const NEW_DEMO_COACHES: Person[] = [
  { id: 'person_demo_coach_1', firstName: 'Jordan', lastName: 'Hale', email: 'jordan.hale@example.com', phone: '816-555-0190' },
  { id: 'person_demo_coach_2', firstName: 'Priya', lastName: 'Nolan', email: 'priya.nolan@example.com', phone: '816-555-0191' },
];

export function CoachView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { data, index, addRecords, fixed } = useSeason();
  const personId = params.get('as') ?? '';
  const toApprove = (teamId: ID) => fixed.filter((p) => p.teamId === teamId && p.state === 'proposed').length;

  const heads = useMemo(() => {
    const list = data.coachAssignments
      .filter((c) => c.role === 'head')
      .map((c) => ({ c, person: index.person.get(c.personId), team: index.team.get(c.teamId) }))
      .filter((x): x is { c: CoachAssignment; person: Person; team: Team } => !!x.person && !!x.team);
    return list;
  }, [data, index]);
  const waitingCoaches = heads.filter((h) => toApprove(h.team.id) > 0);
  const newCoaches = NEW_DEMO_COACHES.filter((p) => !data.coachAssignments.some((c) => c.personId === p.id));
  const person = index.person.get(personId) ?? NEW_DEMO_COACHES.find((p) => p.id === personId);

  const signIn = (id: string) => {
    const demo = NEW_DEMO_COACHES.find((p) => p.id === id);
    if (demo && !index.person.has(demo.id)) addRecords({ people: [demo] });
    router.replace(id ? `${pathname}?as=${id}` : pathname);
  };

  return (
    <div className="adm-stack">
      <div className="adm-spread">
        <h1 style={{ margin: 0 }}>Coach view</h1>
        <label className="adm-row">
          <span className="adm-small muted">Sign in as</span>
          <select className="adm-select" value={person ? personId : ''} onChange={(e) => signIn(e.target.value)} style={{ maxWidth: 320 }}>
            <option value="">Choose a demo coach…</option>
            {sortedDivisions(index).map((d) => (
              <optgroup key={d.id} label={d.name}>
                {heads
                  .filter((h) => h.team.divisionId === d.id)
                  .sort((a, b) => compareStrings(a.team.label, b.team.label))
                  .map((h) => (
                    <option key={h.c.id} value={h.person.id}>
                      {fullName(h.person)} · {h.team.label}
                      {toApprove(h.team.id) ? ` · ${toApprove(h.team.id)} to approve` : ''}
                    </option>
                  ))}
              </optgroup>
            ))}
            {newCoaches.length > 0 && (
              <optgroup label="New coaches, no team yet">
                {newCoaches.map((p) => (
                  <option key={p.id} value={p.id}>
                    {fullName(p)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
      </div>
      {!person ? (
        <div className="card">
          <p style={{ marginTop: 0 }}>
            Pick a coach above to see what they see: their practice slot, game schedule and projected roster, with each kid&apos;s reasons. Coaches can
            approve a roster, flag a kid, propose a swap and make protected picks.
          </p>
          {waitingCoaches.length > 0 && (
            <div className="adm-next" style={{ marginBottom: 12 }}>
              <p>
                <b>Waiting for approval:</b>{' '}
                {waitingCoaches.slice(0, 6).map((h, i) => (
                  <span key={h.c.id}>
                    {i > 0 && ', '}
                    <a
                      href={`?as=${h.person.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        signIn(h.person.id);
                      }}
                    >
                      {fullName(h.person)} ({index.division.get(h.team.divisionId)?.name} · {h.team.label})
                    </a>
                  </span>
                ))}
                {waitingCoaches.length > 6 ? `, and ${waitingCoaches.length - 6} more` : ''}
              </p>
            </div>
          )}
          <p className="muted" style={{ marginBottom: 0 }}>
            Try one of the two new coaches to claim an open practice slot and schedule position. Their team shows up in the Team Finder right
            away.
          </p>
        </div>
      ) : (
        <CoachHome key={person.id} person={person} />
      )}
    </div>
  );
}

function CoachHome({ person }: { person: Person }) {
  const { data, index } = useSeason();
  const assignments = data.coachAssignments.filter((c) => c.personId === person.id && c.role === 'head');
  return (
    <>
      <p className="muted" style={{ margin: 0 }}>
        Signed in as <b>{fullName(person)}</b> (demo, no password). Coaches see their own roster in full; for other teams in the division, only
        player names and request flags. Guardian contacts appear after a round publishes.
      </p>
      {assignments.length === 0 ? (
        <ClaimSlot person={person} />
      ) : (
        assignments.map((ca) => {
          const team = index.team.get(ca.teamId);
          return team ? <TeamPanel key={ca.id} person={person} assignment={ca} team={team} /> : null;
        })
      )}
    </>
  );
}

function TeamPanel({ person, assignment, team }: { person: Person; assignment: CoachAssignment; team: Team }) {
  const { data, index, results, updateEdits, edits, asOf } = useSeason();
  const division = index.division.get(team.divisionId)!;
  const map = placementMap(results[division.id]);
  const teamOf = teamOfFrom(map);
  const { slot, field } = teamPractice(index, team);
  const roster = [...map.values()]
    .filter((p) => p.teamId === team.id)
    .map((p) => ({ p, reg: index.registration.get(p.registrationId)! }))
    .filter((x) => !!x.reg && (!asOf || x.reg.submittedAt <= asOf))
    .sort((a, b) => {
      const pa = index.player.get(a.reg.playerId)!;
      const pb = index.player.get(b.reg.playerId)!;
      return compareStrings(pa.lastName, pb.lastName) || compareStrings(pa.firstName, pb.firstName);
    });
  const proposed = roster.filter((x) => x.p.state === 'proposed').length;
  const approved = roster.filter((x) => x.p.state === 'approved').length;
  const published = roster.filter((x) => x.p.state === 'published').length;
  const pendingRound = roster.find((x) => x.p.state === 'approved' || x.p.state === 'proposed')?.p.round;
  const publishDate = pendingRound === 1 ? data.season.round1Publish : pendingRound === 2 ? data.season.round2Publish : undefined;
  const myNotes = edits.coachNotes.filter((n) => n.teamId === team.id);
  const addNote = (note: Omit<CoachNote, 'id' | 'at' | 'authorPersonId' | 'teamId' | 'status'>) =>
    updateEdits((e) => ({
      ...e,
      coachNotes: [
        ...e.coachNotes,
        { ...note, id: `note_${e.coachNotes.length + 1}_${team.id}`, at: nowCentral(), authorPersonId: person.id, teamId: team.id, status: 'open' },
      ],
    }));

  return (
    <section className="adm-stack" aria-labelledby={`team-${team.id}`}>
      <div className="card adm-stack">
        <div className="adm-spread">
          <h2 id={`team-${team.id}`} style={{ margin: 0 }}>
            {division.name} · {team.label}
            {team.name ? ` · ${team.name}` : ''}
          </h2>
          <span className="badge">{division.label}</span>
        </div>
        <div className="adm-stat-grid">
          <div className="adm-stat">
            <span className="muted adm-small">Practice</span>
            <b>{slot ? formatWindow(slot.window) : '—'}</b>
            <span className="adm-small">{field ? `${field.name} · ${field.park}` : ''}</span>
          </div>
          <div className="adm-stat">
            <span className="muted adm-small">Roster</span>
            <b>
              {roster.length} player{roster.length === 1 ? '' : 's'}
            </b>
            <span className="adm-small">
              {proposed} to approve · {approved} approved
            </span>
          </div>
        </div>
        <SizeBar n={roster.length} {...division.settings.teamSize} />
        <GameSchedule team={team} />
      </div>

      <div className="card adm-stack">
        <div className="adm-spread">
          <h3 style={{ margin: 0 }}>Your roster</h3>
          <button
            type="button"
            className="button small"
            disabled={proposed === 0}
            onClick={() => updateEdits((e) => ({ ...e, fixed: approve(index, e.fixed, { teamId: team.id }) }))}
          >
            Approve roster{proposed ? ` (${proposed})` : ''}
          </button>
        </div>
        <div className="adm-next" role="status">
          {proposed > 0 ? (
            <p>
              <b>The admin sent you {proposed} player{proposed === 1 ? '' : 's'} to approve.</b> Look them over (open &quot;Why on your team&quot; for
              the reasons), then press Approve roster. If someone shouldn&apos;t be here, flag them or propose a swap below instead.
              {pendingRound === 1 ? ' Round 1 only covers early sign-ups, so more players join after the regular deadline.' : ''}
            </p>
          ) : approved > 0 ? (
            <p>
              <b>Thanks, you approved this roster.</b> Next, the admin publishes it to families
              {publishDate ? ` (planned for ${formatDate(publishDate)})` : ''}. Guardian contacts show up here once it&apos;s published.
            </p>
          ) : published > 0 ? (
            <p>
              <b>This roster is published.</b> Guardian contacts are below each player. More players may join after the next round.
            </p>
          ) : (
            <p>
              Nothing to do yet. This roster is projected: it changes as families register. The admin will send it to you to approve after
              each registration deadline.
            </p>
          )}
        </div>
        <BadgeLegend coach />
        {roster.length === 0 ? (
          <p className="muted">No players yet.</p>
        ) : (
          <ul className="adm-roster">
            {roster.map(({ reg }) => (
              <RosterRow key={reg.id} registrationId={reg.id} teamId={team.id} onFlag={(text) => addNote({ kind: 'flag', registrationId: reg.id, text })} />
            ))}
          </ul>
        )}
      </div>

      <SwapProposal team={team} roster={roster.map((x) => x.reg.id)} onPropose={(a, b, text) => addNote({ kind: 'swap', registrationId: a, otherRegistrationId: b, text })} />
      <ProtectedPicks assignment={assignment} team={team} />

      {myNotes.length > 0 && (
        <div className="card adm-stack">
          <h3 style={{ margin: 0 }}>Notes to the admin</h3>
          <ul className="adm-small" style={{ margin: 0, paddingLeft: 18 }}>
            {myNotes.map((n) => {
              const p = index.registration.get(n.registrationId);
              const pl = p ? index.player.get(p.playerId) : undefined;
              const other = n.otherRegistrationId ? index.registration.get(n.otherRegistrationId) : undefined;
              const opl = other ? index.player.get(other.playerId) : undefined;
              return (
                <li key={n.id}>
                  {n.kind === 'flag' ? `Flagged ${pl ? fullName(pl) : ''}` : `Swap ${pl ? fullName(pl) : ''} for ${opl ? fullName(opl) : ''}`}
                  {n.text ? `: “${n.text}”` : ''} ·{' '}
                  <span className={`badge ${n.status === 'open' ? '' : n.status === 'done' ? 'good' : 'warning'}`}>
                    {n.status === 'open' ? 'Waiting for admin' : n.status === 'done' ? 'Handled' : 'Declined'}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

function RosterRow({ registrationId, teamId, onFlag }: { registrationId: ID; teamId: ID; onFlag: (text: string) => void }) {
  const { index, results } = useSeason();
  const reg = index.registration.get(registrationId)!;
  const player = index.player.get(reg.playerId)!;
  const map = placementMap(results[reg.divisionId]);
  const p = map.get(registrationId);
  const sen = seniority(index, reg.playerId, teamId);
  const req = requestStatus(index, reg, teamId, teamOfFrom(map));
  const [flagging, setFlagging] = useState(false);
  const [text, setText] = useState('');
  const published = p?.state === 'published';
  const coachLock = p?.locked ? p.reasons.find((r) => r.code === 'coachChild' || r.code === 'protectedPick') : undefined;
  const guardians = (index.household.get(player.householdId)?.guardianIds ?? []).map((g) => index.person.get(g)).filter((g): g is Person => !!g);
  return (
    <li>
      <div className="adm-spread">
        <b>{fullName(player)}</b>
        <span className="adm-chips">
          <span className="badge">{gradeText(player.grade)}</span>
          {p?.choiceRankMet ? <span className="badge">{ordinal(p.choiceRankMet)} choice</span> : null}
          {p && p.state !== 'projected' && (
            <span className={`badge state-${p.state}`}>{p.state === 'proposed' ? 'Needs your approval' : STATE_LABEL[p.state]}</span>
          )}
          {coachLock && <span className="badge good">{coachLock.code === 'coachChild' ? 'Your child' : 'Your protected pick'}</span>}
        </span>
      </div>
      <div className="adm-chips">
        <span className="badge">{sen.seasons ? `${sen.seasons} BVAC season${sen.seasons === 1 ? '' : 's'}` : 'New to BVAC'}</span>
        {sen.seasonsWithCoach > 0 && (
          <span className="badge good">
            {sen.returningWithCoach ? 'Played for you last season' : 'Played for you before'} ×{sen.seasonsWithCoach}
          </span>
        )}
      </div>
      <RequestChips req={req} />
      <details>
        <summary className="adm-small">Why on your team</summary>
        <ul className="adm-reasons">
          {(p?.reasons ?? []).map((r, i) => (
            <li key={i}>{r.text}</li>
          ))}
        </ul>
      </details>
      <div className="adm-small">
        {published ? (
          guardians.map((g) => (
            <div key={g.id}>
              Guardian: {fullName(g)} · <a href={`mailto:${g.email}`}>{g.email}</a>
              {g.phone ? ` · ${g.phone}` : ''}
            </div>
          ))
        ) : (
          <span className="muted">Guardian contacts appear once this roster is published.</span>
        )}
      </div>
      {flagging ? (
        <form
          className="adm-row"
          onSubmit={(e) => {
            e.preventDefault();
            onFlag(text.trim());
            setFlagging(false);
            setText('');
          }}
        >
          <label className="adm-sr" htmlFor={`flag-${registrationId}`}>
            Note for the admin
          </label>
          <input
            id={`flag-${registrationId}`}
            className="adm-input"
            placeholder="Note for the admin (optional)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ flex: '1 1 200px' }}
          />
          <button type="submit" className="button small">
            Send flag
          </button>
          <button type="button" className="adm-btn" onClick={() => setFlagging(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <div>
          <button type="button" className="adm-btn" onClick={() => setFlagging(true)}>
            Flag for admin review
          </button>
        </div>
      )}
    </li>
  );
}

function SwapProposal({ team, roster, onPropose }: { team: Team; roster: ID[]; onPropose: (mine: ID, theirs: ID, text: string) => void }) {
  const { index, results } = useSeason();
  const map = placementMap(results[team.divisionId]);
  const teamOf = teamOfFrom(map);
  const others = activeTeams(index, team.divisionId).filter((t) => t.id !== team.id);
  const [mine, setMine] = useState('');
  const [theirs, setTheirs] = useState('');
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  const name = (id: ID) => {
    const r = index.registration.get(id);
    const p = r ? index.player.get(r.playerId) : undefined;
    return p ? fullName(p) : id;
  };
  /** Other teams: names and request flags only. */
  const flagsText = (id: ID) => {
    const r = index.registration.get(id)!;
    const s = requestStatus(index, r, teamOf(id) ?? null, teamOf);
    const bits = [
      s.sibling !== null ? `sibling ${s.sibling ? '✓' : '✗'}` : '',
      s.friend ? `friend ${s.friend.met}/${s.friend.total}` : '',
      s.coach !== null ? `coach ${s.coach ? '✓' : '✗'}` : '',
    ].filter(Boolean);
    return bits.length ? ` · ${bits.join(', ')}` : '';
  };
  return (
    <form
      className="card adm-stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (!mine || !theirs) return;
        onPropose(mine, theirs, text.trim());
        setSent(true);
        setMine('');
        setTheirs('');
        setText('');
      }}
    >
      <h3 style={{ margin: 0 }}>Propose a swap</h3>
      <p className="muted adm-small" style={{ margin: 0 }}>
        Goes to the admin as a pending note. Nothing moves until the admin (and the other coach) agree.
      </p>
      <div className="adm-row">
        <label className="adm-field adm-small" style={{ flex: '1 1 220px' }}>
          Your player
          <select className="adm-select" value={mine} onChange={(e) => (setMine(e.target.value), setSent(false))}>
            <option value="">Choose…</option>
            {roster.map((id) => (
              <option key={id} value={id}>
                {name(id)}
              </option>
            ))}
          </select>
        </label>
        <label className="adm-field adm-small" style={{ flex: '1 1 220px' }}>
          Player on another team
          <select className="adm-select" value={theirs} onChange={(e) => (setTheirs(e.target.value), setSent(false))}>
            <option value="">Choose…</option>
            {others.map((t) => (
              <optgroup key={t.id} label={t.label}>
                {[...map.values()]
                  .filter((p) => p.teamId === t.id)
                  .map((p) => p.registrationId)
                  .sort((a, b) => compareStrings(name(a), name(b)))
                  .map((id) => (
                    <option key={id} value={id}>
                      {name(id)}
                      {flagsText(id)}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>
      <label className="adm-field adm-small">
        Why (optional)
        <input className="adm-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. carpool with a teammate" />
      </label>
      <div className="adm-row">
        <button type="submit" className="button small" disabled={!mine || !theirs}>
          Send to admin
        </button>
        {sent && (
          <span role="status" className="adm-small muted">
            Sent. The admin sees it on the team board.
          </span>
        )}
      </div>
    </form>
  );
}

function ProtectedPicks({ assignment, team }: { assignment: CoachAssignment; team: Team }) {
  const { data, index, updateEdits } = useSeason();
  const division = index.division.get(team.divisionId)!;
  const limit = division.settings.coachProtectedPicks;
  const ownHouseholds = new Set(data.households.filter((h) => h.guardianIds.includes(assignment.personId)).map((h) => h.id));
  const isOwnKid = (playerId: ID) => ownHouseholds.has(index.player.get(playerId)?.householdId ?? '');
  const ownKids = (index.registrationsByDivision.get(division.id) ?? []).filter((r) => isOwnKid(r.playerId)).map((r) => r.playerId);
  // Returning players: registered in this division and played for this coach before.
  const candidates = (index.registrationsByDivision.get(division.id) ?? [])
    .filter((r) => !isOwnKid(r.playerId) && (index.historyByPlayer.get(r.playerId) ?? []).some((h) => h.coachPersonId === assignment.personId))
    .map((r) => r.playerId)
    .sort((a, b) => compareStrings(index.player.get(a)!.lastName, index.player.get(b)!.lastName));
  const current = assignment.protectedPlayerIds.filter((id) => !isOwnKid(id));
  const [picks, setPicks] = useState<ID[]>(current);
  const [saved, setSaved] = useState(false);
  const dirty = JSON.stringify([...picks].sort(compareStrings)) !== JSON.stringify([...current].sort(compareStrings));
  const toggle = (id: ID) => {
    setSaved(false);
    setPicks((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < limit ? [...p, id] : p));
  };
  const name = (id: ID) => {
    const p = index.player.get(id);
    return p ? fullName(p) : id;
  };
  return (
    <form
      className="card adm-stack"
      onSubmit={(e) => {
        e.preventDefault();
        const protectedPlayerIds = [...new Set([...assignment.protectedPlayerIds.filter(isOwnKid), ...ownKids, ...picks])];
        updateEdits((ed) => ({
          ...ed,
          coachAssignmentPatches: { ...ed.coachAssignmentPatches, [assignment.id]: { protectedPlayerIds } },
        }));
        setSaved(true);
      }}
    >
      <h3 style={{ margin: 0 }}>Protected picks</h3>
      <p className="muted adm-small" style={{ margin: 0 }}>
        Choose up to {limit} returning player{limit === 1 ? '' : 's'} to lock onto your team before placement runs.
        {ownKids.length > 0 && ` Your own kids (${ownKids.map(name).join(', ')}) are always on your team and don't count.`}
      </p>
      {candidates.length === 0 ? (
        <p className="muted adm-small">No returning players from your past teams registered in this division yet.</p>
      ) : (
        <div className="adm-stack" style={{ gap: 6 }}>
          {candidates.map((id) => {
            const reg = index.registrationByPlayer.get(id);
            const seasons = (index.historyByPlayer.get(id) ?? []).filter((h) => h.coachPersonId === assignment.personId).length;
            const checked = picks.includes(id);
            return (
              <label key={id} className="adm-check adm-small">
                <input type="checkbox" checked={checked} disabled={!checked && picks.length >= limit} onChange={() => toggle(id)} />
                <span>
                  {name(id)} <span className="muted">· {seasons} season{seasons === 1 ? '' : 's'} with you</span>
                  {reg && reg.choices[0] && reg.choices[0].teamId !== team.id && (
                    <span className="muted"> · ranked {index.team.get(reg.choices[0].teamId)?.label} first</span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      )}
      <div className="adm-row">
        <button type="submit" className="button small" disabled={!dirty}>
          Save picks ({picks.length}/{limit})
        </button>
        {saved && !dirty && (
          <span role="status" className="adm-small muted">
            Saved. Placements re-ran with your picks locked.
          </span>
        )}
      </div>
    </form>
  );
}

function GameSchedule({ team }: { team: Team }) {
  const { data, index, schedules } = useSeason();
  // The season-wide schedule from the store, so coaches see the same games as families.
  const schedule = schedules.find((r) => r.divisionId === team.divisionId) ?? { games: [], tracks: [] };
  const trackId = team.gameTrackId;
  if (!trackId) return <p className="muted adm-small">No game track yet. Game times to be announced.</p>;
  const track = schedule.tracks.find((t) => t.id === trackId) ?? index.gameTrack.get(trackId);
  const slotById = new Map(data.gameSlots.map((s) => [s.id, s]));
  const teamByTrack = new Map(data.teams.filter((t) => t.gameTrackId && t.status !== 'cancelled').map((t) => [t.gameTrackId!, t]));
  const games = schedule.games
    .filter((g) => g.homeTrackId === trackId || g.awayTrackId === trackId)
    .map((g) => ({ g, slot: slotById.get(g.gameSlotId)! }))
    .filter((x) => !!x.slot)
    .sort((a, b) => compareStrings(a.slot.date, b.slot.date) || a.slot.start - b.slot.start);
  const opponent = (id: ID) => {
    const t = teamByTrack.get(id);
    const tr = schedule.tracks.find((x) => x.id === id);
    return t ? t.label : `Team ${tr?.position ?? '?'}`;
  };
  return (
    <details className="adm-games">
      <summary>
        <b>Games:</b> {track?.description || `schedule slot ${track?.position ?? '?'}`} ({games.length} games, tap to see them all)
      </summary>
      <div className="table-wrap" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Time</th>
              <th scope="col">Field</th>
              <th scope="col">Opponent</th>
            </tr>
          </thead>
          <tbody>
            {games.map(({ g, slot }) => (
              <tr key={g.id}>
                <td>{formatDate(slot.date)}</td>
                <td>{formatTime(slot.start)}</td>
                <td>{index.field.get(slot.fieldId)?.name}</td>
                <td>
                  {g.homeTrackId === trackId ? 'vs' : 'at'} {opponent(g.homeTrackId === trackId ? g.awayTrackId : g.homeTrackId)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** A coach without a team claims an open practice slot and schedule position. */
function ClaimSlot({ person }: { person: Person }) {
  const { data, index, addRecords } = useSeason();
  const divisions = sortedDivisions(index);
  const [divisionId, setDivisionId] = useState(divisions[2]?.id ?? divisions[0]!.id);
  const division = index.division.get(divisionId)!;
  const usedSlots = new Map<ID, number>();
  for (const t of data.teams) if (t.status !== 'cancelled') usedSlots.set(t.practiceSlotId, (usedSlots.get(t.practiceSlotId) ?? 0) + 1);
  const openSlots = data.practiceSlots
    .filter((s) => s.divisionId === divisionId && (usedSlots.get(s.id) ?? 0) < s.teamCapacity)
    .sort((a, b) => compareWindows(a.window, b.window) || compareStrings(a.id, b.id));
  const claimedTracks = new Set(data.teams.filter((t) => t.status !== 'cancelled' && t.gameTrackId).map((t) => t.gameTrackId!));
  const divisionTracks = data.gameTracks.filter((t) => t.divisionId === divisionId);
  const openTracks = divisionTracks.filter((t) => !claimedTracks.has(t.id)).sort((a, b) => a.position - b.position);
  const nextPosition = divisionTracks.reduce((m, t) => Math.max(m, t.position), 0) + 1;
  const NEW = 'new';
  const [slotId, setSlotId] = useState('');
  const [trackId, setTrackId] = useState('');
  const chosenSlot = openSlots.find((s) => s.id === slotId) ?? openSlots[0];
  const chosenTrack = trackId === NEW ? NEW : (openTracks.find((t) => t.id === trackId)?.id ?? openTracks[0]?.id ?? NEW);
  const usedLabels = new Set((index.teamsByDivision.get(divisionId) ?? []).map((t) => t.label));
  const label = `Option ${[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].find((c) => !usedLabels.has(`Option ${c}`)) ?? 'Z'}`;

  const claim = () => {
    if (!chosenSlot) return;
    const teamId = `team_claim_${person.id}`;
    let track: GameTrack | undefined;
    if (chosenTrack === NEW) track = { id: `track_claim_${person.id}`, divisionId, position: nextPosition, description: '' };
    const team: Team = { id: teamId, divisionId, label, practiceSlotId: chosenSlot.id, gameTrackId: track?.id ?? chosenTrack, status: 'open' };
    addRecords({
      ...(index.person.has(person.id) ? {} : { people: [person] }),
      teams: [team],
      coachAssignments: [{ id: `coach_claim_${person.id}`, personId: person.id, teamId, role: 'head', protectedPlayerIds: [] }],
      ...(track ? { gameTracks: [track] } : {}),
    });
  };

  return (
    <form
      className="card adm-stack"
      onSubmit={(e) => {
        e.preventDefault();
        claim();
      }}
    >
      <h2 style={{ margin: 0 }}>Claim a practice slot</h2>
      <p className="muted" style={{ margin: 0 }}>
        You don&apos;t have a team yet. Pick a division, an open practice slot and a place in the game schedule. That pair becomes a team option
        families can see and rank in the Team Finder.
      </p>
      <label className="adm-field">
        Division
        <select
          className="adm-select"
          value={divisionId}
          onChange={(e) => {
            setDivisionId(e.target.value);
            setSlotId('');
            setTrackId('');
          }}
        >
          {divisions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} · {d.label}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="adm-stack" style={{ border: 0, padding: 0, margin: 0, gap: 6 }}>
        <legend className="label" style={{ fontWeight: 600, marginBottom: 6 }}>
          Practice slot
        </legend>
        {openSlots.length === 0 && <p className="muted adm-small">No open practice slots in {division.name}. Ask the admin to add one.</p>}
        {openSlots.map((s) => {
          const used = usedSlots.get(s.id) ?? 0;
          const f = index.field.get(s.fieldId);
          return (
            <label key={s.id} className="adm-check">
              <input type="radio" name="slot" checked={chosenSlot?.id === s.id} onChange={() => setSlotId(s.id)} />
              <span>
                {formatWindow(s.window)} · {f?.name}{' '}
                <span className="muted adm-small">
                  ({s.teamCapacity - used} of {s.teamCapacity} team spot{s.teamCapacity === 1 ? '' : 's'} open)
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>
      <fieldset className="adm-stack" style={{ border: 0, padding: 0, margin: 0, gap: 6 }}>
        <legend className="label" style={{ fontWeight: 600, marginBottom: 6 }}>
          Game schedule position
        </legend>
        {openTracks.map((t) => (
          <label key={t.id} className="adm-check">
            <input type="radio" name="track" checked={chosenTrack === t.id} onChange={() => setTrackId(t.id)} />
            <span>
              Team {t.position}
              {t.description ? ` · ${t.description}` : ''}
            </span>
          </label>
        ))}
        <label className="adm-check">
          <input type="radio" name="track" checked={chosenTrack === NEW} onChange={() => setTrackId(NEW)} />
          <span>
            New position (Team {nextPosition}){' '}
            <span className="muted adm-small">
              · {openTracks.length ? 'adds a position to the schedule' : 'every current position is taken, so the schedule adds one'}
            </span>
          </span>
        </label>
      </fieldset>
      <div className="adm-row">
        <button type="submit" className="button" disabled={!chosenSlot}>
          Claim as {label}
        </button>
      </div>
    </form>
  );
}
