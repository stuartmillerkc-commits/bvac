'use client';

import { useEffect, useRef, useState } from 'react';
import { formatDate, type ID } from '@bvac/core';
import { useSeason } from '@/lib/season-store';

interface FeedItem {
  kind: 'new' | 'moved' | 'flag';
  text: string;
  severity?: 'warning' | 'critical';
}

interface FeedDay {
  key: string;
  label: string;
  items: FeedItem[];
}

interface Snapshot {
  asOf: string;
  team: Map<ID, ID | null>;
  flags: Set<string>;
}

const MAX_DAYS = 40;
const MAX_ITEMS_PER_DAY = 25;

/**
 * "What changed" as the As-of date moves forward (docs/DESIGN.md "Live
 * projections"): kids who registered and where the engine put them, kids the
 * engine moved and why, and new flags. Moving the date backward clears it.
 */
export function ReplayFeed() {
  const { results, asOf, index, data } = useSeason();
  const prev = useRef<Snapshot | null>(null);
  const [days, setDays] = useState<FeedDay[]>([]);

  useEffect(() => {
    const now = asOf ?? '9999';
    const team = new Map<ID, ID | null>();
    // Flags keyed by what they're about (not their wording, which changes as counts change).
    const flags = new Set<string>();
    const flagText = new Map<string, { severity: 'warning' | 'critical'; divisionId: string; message: string }>();
    const reasonOf = new Map<ID, string>();
    for (const r of Object.values(results)) {
      for (const p of r.placements) {
        team.set(p.registrationId, p.teamId);
        reasonOf.set(p.registrationId, p.reasons[0]?.text ?? '');
      }
      for (const f of r.flags) {
        // Every team starts under its minimum while registration is open; not news.
        if (f.severity === 'info' || f.code === 'teamUnderMin') continue;
        const key = [f.code, f.divisionId ?? '', f.teamId ?? '', f.registrationId ?? ''].join('|');
        flags.add(key);
        flagText.set(key, { severity: f.severity, divisionId: f.divisionId ?? '', message: f.message });
      }
    }
    const before = prev.current;
    prev.current = { asOf: now, team, flags };
    if (!before) return;
    if (now < before.asOf) {
      setDays([]);
      return;
    }
    if (now === before.asOf) return;

    const name = (regId: ID) => {
      const reg = index.registration.get(regId);
      const p = reg ? index.player.get(reg.playerId) : undefined;
      const d = reg ? index.division.get(reg.divisionId) : undefined;
      return `${p ? `${p.firstName} ${p.lastName}` : regId}${d ? ` (${d.code})` : ''}`;
    };
    const label = (teamId: ID | null | undefined) => (teamId ? (index.team.get(teamId)?.label ?? teamId) : 'the waitlist');
    const items: FeedItem[] = [];
    for (const [regId, t] of team) {
      if (!before.team.has(regId)) items.push({ kind: 'new', text: `${name(regId)} registered → ${label(t)}${reasonOf.get(regId) ? ` · ${reasonOf.get(regId)}` : ''}` });
    }
    for (const [regId, t] of team) {
      const was = before.team.get(regId);
      if (before.team.has(regId) && was !== t) {
        items.push({ kind: 'moved', text: `${name(regId)} moved from ${label(was)} to ${label(t)}${reasonOf.get(regId) ? ` · ${reasonOf.get(regId)}` : ''}` });
      }
    }
    for (const key of flags) {
      if (before.flags.has(key)) continue;
      const { severity, divisionId, message } = flagText.get(key)!;
      const d = data.divisions.find((x) => x.id === divisionId);
      items.push({ kind: 'flag', severity, text: `${d ? `${d.code}: ` : ''}${message}` });
    }
    if (items.length === 0) return;
    const dayLabel = asOf ? formatDate(asOf.slice(0, 10)) : 'Everyone registered';
    setDays((list) => [{ key: `${now}-${list.length}`, label: dayLabel, items }, ...list].slice(0, MAX_DAYS));
  }, [results, asOf, index, data.divisions]);

  return (
    <section className="card adm-stack" aria-labelledby="feed-title">
      <div className="adm-spread">
        <h2 id="feed-title" style={{ margin: 0, fontSize: 18 }}>
          What changed
        </h2>
        {days.length > 0 && (
          <button type="button" className="adm-btn" onClick={() => setDays([])}>
            Clear
          </button>
        )}
      </div>
      {days.length === 0 ? (
        <p className="muted adm-small" style={{ margin: 0 }}>
          Press Play above (or drag the date forward) to watch registrations arrive. Each day lists who registered and where they were
          placed, anyone the engine moved to make room and why, and new flags.
        </p>
      ) : (
        <div aria-live="polite" className="feed">
          {days.map((d) => (
            <div key={d.key} className="feed-day">
              <h3 className="adm-small" style={{ margin: '8px 0 4px' }}>
                {d.label}
              </h3>
              <ul className="adm-small" style={{ margin: 0, paddingLeft: 18 }}>
                {d.items.slice(0, MAX_ITEMS_PER_DAY).map((it, i) => (
                  <li key={i}>
                    <span className={`badge ${it.kind === 'flag' ? (it.severity ?? 'warning') : it.kind === 'moved' ? 'warning' : 'good'}`}>
                      {it.kind === 'new' ? 'new' : it.kind === 'moved' ? 'moved' : it.severity}
                    </span>{' '}
                    {it.text}
                  </li>
                ))}
                {d.items.length > MAX_ITEMS_PER_DAY && <li className="muted">…and {d.items.length - MAX_ITEMS_PER_DAY} more</li>}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
