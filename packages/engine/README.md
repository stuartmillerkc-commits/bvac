# @bvac/engine

The placement engine from [docs/DESIGN.md](../../docs/DESIGN.md) "Placement engine". One call places one division:

```ts
import { placeDivision } from '@bvac/engine';
const result = placeDivision({ data, divisionId, round: 2, fixed: [] });
// result.placements (one per registration), result.flags, result.stats
```

`pnpm --filter @bvac/engine report` prints results for the sample season.

## How a run works

1. **Locks first.** `fixed` placements (admin locks, published rounds) are returned exactly as given. Coach protected picks, including coaches' own kids, are locked onto the coach's team. Locked players count against the team's seats.
2. **Scope.** Round 1 places only early-window registrations, filling teams to *preferred* size (when `round1Fill` is `preferred`). Round 2 places everyone and fills to *max*. `asOf` drops registrations submitted later.
3. **Units.** Same-division siblings become one unit, taking one seat per kid, when `keepSiblingsTogether` is on and the family didn't opt out. Siblings are the same household, or a matched sibling request. If siblings have no team in common, or the unit is bigger than a team, they're placed separately and flagged.
4. **Family order.** A unit's acceptable teams, in tiers:
   - 0: a team where a sibling is already locked;
   - 1..n: the family's ranked choices;
   - 100: other teams inside the family's days (only if they said any fitting team is OK, or ranked nothing), ordered by fit score `Σ W·a·s`;
   - 200: teams outside preferred days, when the days weren't marked required.

   Teams outside *required* days are never acceptable.
5. **Team order.** Priority points per team (`settings.priority`). "Sibling already on this team" means a sibling locked there before the run, so priorities stay fixed during placement. A unit's priority on a team is its highest-priority member's. Ties go to the earlier registration, then the id.
6. **Placement by model:**
   - `ranked`, `hybrid`, `coachSelect`: family-proposing deferred acceptance. A team holds its highest-priority applicants that fit its remaining seats. A sibling pair that needs 2 seats doesn't block a single kid from a team's last seat: the team skips units that don't fit and keeps filling in priority order. `coachSelect` returns unlocked placements as `proposed` for coach approval.
   - `fcfs`: submission order, first acceptable team with room.
7. **Friend pass**, twice. Moves and swaps that meet more matched friend requests (mutual first), only between teams in the *same tier* for every family involved. Moves only into open seats, and never creating a priority violation. Then a vacancy fill gives freed seats to whoever has priority for them.
8. **Late registrations** take leftover seats in submission order, otherwise the waitlist.
9. **`placementMethod: 'maxSatisfaction'`** starts from the priority-first result and runs a local search (moves and swaps) on total utility: choice tier + fit/10 + priority/10. It's a comparison mode and can trade priority for more first choices.

## Guarantees (tested)

- Teams never exceed the round's cap, except that locks alone can.
- Required days are never violated, except by locks.
- Fixed placements come back unchanged.
- **Stable:** no family is passed over for a lower-priority kid on a team in a tier they prefer.
- Deterministic.
- All five sample divisions run in about 30 ms.
- `maxSatisfaction` scores at least as high as priority-first on its own objective.

## Reasons and flags

Every placement carries human-readable reasons ("1st choice · Friend request met (Ava M.) · Returning with Coach Lee (+25) · Priority 65 on this team · Early registration ..."). Waitlisted kids get the reason too ("Only Wed 5–7pm work, and no Division 4 team practices then").

Flags:
- `demandExceedsCapacity`: with teams needed and the most-wanted nights;
- `teamUnderMin` / `teamOverMax`;
- `noFittingTeam`;
- `requestUnmet`: split siblings (warning) and friend requests not met (info);
- `coachRequestUnmet`.

`priorityFor(index, registration, team)` explains one kid's points on one team for the UI.
