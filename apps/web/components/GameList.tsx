'use client';

import { useMemo } from 'react';
import { compareStrings, formatDate, formatTime, type ID } from '@bvac/core';
import { useSeason } from '@/lib/season-store';

export interface TeamGame {
  id: ID;
  date: string;
  start: number;
  field: string;
  opponent: string;
  home: boolean;
  isMakeup: boolean;
}

/** Games for one schedule position, with the opponent's team label when it has one. */
export function useTeamGames(gameTrackId: ID | undefined): TeamGame[] {
  const { data, games, index } = useSeason();
  return useMemo(() => {
    if (!gameTrackId) return [];
    const slots = new Map(data.gameSlots.map((g) => [g.id, g]));
    const teamByTrack = new Map(data.teams.filter((t) => t.gameTrackId && t.status !== 'cancelled').map((t) => [t.gameTrackId!, t]));
    const out: TeamGame[] = [];
    for (const g of games) {
      if (g.homeTrackId !== gameTrackId && g.awayTrackId !== gameTrackId) continue;
      const slot = slots.get(g.gameSlotId);
      if (!slot) continue;
      const home = g.homeTrackId === gameTrackId;
      const otherTrack = home ? g.awayTrackId : g.homeTrackId;
      const other = teamByTrack.get(otherTrack);
      out.push({
        id: g.id,
        date: slot.date,
        start: slot.start,
        field: index.field.get(slot.fieldId)?.name ?? '',
        opponent: other ? other.label : `Team ${index.gameTrack.get(otherTrack)?.position ?? '?'}`,
        home,
        isMakeup: slot.isMakeup,
      });
    }
    return out.sort((a, b) => compareStrings(a.date, b.date) || a.start - b.start);
  }, [data, games, index, gameTrackId]);
}

/** A compact, collapsible list of a team's games. */
export function GameList({ gameTrackId, summary = 'Game schedule', open = false }: { gameTrackId: ID | undefined; summary?: string; open?: boolean }) {
  const list = useTeamGames(gameTrackId);
  if (list.length === 0) return null;
  return (
    <details className="game-list" open={open}>
      <summary>
        {summary} <span className="muted">({list.length} games)</span>
      </summary>
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
          {list.map((g) => (
            <tr key={g.id}>
              <td>{formatDate(g.date)}</td>
              <td>{formatTime(g.start)}</td>
              <td>{g.field}</td>
              <td>
                {g.home ? 'vs' : 'at'} {g.opponent}
                {g.isMakeup ? <span className="muted"> (makeup)</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
