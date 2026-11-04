import type { DivisionSettings, Factor, Grade, PriorityPoints, TeamSize } from './types';
import { FACTORS } from './types';

/** Defaults from docs/DESIGN.md "Placement engine", step 4. */
export const DEFAULT_PRIORITY_POINTS: PriorityPoints = {
  earlyWindow: 30,
  playedForCoachLastSeason: 25,
  playedLastSeason: 20,
  siblingOnTeam: 20,
  perPriorSeason: 5,
  perPriorSeasonCap: 25,
  perSeasonWithCoach: 5,
  perSeasonWithCoachCap: 15,
};

/** BVAC's factor weights W (practice time 40, coach 25, friends 20, last team 15). */
export const DEFAULT_FACTOR_WEIGHTS: Record<Factor, number> = {
  practiceTime: 40,
  coach: 25,
  friends: 20,
  lastTeam: 15,
};

/** A family's own ranking of factors: 1st = 4, 2nd = 3, 3rd = 2, 4th = 1. */
export const FACTOR_RANK_MULTIPLIERS = [4, 3, 2, 1] as const;

export function defaultDivisionSettings(teamSize: TeamSize, overrides: Partial<DivisionSettings> = {}): DivisionSettings {
  return {
    model: 'hybrid',
    placementMethod: 'priorityFirst',
    teamSize,
    coachProtectedPicks: 2,
    keepSiblingsTogether: true,
    maxPlayerRequests: 2,
    factorWeights: { ...DEFAULT_FACTOR_WEIGHTS },
    priority: { ...DEFAULT_PRIORITY_POINTS },
    round1Fill: 'preferred',
    showCoachNames: true,
    showProjectedToFamilies: false,
    gameTimeStyle: 'anchored',
    practicesPerWeek: 1,
    ...overrides,
  };
}

/**
 * The multiplier `a` for one factor given a family's ranking.
 * Factors the family left out count as least important (1).
 */
export function factorMultiplier(ranking: readonly Factor[], factor: Factor): number {
  const index = ranking.indexOf(factor);
  if (index < 0) return FACTOR_RANK_MULTIPLIERS[FACTOR_RANK_MULTIPLIERS.length - 1]!;
  return FACTOR_RANK_MULTIPLIERS[Math.min(index, FACTOR_RANK_MULTIPLIERS.length - 1)]!;
}

/** A complete ranking: the family's order, then any missing factors in default order. */
export function completeFactorRanking(ranking: readonly Factor[]): Factor[] {
  const seen = new Set<Factor>();
  const out: Factor[] = [];
  for (const f of [...ranking, ...FACTORS]) {
    if (!seen.has(f)) {
      seen.add(f);
      out.push(f);
    }
  }
  return out;
}

/** -2 -> "Age 3", -1 -> "Age 4", 0 -> "K", 1 -> "1st", 2 -> "2nd" ... */
export function gradeLabel(grade: Grade): string {
  if (grade === -2) return 'Age 3';
  if (grade === -1) return 'Age 4';
  if (grade === 0) return 'K';
  const suffix = grade % 10 === 1 && grade !== 11 ? 'st' : grade % 10 === 2 && grade !== 12 ? 'nd' : grade % 10 === 3 && grade !== 13 ? 'rd' : 'th';
  return `${grade}${suffix}`;
}

export const FACTOR_LABELS: Record<Factor, string> = {
  practiceTime: 'Practice time',
  coach: 'Coach',
  friends: 'Playing with friends',
  lastTeam: "Staying with last season's team",
};
