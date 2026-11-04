/**
 * Team-specific priority points (docs/DESIGN.md "Placement engine", step 4).
 *
 * Points are per team: a returning player has extra priority on *their
 * coach's* team, not on every team. "Sibling already on this team" means a
 * sibling who is locked onto the team before placement runs (coach's child,
 * protected pick, admin lock or an earlier published round). That keeps
 * priorities fixed during deferred acceptance, which is what makes the result
 * stable and explainable.
 */
import type { DivisionSettings, ID, PlacementReason, PriorityPoints, Registration, SeasonIndex, Team } from '@bvac/core';

export interface PriorityFacts {
  earlyWindow: boolean;
  playedLastSeason: boolean;
  priorSeasons: number;
  /** Last-season coach is this team's head coach. */
  playedForCoachLastSeason: boolean;
  seasonsWithCoach: number;
  siblingOnTeam: boolean;
  coachName: string;
}

export interface PriorityResult {
  points: number;
  reasons: PlacementReason[];
}

export function scorePriority(p: PriorityPoints, f: PriorityFacts): PriorityResult {
  const reasons: PlacementReason[] = [];
  let points = 0;
  const add = (n: number, text: string) => {
    if (n <= 0) return;
    points += n;
    reasons.push({ code: 'priority', text, points: n });
  };
  if (f.earlyWindow) add(p.earlyWindow, 'Early registration');
  if (f.playedForCoachLastSeason) add(p.playedForCoachLastSeason, `Played for ${f.coachName} last season`);
  if (f.playedLastSeason) add(p.playedLastSeason, 'Played BVAC last season');
  if (f.siblingOnTeam) add(p.siblingOnTeam, 'Sibling already on this team');
  if (f.priorSeasons > 0) {
    const n = Math.min(p.perPriorSeasonCap, p.perPriorSeason * f.priorSeasons);
    add(n, `${f.priorSeasons} BVAC season${f.priorSeasons === 1 ? '' : 's'}`);
  }
  if (f.seasonsWithCoach > 0) {
    const n = Math.min(p.perSeasonWithCoachCap, p.perSeasonWithCoach * f.seasonsWithCoach);
    add(n, `${f.seasonsWithCoach} season${f.seasonsWithCoach === 1 ? '' : 's'} with ${f.coachName}`);
  }
  return { points, reasons };
}

/**
 * Public helper for the UI: why would this registration rank where it does on
 * this team? `siblingTeamIds` lists teams where a sibling is already locked.
 */
export function priorityFor(
  index: SeasonIndex,
  registration: Registration,
  team: Team,
  options: { settings?: DivisionSettings; siblingTeamIds?: readonly ID[] } = {},
): PriorityResult {
  const division = index.division.get(registration.divisionId);
  const settings = options.settings ?? division?.settings;
  if (!settings) throw new Error(`Unknown division ${registration.divisionId}`);
  const history = index.historyByPlayer.get(registration.playerId) ?? [];
  const coachId = index.coachesByTeam.get(team.id)?.find((c) => c.role === 'head')?.personId;
  const coach = coachId ? index.person.get(coachId) : undefined;
  const last = history.find((h) => h.seasonOrder === index.lastSeasonOrder);
  return scorePriority(settings.priority, {
    earlyWindow: registration.window === 'early',
    playedLastSeason: !!last,
    priorSeasons: history.length,
    playedForCoachLastSeason: !!coachId && last?.coachPersonId === coachId,
    seasonsWithCoach: coachId ? history.filter((h) => h.coachPersonId === coachId).length : 0,
    siblingOnTeam: options.siblingTeamIds?.includes(team.id) ?? false,
    coachName: coach ? `Coach ${coach.lastName}` : 'this coach',
  });
}
