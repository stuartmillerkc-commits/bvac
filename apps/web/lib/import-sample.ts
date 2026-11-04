/**
 * Sample SportsEngine files for the admin Import page.
 *
 * - `newArrivalsCsv`: eight made-up families who registered in SportsEngine
 *   after the last import, plus deliberate messes (a nickname friend request,
 *   a team answer the importer can't read, an unknown request type) so the
 *   import report has something to show.
 *
 * Both are built in the browser from the seed, so they're deterministic and
 * contain only fictional people.
 */
import { compareStrings, type ID, type SeasonData } from '@bvac/core';
import { parseCsvRecords, recordsToCsv, sampleSportsEngineExport } from '@bvac/se-bridge';
import { generateSeason } from '@bvac/seed';

const ARRIVAL_COUNT = 8;
const ARRIVAL_SEED = 4242;

export function newArrivalsCsv(base: SeasonData): string {
  const other = generateSeason({ seed: ARRIVAL_SEED });
  const divisionByCode = new Map(base.divisions.map((d) => [d.code, d]));
  const otherDivisionCode = new Map(other.divisions.map((d) => [d.id, d.code]));
  const baseTeam = (otherTeamId: ID) => {
    const t = other.teams.find((x) => x.id === otherTeamId);
    const code = t ? otherDivisionCode.get(t.divisionId) : undefined;
    const division = code ? divisionByCode.get(code) : undefined;
    return division && t ? base.teams.find((x) => x.divisionId === division.id && x.label === t.label) : undefined;
  };

  // Regular-window registrations with no history, from a different random season.
  const picks = other.registrations
    .filter((r) => r.window === 'regular' && r.requests.every((q) => q.type === 'friend') && !other.playerHistory.some((h) => h.playerId === r.playerId))
    .sort((a, b) => compareStrings(a.id, b.id))
    .slice(0, ARRIVAL_COUNT);

  const re = (id: ID) => `x${id}`;
  const usedPlayers = new Set(picks.map((r) => r.playerId));
  const players = other.players.filter((p) => usedPlayers.has(p.id));
  const householdIds = new Set(players.map((p) => p.householdId));
  const households = other.households.filter((h) => householdIds.has(h.id));
  const guardianIds = new Set(households.flatMap((h) => h.guardianIds));
  const people = other.people.filter((p) => guardianIds.has(p.id));

  // Friend requests name real kids already in the demo season, typed the way parents type.
  const baseKids = (divisionId: ID) =>
    base.registrations
      .filter((r) => r.divisionId === divisionId)
      .map((r) => base.players.find((p) => p.id === r.playerId)!)
      .sort((a, b) => compareStrings(a.id, b.id));

  const registrations = picks.map((r, i) => {
    const code = otherDivisionCode.get(r.divisionId)!;
    const division = divisionByCode.get(code)!;
    const kids = baseKids(division.id);
    const friend = kids[(i * 7) % Math.max(1, kids.length)];
    const typed = !friend ? '' : i % 3 === 0 ? `${friend.nickname ?? friend.firstName} ${friend.lastName[0]}.` : `${friend.firstName} ${friend.lastName}`;
    const day = 1 + i * 2;
    return {
      ...r,
      id: re(r.id),
      seasonId: base.season.id,
      playerId: re(r.playerId),
      divisionId: division.id,
      submittedAt: `2027-03-${String(day).padStart(2, '0')}T19:${String(10 + i).padStart(2, '0')}:00-06:00`,
      externalId: `SE-2${String(10000 + i * 37).padStart(5, '0')}`,
      choices: r.choices.flatMap((c) => {
        const t = baseTeam(c.teamId);
        return t ? [{ teamId: t.id, rank: c.rank }] : [];
      }),
      coachRequest: undefined,
      requests: typed ? [{ id: re(`req_${i}`), type: 'friend' as const, targetName: typed, matchStatus: 'unmatched' as const }] : [],
    };
  });

  const temp: SeasonData = {
    ...base,
    people: [...base.people, ...people.map((p) => ({ ...p, id: re(p.id) }))],
    households: [...base.households, ...households.map((h) => ({ ...h, id: re(h.id), guardianIds: h.guardianIds.map(re) }))],
    players: [...base.players, ...players.map((p) => ({ ...p, id: re(p.id), householdId: re(p.householdId) }))],
    playerHistory: base.playerHistory,
    registrations,
  };

  const { headers, rows } = parseCsvRecords(sampleSportsEngineExport(temp));
  // Deliberate messes for the import report.
  const firstChoice = headers.find((h) => h === '1st choice team');
  const requestType = headers.find((h) => h === 'Sibling or friend? (1)');
  if (rows[1] && firstChoice) rows[1][firstChoice] = 'Option Z · Fri 9pm';
  if (rows[4] && requestType && rows[4]['Player request 1']) rows[4][requestType] = 'Cousin';
  return recordsToCsv(headers, rows);
}
