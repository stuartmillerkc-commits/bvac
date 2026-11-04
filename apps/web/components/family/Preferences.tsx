'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  addDays,
  compareStrings,
  completeFactorRanking,
  FACTOR_LABELS,
  formatDate,
  formatWindow,
  fullName,
  type Division,
  type Factor,
  type ID,
  type Player,
  type PlayerRequest,
  type Registration,
} from '@bvac/core';
import { useSeason } from '@/lib/season-store';
import { coachName, isFirstComeFirstServed, matchPlayerName, playerLine, registeredPlayers, seatInfo, teamFits, visibleTeams } from './helpers';
import { RankList, ordinal } from './RankList';
import { SeatChip, seatRuleText } from './SeatChip';
import { GAMES_TBA, useTrackDescriptions } from './useTrackDescriptions';
import s from './family.module.css';

export function Preferences() {
  const params = useSearchParams();
  const ref = params.get('ref');
  const { index, loaded } = useSeason();
  if (!ref) return <FamilyPicker />;
  const registration = index.registration.get(ref);
  if (!registration) {
    if (!loaded) return <p className="muted">Loading your registration…</p>;
    return (
      <div className={`${s.page} card ${s.stack}`}>
        <h1>We couldn&apos;t find that registration</h1>
        <p className="muted" style={{ margin: 0 }}>
          The link may be from an older copy of the demo, or the demo was reset. Pick a family below, or register again.
        </p>
        <div className={s.row}>
          <Link className="button" href="/preferences/">
            View as a family
          </Link>
          <Link href="/register/">Register (mock)</Link>
        </div>
      </div>
    );
  }
  return <PreferencesEditor key={registration.id} registration={registration} />;
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

interface Draft {
  ranked: ID[];
  anyFitting: boolean;
  factors: Factor[];
  requests: PlayerRequest[];
}

type Index = ReturnType<typeof useSeason>['index'];

/** The registration as saved. */
function savedDraft(r: Registration): Draft {
  return {
    ranked: [...r.choices].sort((a, b) => a.rank - b.rank).map((c) => c.teamId),
    anyFitting: r.acceptAnyFittingTeam,
    factors: completeFactorRanking(r.factorRanking),
    requests: r.requests.map((q) => ({ ...q })),
  };
}

/** Starting point on the page: saved choices first, then every other team that fits the family's days. */
function startingDraft(index: Index, r: Registration): Draft {
  const saved = savedDraft(r);
  const fitting = visibleTeams(index, r.divisionId)
    .filter((t) => !saved.ranked.includes(t.id) && teamFits(index, t, r.availability))
    .map((t) => t.id);
  return { ...saved, ranked: [...saved.ranked, ...fitting] };
}

function sameDraft(a: Draft, b: Draft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function PreferencesEditor({ registration: r }: { registration: Registration }) {
  const { data, index, results, patchRegistration } = useSeason();
  const tracks = useTrackDescriptions();
  const [saved, setSaved] = useState<Draft>(() => savedDraft(r));
  const [draft, setDraft] = useState<Draft>(() => startingDraft(index, r));
  /** True until the family changes anything: the ranking includes teams we added for them. */
  const [autoAdded, setAutoAdded] = useState(() => startingDraft(index, r).ranked.length > r.choices.length);
  const [status, setStatus] = useState('');
  const player = index.player.get(r.playerId);
  const division = index.division.get(r.divisionId);
  if (!player || !division) return <p>This registration is missing its player or division.</p>;

  const season = data.season;
  const teams = visibleTeams(index, division.id);
  const fcfs = isFirstComeFirstServed(division);
  const unranked = teams.filter((t) => !draft.ranked.includes(t.id));
  const dirty = !sameDraft(draft, saved);
  const changeDeadline = addDays(season.meetTheCoaches, 1);
  const placement = results[division.id]?.placements.find((p) => p.registrationId === r.id);
  const placedTeam = placement?.teamId ? index.team.get(placement.teamId) : undefined;

  const teamLabel = (id: ID) => {
    const t = index.team.get(id);
    const slot = t ? index.practiceSlot.get(t.practiceSlotId) : undefined;
    return t ? `${t.label}${slot ? `, ${formatWindow(slot.window)}` : ''}` : id;
  };

  const save = () => {
    patchRegistration(r.id, {
      choices: draft.ranked.map((teamId, i) => ({ teamId, rank: i + 1 })),
      acceptAnyFittingTeam: draft.anyFitting,
      factorRanking: draft.factors,
      requests: draft.requests,
    });
    setSaved(draft);
    setAutoAdded(false);
    setStatus('Saved. BVAC will use these choices the next time teams are projected.');
  };

  const touch = () => {
    setStatus('');
    setAutoAdded(false);
  };

  const setRequest = (i: number, next: PlayerRequest) => {
    touch();
    setDraft((d) => ({ ...d, requests: d.requests.map((q, j) => (j === i ? next : q)) }));
  };

  return (
    <div className={`${s.page} ${s.stack}`}>
      <header>
        <p className="muted" style={{ margin: 0 }}>
          Team preferences · {season.name}
        </p>
        <h1 style={{ marginBottom: 4 }}>
          {fullName(player)} · {division.name}
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          {division.label} · registered {formatDate(r.submittedAt.slice(0, 10))} ({r.window}) · practice days{' '}
          {r.availability.map(formatWindow).join(', ') || 'not given'}
          {r.availabilityRequired ? ' (only these days)' : ' (preferences)'}
        </p>
      </header>

      <p className={s.ruleNote}>
        Your SportsEngine registration already has your 1st and 2nd choice. Here you can rank every team that works, say any team on your nights
        is fine, and check friend requests. You can change this until {formatDate(changeDeadline)}.
      </p>

      {/* ---------------------------------------------------------- ranking */}
      <section className={`card ${s.stack}`} aria-labelledby="pref-rank">
        <div>
          <h2 id="pref-rank" style={{ marginBottom: 4 }}>
            Rank your team options
          </h2>
          <p className={s.hint}>Drag the handle, use the arrow buttons, or focus a handle and press the up and down arrow keys. Top is your 1st choice.</p>
        </div>
        <p className={s.hint}>{seatRuleText(fcfs)}</p>
        {draft.ranked.length ? (
          <RankList
            label="Your ranked team options"
            items={draft.ranked}
            getKey={(id) => id}
            getLabel={teamLabel}
            onChange={(ranked) => {
              touch();
              setDraft((d) => ({ ...d, ranked }));
            }}
            renderItem={(id) => <TeamLine teamId={id} division={division} registration={r} gamePattern={tracks} />}
            renderActions={(id) => (
              <button
                type="button"
                className={s.iconButton}
                aria-label={`Remove ${teamLabel(id)} from my ranking`}
                onClick={() => {
                  touch();
                  setDraft((d) => ({ ...d, ranked: d.ranked.filter((x) => x !== id) }));
                }}
              >
                <span aria-hidden="true">✕</span>
              </button>
            )}
          />
        ) : (
          <p className="muted">No teams ranked. Add one below, or tick &quot;any team on these nights&quot;.</p>
        )}

        {unranked.length ? (
          <>
            <h3 className={s.sectionTitle}>Not ranked</h3>
            <ul className={s.unrankedList}>
              {unranked.map((t) => {
                const fits = teamFits(index, t, r.availability);
                const blocked = !fits && r.availabilityRequired;
                return (
                  <li key={t.id}>
                    <TeamLine teamId={t.id} division={division} registration={r} gamePattern={tracks} />
                    <button
                      type="button"
                      className="button secondary"
                      disabled={blocked}
                      aria-label={`Add ${teamLabel(t.id)} to my ranking`}
                      title={blocked ? 'You said only your checked days work, so this team can’t be used.' : undefined}
                      onClick={() => {
                        touch();
                        setDraft((d) => ({ ...d, ranked: [...d.ranked, t.id] }));
                      }}
                    >
                      Add
                    </button>
                  </li>
                );
              })}
            </ul>
            {r.availabilityRequired && unranked.some((t) => !teamFits(index, t, r.availability)) ? (
              <p className={s.hint}>You said only your checked days work, so teams on other days can&apos;t be added.</p>
            ) : null}
          </>
        ) : null}

        <label className={s.check}>
          <input
            type="checkbox"
            checked={draft.anyFitting}
            onChange={(e) => {
              touch();
              setDraft((d) => ({ ...d, anyFitting: e.target.checked }));
            }}
          />
          Any team on these nights is fine if my ranked teams are full
        </label>
      </section>

      {/* ---------------------------------------------------------- factors */}
      <section className={`card ${s.stack}`} aria-labelledby="pref-factors">
        <div>
          <h2 id="pref-factors" style={{ marginBottom: 4 }}>
            What matters most to you?
          </h2>
          <p className={s.hint}>Most important at the top. This only changes how much each thing counts for {player.firstName}.</p>
        </div>
        <RankList
          label="What matters most, in order"
          items={draft.factors}
          getKey={(f) => f}
          getLabel={(f) => FACTOR_LABELS[f]}
          onChange={(factors) => {
            touch();
            setDraft((d) => ({ ...d, factors }));
          }}
          renderItem={(f) => <span>{FACTOR_LABELS[f]}</span>}
        />
      </section>

      {/* ---------------------------------------------------------- requests */}
      <section className={`card ${s.stack}`} aria-labelledby="pref-requests">
        <div>
          <h2 id="pref-requests" style={{ marginBottom: 4 }}>
            Friend and sibling requests
          </h2>
          <p className={s.hint}>
            We check the names you typed against kids registered in {division.name}. Confirm the ones we weren&apos;t sure about.
          </p>
        </div>
        {draft.requests.length ? (
          draft.requests.map((q, i) => <RequestConfirm key={q.id} request={q} registration={r} onChange={(next) => setRequest(i, next)} />)
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            No player requests on this registration.
          </p>
        )}
      </section>

      {division.settings.showProjectedToFamilies && placement ? (
        <p className="card" style={{ margin: 0 }}>
          Projected team right now:{' '}
          <strong>{placedTeam ? teamLabel(placedTeam.id) : 'waitlist'}</strong>
          {placement.choiceRankMet ? ` (your ${ordinal(placement.choiceRankMet)} choice)` : ''}. This can still change until rosters publish.
        </p>
      ) : (
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          Teams aren&apos;t shown to families until BVAC publishes them: round 1 on {formatDate(season.round1Publish)}, round 2 on{' '}
          {formatDate(season.round2Publish)}.
        </p>
      )}

      <div className={s.saveBar}>
        <span aria-live="polite" className={status ? s.matchFound : 'muted'}>
          {status ||
            (dirty
              ? autoAdded
                ? 'We added the other teams that fit your days below your choices. Save to keep this ranking.'
                : 'You have unsaved changes.'
              : 'Everything is saved.')}
        </span>
        <div className={s.row}>
          <button type="button" className="button secondary" disabled={!dirty} onClick={() => {
              touch();
              setDraft(saved);
            }}>
            Undo changes
          </button>
          <button type="button" className="button" disabled={!dirty} onClick={save}>
            Save preferences
          </button>
        </div>
      </div>
    </div>
  );
}

function TeamLine({
  teamId,
  division,
  registration,
  gamePattern,
}: {
  teamId: ID;
  division: Division;
  registration: Registration;
  gamePattern: Map<ID, string>;
}) {
  const { index, results } = useSeason();
  const t = index.team.get(teamId);
  if (!t) return null;
  const slot = index.practiceSlot.get(t.practiceSlotId);
  const field = slot ? index.field.get(slot.fieldId) : undefined;
  const fits = teamFits(index, t, registration.availability);
  const coach = division.settings.showCoachNames ? coachName(index, t) : undefined;
  return (
    <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
      <strong>
        {t.label}
        {slot ? ` · ${formatWindow(slot.window)}` : ''}
      </strong>
      <span className={s.metaLine}>
        <span className={fits ? s.fit : s.noFit}>{fits ? '✓ Fits your days' : '✗ Doesn’t fit your days'}</span>
        <SeatChip info={seatInfo(index, results, t)} fcfs={isFirstComeFirstServed(division)} />
      </span>
      <span className={s.metaLine}>
        {[field?.name, coach, `Games: ${(t.gameTrackId && gamePattern.get(t.gameTrackId)) || GAMES_TBA}`].filter(Boolean).join(' · ')}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Request confirmation
// ---------------------------------------------------------------------------

function RequestConfirm({
  request: q,
  registration,
  onChange,
}: {
  request: PlayerRequest;
  registration: Registration;
  onChange: (next: PlayerRequest) => void;
}) {
  const { index } = useSeason();
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState('');
  /** The family said none of the suggestions is right (yet). */
  const [declined, setDeclined] = useState(false);
  const pools = useMemo(() => registeredPlayers(index, registration.divisionId, registration.playerId), [index, registration]);
  const target = q.targetPlayerId ? index.player.get(q.targetPlayerId) : undefined;
  const kind = q.type === 'sibling' ? 'Sibling' : 'Friend';
  const line = (p: Player) => playerLine(index, p);

  const resolved = (q.matchStatus === 'matched' || q.matchStatus === 'confirmed') && target;
  if (resolved && !editing) {
    return (
      <div className={s.requestBox}>
        <span className={s.metaLine}>
          {kind} request · you typed “{q.targetName}”
        </span>
        <p className={s.matchFound}>
          ✓ {q.matchStatus === 'confirmed' ? 'Confirmed' : 'We found'}: {line(target)}
        </p>
        <div>
          <button type="button" className={s.linkButton} onClick={() => setEditing(true)}>
            Not the right {kind.toLowerCase()}?
          </button>
        </div>
      </div>
    );
  }

  // Suggestions: the importer's candidates, else our own match on the typed name.
  const candidateIds = q.candidatePlayerIds?.length ? q.candidatePlayerIds : matchPlayerName(q.targetName, pools.same, pools.others).candidates.map((p) => p.id);
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const searchHits = words.length
    ? [...pools.same, ...pools.others]
        .filter((p) => {
          const name = `${p.firstName} ${p.nickname ?? ''} ${p.lastName}`.toLowerCase();
          return words.every((w) => name.includes(w));
        })
        .sort((a, b) => compareStrings(a.lastName, b.lastName) || compareStrings(a.firstName, b.firstName))
        .slice(0, 6)
    : [];
  const options = [...new Set([...candidateIds, ...searchHits.map((p) => p.id)])]
    .map((id) => index.player.get(id))
    .filter((p): p is Player => !!p);
  const groupName = `req-${q.id}`;
  const choose = (playerId: ID) => {
    const { candidatePlayerIds: _drop, ...rest } = q;
    onChange({ ...rest, targetPlayerId: playerId, matchStatus: 'confirmed' });
    setEditing(false);
    setSearch('');
    setDeclined(false);
  };
  const notYet = () => {
    const { targetPlayerId: _drop, ...rest } = q;
    onChange({ ...rest, matchStatus: q.matchStatus === 'ambiguous' ? 'ambiguous' : 'unmatched' });
    setDeclined(true);
  };

  return (
    <fieldset className={`${s.requestBox} ${s.fieldset}`}>
      <legend className={s.label} style={{ padding: '0 4px' }}>
        {kind} request: “{q.targetName}”
      </legend>
      <p className={q.matchStatus === 'ambiguous' ? s.matchMaybe : s.matchNone}>
        {q.matchStatus === 'ambiguous'
          ? `More than one registered player could match. Which one is “${q.targetName}”?`
          : options.length
            ? `We couldn’t be sure who “${q.targetName}” is. Is it one of these?`
            : `We couldn’t find “${q.targetName}” among registered players yet. Try searching below.`}
      </p>
      {options.length ? (
        <div className={s.choiceStack}>
          {options.map((p) => (
            <label key={p.id} className={s.check}>
              <input type="radio" name={groupName} checked={q.targetPlayerId === p.id} onChange={() => choose(p.id)} />
              {line(p)}
            </label>
          ))}
        </div>
      ) : null}
      <label className={s.field}>
        <span className={s.small}>Search registered players by name</span>
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. Martinez" />
      </label>
      {words.length && !searchHits.length ? <p className={s.hint}>No registered player matches “{search}”.</p> : null}
      <label className={s.check}>
        <input type="radio" name={groupName} checked={declined && !q.targetPlayerId} onChange={notYet} />
        {q.matchStatus === 'ambiguous' ? 'None of these, or not sure' : 'They haven’t registered yet'} (an admin will match them later)
      </label>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// No ref: view as a family
// ---------------------------------------------------------------------------

function FamilyPicker() {
  const { data, index, edits } = useSeason();
  const [search, setSearch] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const divisions = [...data.divisions].sort((a, b) => a.sortOrder - b.sortOrder);
  const active = data.registrations.filter((r) => r.status === 'active');
  const mine = edits.added.registrations.map((r) => index.registration.get(r.id)).filter((r): r is Registration => !!r);

  const suggestions = useMemo(() => {
    const active = data.registrations.filter((r) => r.status === 'active');
    const picks: { r: Registration; why: string }[] = [];
    const add = (why: string, pred: (r: Registration) => boolean) => {
      const r = active.find((x) => pred(x) && !picks.some((p) => p.r.id === x.id) && x.source !== 'native');
      if (r) picks.push({ r, why });
    };
    add('Friend request we weren’t sure about', (r) => r.requests.some((q) => q.matchStatus === 'ambiguous'));
    add('Friend not found yet', (r) => r.requests.some((q) => q.matchStatus === 'unmatched'));
    add('Only certain days work', (r) => r.availabilityRequired && r.choices.length >= 2);
    add('Sibling request', (r) => r.requests.some((q) => q.type === 'sibling'));
    add('First come, first served division', (r) => index.division.get(r.divisionId)?.settings.model === 'fcfs');
    add('Asked for a coach', (r) => !!r.coachRequest?.coachPersonId);
    return picks;
  }, [data.registrations, index]);

  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const hits =
    words.length || divisionId
      ? active
          .filter((r) => !divisionId || r.divisionId === divisionId)
          .filter((r) => {
            const p = index.player.get(r.playerId);
            if (!p) return false;
            const name = `${p.firstName} ${p.nickname ?? ''} ${p.lastName}`.toLowerCase();
            return words.every((w) => name.includes(w));
          })
          .sort((a, b) => {
            const pa = index.player.get(a.playerId)!;
            const pb = index.player.get(b.playerId)!;
            return compareStrings(pa.lastName, pb.lastName) || compareStrings(pa.firstName, pb.firstName);
          })
      : [];

  const item = (r: Registration, why?: string) => {
    const p = index.player.get(r.playerId);
    const d = index.division.get(r.divisionId);
    if (!p) return null;
    return (
      <li key={r.id}>
        <Link href={`/preferences/?ref=${r.id}`}>
          <span>
            <strong>{fullName(p)}</strong> · {d?.name}
          </span>
          <span className="muted">{why ?? `${r.choices.length} ranked · ${r.requests.length} requests`}</span>
        </Link>
      </li>
    );
  };

  return (
    <div className={`${s.page} ${s.stack}`}>
      <header>
        <h1>Team preferences</h1>
        <p className={`muted ${s.intro}`}>
          Families reach this page from the link on SportsEngine&apos;s last page and in its follow-up email. Each link carries the
          family&apos;s registration, so there&apos;s no sign-in. For the demo, pick a family to view the page as them.
        </p>
      </header>

      {mine.length ? (
        <section className={`card ${s.stack}`} aria-labelledby="picker-mine">
          <h2 id="picker-mine" style={{ margin: 0 }}>
            Registered in this browser
          </h2>
          <ul className={s.familyList}>{mine.map((r) => item(r))}</ul>
        </section>
      ) : null}

      <section className={`card ${s.stack}`} aria-labelledby="picker-suggested">
        <h2 id="picker-suggested" style={{ margin: 0 }}>
          Sample families worth a look
        </h2>
        <ul className={s.familyList}>{suggestions.map(({ r, why }) => item(r, why))}</ul>
      </section>

      <section className={`card ${s.stack}`} aria-labelledby="picker-search">
        <h2 id="picker-search" style={{ margin: 0 }}>
          Find a family
        </h2>
        <div className={s.formGrid}>
          <label className={s.field}>
            <span className={s.label}>Player name</span>
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. Olivia" />
          </label>
          <label className={s.field}>
            <span className={s.label}>Division</span>
            <select value={divisionId} onChange={(e) => setDivisionId(e.target.value)}>
              <option value="">All divisions</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · {d.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {words.length || divisionId ? (
          <>
            <p className={s.hint} aria-live="polite">
              {hits.length} {hits.length === 1 ? 'family' : 'families'} found{hits.length > 25 ? ', showing the first 25' : ''}.
            </p>
            <ul className={s.familyList}>{hits.slice(0, 25).map((r) => item(r))}</ul>
          </>
        ) : (
          <p className={s.hint}>Type a name or pick a division.</p>
        )}
        <p className={s.hint}>
          Or <Link href="/register/">register a new family</Link> through the mock SportsEngine form.
        </p>
      </section>
    </div>
  );
}
