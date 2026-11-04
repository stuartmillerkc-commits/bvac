/**
 * Matching a typed player request ("Jake M.") to a registered player.
 */
import { compareStrings, type ID, type Player, type PlayerRequestType, type RequestMatchStatus } from '@bvac/core';
import { nameVariants } from './nicknames';
import { editDistance, nameKey, normalize } from './text';

/** Most candidates kept on an ambiguous match. */
export const MAX_CANDIDATES = 5;
/** Largest edit distance (first + last name) that still counts as a typo. */
export const MAX_TYPO_DISTANCE = 2;

export interface MatchCandidate {
  player: Pick<Player, 'id' | 'firstName' | 'lastName' | 'nickname' | 'householdId'>;
  divisionId: ID | undefined;
}

export interface MatchContext {
  /** Everyone a request could name. */
  pool: readonly MatchCandidate[];
  /** The player making the request (never matched to themselves). */
  requesterId: ID;
  requesterHouseholdId: ID;
  divisionId: ID | undefined;
}

export interface MatchResult {
  status: Exclude<RequestMatchStatus, 'confirmed'>;
  targetPlayerId?: ID;
  candidatePlayerIds?: ID[];
  /** How the match was found, for import notes ("nickname", "typo"...). */
  how?: MatchHow;
}

export type MatchHow = 'exact' | 'nickname' | 'initial' | 'initialNickname' | 'firstName' | 'firstNameNickname' | 'typo';

export interface TypedName {
  first: string;
  /** Empty when only a first name was typed. */
  last: string;
  /** True when the last name is one letter ("Ava M."). */
  initial: boolean;
}

/** "Jake M." -> {first: 'jake', last: 'm', initial: true}; "Miller, Jake" -> jake / miller. */
export function parseTypedName(typed: string): TypedName | undefined {
  let text = typed.trim();
  // Drop notes in brackets: "Ava Smith (cousin)".
  text = text.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ');
  const comma = text.split(',');
  if (comma.length === 2 && comma[0]!.trim() && comma[1]!.trim()) text = `${comma[1]} ${comma[0]}`;
  const tokens = normalize(text)
    .split(' ')
    .filter((t) => t && !/^(jr|sr|ii|iii|iv)$/.test(t));
  if (tokens.length === 0) return undefined;
  const first = nameKey(tokens[0]!);
  const lastTokens = tokens.slice(1);
  const last = nameKey(lastTokens.join(''));
  if (!first) return undefined;
  return { first, last, initial: last.length === 1 };
}

function firstForms(p: MatchCandidate['player']): string[] {
  return [nameKey(p.firstName), ...(p.nickname ? [nameKey(p.nickname)] : [])];
}

/** The typed first name is a known nickname of the player's name, or the other way round. */
function nicknameMatch(typedFirst: string, p: MatchCandidate['player']): boolean {
  const typed = nameVariants(typedFirst);
  return firstForms(p).some((f) => typed.has(f) || nameVariants(f).has(typedFirst));
}

type Tier = (n: TypedName, p: MatchCandidate['player']) => boolean;

const TIERS: Record<MatchHow, Tier> = {
  exact: (n, p) => !n.initial && n.last !== '' && firstForms(p).includes(n.first) && nameKey(p.lastName) === n.last,
  nickname: (n, p) => !n.initial && n.last !== '' && nameKey(p.lastName) === n.last && nicknameMatch(n.first, p),
  initial: (n, p) => n.initial && nameKey(p.lastName).startsWith(n.last) && firstForms(p).includes(n.first),
  initialNickname: (n, p) => n.initial && nameKey(p.lastName).startsWith(n.last) && nicknameMatch(n.first, p),
  firstName: (n, p) => n.last === '' && firstForms(p).includes(n.first),
  firstNameNickname: (n, p) => n.last === '' && nicknameMatch(n.first, p),
  typo: (n, p) => {
    if (n.initial || n.last === '') return false;
    const last = nameKey(p.lastName);
    const lastDist = editDistance(n.last, last, MAX_TYPO_DISTANCE);
    if (lastDist > MAX_TYPO_DISTANCE) return false;
    const firstDist = nicknameMatch(n.first, p)
      ? 0
      : Math.min(...firstForms(p).map((f) => editDistance(n.first, f, MAX_TYPO_DISTANCE)));
    if (firstDist + lastDist > MAX_TYPO_DISTANCE) return false;
    // Short names are too easy to confuse: "Ava Lee" vs "Eva Lee" needs both names long enough.
    return Math.min(n.first.length, last.length) >= 3 || firstDist + lastDist === 0;
  },
};

/**
 * Match a typed name. Search order, stopping at the first step with any
 * candidate: siblings look in their own household first; then the requester's
 * division (full name, nickname + last name, "First L.", first name only,
 * each as typed before trying nicknames); then every division (the same but
 * no first-name-only); then typos (edit distance <= 2), division first. One
 * candidate is a match; several are ambiguous.
 */
export function matchRequest(typed: string, type: PlayerRequestType, ctx: MatchContext): MatchResult {
  const name = parseTypedName(typed);
  if (!name) return { status: 'unmatched' };
  const others = ctx.pool.filter((c) => c.player.id !== ctx.requesterId);
  const household = others.filter((c) => c.player.householdId === ctx.requesterHouseholdId);
  const division = ctx.divisionId ? others.filter((c) => c.divisionId === ctx.divisionId) : [];
  const strong: MatchHow[] = ['exact', 'nickname', 'initial', 'initialNickname', 'firstName', 'firstNameNickname'];
  const steps: [readonly MatchCandidate[], MatchHow[]][] = [
    ...(type === 'sibling' ? [[household, [...strong, 'typo']] as [MatchCandidate[], MatchHow[]]] : []),
    [division, strong],
    [others, ['exact', 'nickname', 'initial', 'initialNickname']],
    [division, ['typo']],
    [others, ['typo']],
  ];
  for (const [scope, tiers] of steps) {
    for (const how of tiers) {
      const hits = scope.filter((c) => TIERS[how](name, c.player)).map((c) => c.player.id);
      const ids = [...new Set(hits)].sort(compareStrings);
      if (ids.length === 1) return { status: 'matched', targetPlayerId: ids[0]!, how };
      if (ids.length > 1) return { status: 'ambiguous', candidatePlayerIds: ids.slice(0, MAX_CANDIDATES), how };
    }
  }
  return { status: 'unmatched' };
}
