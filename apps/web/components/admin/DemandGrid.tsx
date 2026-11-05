'use client';

import { useState } from 'react';
import { dayShort, formatTime } from '@bvac/core';
import { useSeason } from '@/lib/season-store';
import { GRID_DAYS, demandGrid, sortedDivisions } from './model';

/**
 * Day × time demand: how many families can make each half hour, against how
 * many team options practice then. Dashed cells have families but no team.
 */
export function DemandGrid() {
  const { index, asOf } = useSeason();
  const divisions = sortedDivisions(index);
  const [divisionId, setDivisionId] = useState<string>('all');
  const ids = divisionId === 'all' ? divisions.map((d) => d.id) : [divisionId];
  const { bands, cells } = demandGrid(index, ids, asOf);
  const maxFamilies = Math.max(1, ...cells.map((c) => c.families));
  const cell = (day: string, start: number) => cells.find((c) => c.day === day && c.start === start)!;

  return (
    <section className="card adm-stack" aria-labelledby="demand-title">
      <div className="adm-spread">
        <h2 id="demand-title" style={{ margin: 0 }}>
          Practice demand
        </h2>
        <div className="adm-pills" role="group" aria-label="Division for demand grid">
          <button type="button" aria-pressed={divisionId === 'all'} onClick={() => setDivisionId('all')}>
            All
          </button>
          {divisions.map((d) => (
            <button key={d.id} type="button" aria-pressed={divisionId === d.id} onClick={() => setDivisionId(d.id)}>
              {d.code}
            </button>
          ))}
        </div>
      </div>
      <p className="muted adm-small" style={{ margin: 0 }}>
        Each cell: families who can make that whole half hour · team options practicing then. Darker means more families. A dashed cell has
        families but no team.
      </p>
      <div className="table-wrap" tabIndex={0}>
        <table className="adm-grid-table">
          <thead>
            <tr>
              <th scope="col">Time</th>
              {GRID_DAYS.map((d) => (
                <th key={d} scope="col">
                  {dayShort(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bands.map(([start]) => (
              <tr key={start}>
                <th scope="row">{formatTime(start)}</th>
                {GRID_DAYS.map((day) => {
                  const c = cell(day, start);
                  const share = c.families / maxFamilies;
                  const none = c.families > 0 && c.teams === 0;
                  return (
                    <td key={day}>
                      <div
                        className={`adm-cell${none ? ' none' : ''}`}
                        style={{ background: `color-mix(in srgb, var(--color-primary) ${Math.round(share * 45)}%, transparent)` }}
                        title={`${dayShort(day)} ${formatTime(c.start)}–${formatTime(c.end)}: ${c.families} families available, ${c.teams} team options`}
                      >
                        <b>{c.families}</b>
                        <div className="muted">{c.teams === 0 ? 'no team' : `${c.teams} team${c.teams === 1 ? '' : 's'}`}</div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
