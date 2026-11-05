'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatDate } from '@bvac/core';
import { useSeason } from '@/lib/season-store';
import { dateRange, endOfDay } from './model';

/** The demo's "As of" window: early registration opens Jan 4; rosters are nearly final Mar 17. */
export const AS_OF_START = '2027-01-04';
export const AS_OF_END = '2027-03-17';
const STEP_MS = 450;

/**
 * Shows the season on any date between Jan 4 and Mar 17, so admins can watch
 * teams fill up. The end of the range means "everyone registered so far".
 */
export function AsOfControl() {
  const { asOf, setAsOf, data } = useSeason();
  const days = useMemo(() => dateRange(AS_OF_START, AS_OF_END), []);
  const [playing, setPlaying] = useState(false);
  const current = asOf ? asOf.slice(0, 10) : AS_OF_END;
  const i = Math.max(0, days.indexOf(current));

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      const next = days[i + 1];
      if (!next || next === AS_OF_END) {
        setAsOf(null);
        setPlaying(false);
      } else setAsOf(endOfDay(next));
    }, STEP_MS);
    return () => window.clearTimeout(timer);
  }, [playing, i, days, setAsOf]);

  const s = data.season;
  const phase =
    current < s.windows.early.start
      ? 'Before registration'
      : current <= s.windows.early.end
        ? 'Early registration'
        : current < s.windows.regular.start
          ? current >= s.round1Publish
            ? 'Round 1 published'
            : 'Between windows'
          : current <= s.windows.regular.end
            ? 'Regular registration'
            : 'Late registration';

  return (
    <section className="card adm-stack adm-asof" aria-labelledby="asof-title">
      <div className="adm-spread">
        <h2 id="asof-title" style={{ margin: 0 }}>
          As of {formatDate(current)}
          {!asOf && <span className="muted"> · everyone registered</span>}
        </h2>
        <span className="badge" title="Where the season is on this date">
          Season: {phase.toLowerCase()}
        </span>
      </div>
      <p className="muted adm-small" style={{ margin: 0 }}>
        Every admin page shows the season as it stood on this date. Press Play to watch sign-ups arrive day by day, or drag the slider.
      </p>
      <div className="adm-row">
        <button
          type="button"
          className="button small"
          onClick={() => {
            if (playing) setPlaying(false);
            else {
              if (!asOf) setAsOf(endOfDay(AS_OF_START));
              setPlaying(true);
            }
          }}
          aria-pressed={playing}
        >
          {playing ? 'Pause' : asOf ? 'Play' : 'Play from Jan 4'}
        </button>
        <label htmlFor="asof-range" className="adm-sr">
          Show the season as of
        </label>
        <input
          id="asof-range"
          type="range"
          min={0}
          max={days.length - 1}
          value={i}
          aria-valuetext={formatDate(current)}
          onChange={(e) => {
            setPlaying(false);
            const d = days[Number(e.target.value)]!;
            setAsOf(d === AS_OF_END ? null : endOfDay(d));
          }}
        />
        <button type="button" className="adm-btn" disabled={!asOf} onClick={() => (setPlaying(false), setAsOf(null))}>
          Show everyone
        </button>
      </div>
      <p className="muted adm-small" style={{ margin: 0 }}>
        Early registration {formatDate(s.windows.early.start)}–{formatDate(s.windows.early.end)} · Round 1 publishes {formatDate(s.round1Publish)} ·
        Regular {formatDate(s.windows.regular.start)}–{formatDate(s.windows.regular.end)} · Round 2 publishes {formatDate(s.round2Publish)}
      </p>
    </section>
  );
}
