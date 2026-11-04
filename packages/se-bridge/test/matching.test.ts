import { describe, expect, it } from 'vitest';
import { NICKNAMES } from '../../seed/src/names';
import { matchRequest, nameVariants, parseTypedName, type MatchCandidate } from '../src';

const kid = (id: string, firstName: string, lastName: string, divisionId: string | undefined, householdId = `hh_${id}`, nickname?: string): MatchCandidate => ({
  player: { id, firstName, lastName, householdId, ...(nickname ? { nickname } : {}) },
  divisionId,
});

const pool: MatchCandidate[] = [
  kid('p_ava_martinez', 'Ava', 'Martinez', 'D3'),
  kid('p_ava_miller', 'Ava', 'Miller', 'D3'),
  kid('p_jacob_morris', 'Jacob', 'Morris', 'D3'),
  kid('p_eleanor_brown', 'Eleanor', 'Brown', 'D3', 'hh_e', 'Ellie'),
  kid('p_axel_richardson', 'Axel', 'Richardson', 'D3'),
  kid('p_liam_lee', 'Liam', 'Lee', 'D3'),
  kid('p_noah_lee', 'Noah', 'Lee', 'D3'),
  kid('p_ava_martinez_d4', 'Ava', 'Martinez', 'D4'),
  kid('p_mia_ortiz_d5', 'Mia', 'Ortiz', 'D5'),
  kid('p_sam_lee_sib', 'Samuel', 'Lee', 'D5', 'hh_me'),
  kid('p_me', 'Liam', 'Lee', 'D3', 'hh_me'),
];

const ctx = { pool, requesterId: 'p_me', requesterHouseholdId: 'hh_me', divisionId: 'D3' };
const friend = (typed: string) => matchRequest(typed, 'friend', ctx);

describe('matchRequest', () => {
  it('matches an exact full name, ignoring case and punctuation', () => {
    expect(friend('ava  MARTINEZ.')).toEqual({ status: 'matched', targetPlayerId: 'p_ava_martinez', how: 'exact' });
    expect(friend('Martinez, Ava')).toMatchObject({ status: 'matched', targetPlayerId: 'p_ava_martinez' });
  });

  it('looks in the same division first', () => {
    // An Ava Martinez is in D4 too; the D3 one wins.
    expect(friend('Ava Martinez').targetPlayerId).toBe('p_ava_martinez');
    // Someone only in another division is still found.
    expect(friend('Mia Ortiz')).toMatchObject({ status: 'matched', targetPlayerId: 'p_mia_ortiz_d5' });
  });

  it('matches nicknames from the table and the player record', () => {
    expect(friend('Jake Morris')).toEqual({ status: 'matched', targetPlayerId: 'p_jacob_morris', how: 'nickname' });
    expect(friend('Ellie Brown')).toEqual({ status: 'matched', targetPlayerId: 'p_eleanor_brown', how: 'exact' });
  });

  it('matches "First L." initials', () => {
    expect(friend('Jacob M.')).toEqual({ status: 'matched', targetPlayerId: 'p_jacob_morris', how: 'initial' });
    expect(friend('Jake M')).toEqual({ status: 'matched', targetPlayerId: 'p_jacob_morris', how: 'initialNickname' });
  });

  it('matches typos within edit distance 2', () => {
    expect(friend('Axel Richardsn')).toEqual({ status: 'matched', targetPlayerId: 'p_axel_richardson', how: 'typo' });
    expect(friend('Eleanor Bron')).toMatchObject({ status: 'matched', targetPlayerId: 'p_eleanor_brown' });
    expect(friend('Axl Richardsun')).toMatchObject({ status: 'matched', targetPlayerId: 'p_axel_richardson' });
    expect(friend('Axel Rchrdsn').status).toBe('unmatched');
  });

  it('reports ambiguous names with their candidates', () => {
    expect(friend('Ava M.')).toEqual({ status: 'ambiguous', candidatePlayerIds: ['p_ava_martinez', 'p_ava_miller'], how: 'initial' });
    expect(friend('Ava')).toEqual({ status: 'ambiguous', candidatePlayerIds: ['p_ava_martinez', 'p_ava_miller'], how: 'firstName' });
  });

  it('reports names nobody registered as unmatched', () => {
    expect(friend('Jordan Pike')).toEqual({ status: 'unmatched' });
    expect(friend('')).toEqual({ status: 'unmatched' });
    expect(friend('???')).toEqual({ status: 'unmatched' });
  });

  it('never matches the requester to themselves', () => {
    // The requester is also "Liam Lee"; only the other Liam Lee matches.
    expect(friend('Liam Lee')).toMatchObject({ status: 'matched', targetPlayerId: 'p_liam_lee' });
  });

  it('looks in the household first for siblings', () => {
    expect(matchRequest('Sam Lee', 'sibling', ctx)).toMatchObject({ status: 'matched', targetPlayerId: 'p_sam_lee_sib' });
  });

  it('is deterministic regardless of pool order', () => {
    const reversed = { ...ctx, pool: [...pool].reverse() };
    for (const typed of ['Ava M.', 'Ava', 'Jake Morris', 'Axel Richardsn', 'Lee']) {
      expect(matchRequest(typed, 'friend', reversed)).toEqual(friend(typed));
    }
  });
});

describe('parseTypedName', () => {
  it('splits first and last names and spots initials', () => {
    expect(parseTypedName('Jake M.')).toEqual({ first: 'jake', last: 'm', initial: true });
    expect(parseTypedName("Liam O'Brien-Lee Jr.")).toEqual({ first: 'liam', last: 'obrienlee', initial: false });
    expect(parseTypedName('Ava (cousin)')).toEqual({ first: 'ava', last: '', initial: false });
  });
});

describe('nickname table', () => {
  it("covers every nickname in the seed's NICKNAMES", () => {
    for (const [formal, nick] of Object.entries(NICKNAMES)) {
      expect(nameVariants(nick.toLowerCase()).has(formal.toLowerCase()), `${nick} -> ${formal}`).toBe(true);
    }
  });
});
