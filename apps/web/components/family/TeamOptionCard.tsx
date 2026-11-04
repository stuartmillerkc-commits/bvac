'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatWindow, type Division, type Team } from '@bvac/core';
import { GameList } from '@/components/GameList';
import { useSeason } from '@/lib/season-store';
import { coachName, isFirstComeFirstServed, seatInfo } from './helpers';
import { SeatChip } from './SeatChip';
import { GAMES_TBA } from './useTrackDescriptions';
import s from './family.module.css';

export function TeamOptionCard({
  team,
  division,
  gamePattern,
  dimmed,
  extra,
}: {
  team: Team;
  division: Division;
  gamePattern?: string | undefined;
  dimmed?: boolean;
  extra?: ReactNode;
}) {
  const { index, results } = useSeason();
  const slot = index.practiceSlot.get(team.practiceSlotId);
  const field = slot ? index.field.get(slot.fieldId) : undefined;
  const coach = division.settings.showCoachNames ? coachName(index, team) : undefined;
  const info = seatInfo(index, results, team);
  const headingId = `team-${team.id}`;
  return (
    <article className={`card ${s.teamCard} ${dimmed ? s.dimmed : ''}`} aria-labelledby={headingId}>
      <div className={s.teamHead}>
        <h3 id={headingId}>
          {team.label}
          {team.name ? <span className="muted"> · {team.name}</span> : null}
        </h3>
        <SeatChip info={info} fcfs={isFirstComeFirstServed(division)} />
      </div>
      <dl className={s.facts}>
        <dt>Practice</dt>
        <dd>{slot ? `${formatWindow(slot.window)}, weekly` : 'To be set'}</dd>
        <dt>Field</dt>
        <dd>{field ? `${field.name}, ${field.park}` : 'To be set'}</dd>
        <dt>Games</dt>
        <dd>Saturdays · {gamePattern || GAMES_TBA}</dd>
        {coach ? (
          <>
            <dt>Coach</dt>
            <dd>{coach}</dd>
          </>
        ) : null}
      </dl>
      <GameList gameTrackId={team.gameTrackId} summary="See every game" />
      {extra}
      <div>
        <Link
          className="button"
          href={`/register/?division=${division.code}&first=${team.id}`}
          aria-label={`Register for ${team.label}${slot ? `, ${formatWindow(slot.window)}` : ''}`}
        >
          Register for this team
        </Link>
      </div>
    </article>
  );
}
