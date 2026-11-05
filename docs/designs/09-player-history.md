# Player history (seniority)

How past seasons get into the tool, so returning players and "played for this coach" priority work from real records.

**Status:**
- **Built:**
  - the engine uses `PlayerHistory` (season, division, team, coach) for seniority points;
  - the sample season ships with generated history;
  - the SportsEngine importer reads two self-reported answers, "Seasons played at BVAC" and "Last season's coach", but returns them only as `selfReported` on the import result. Nothing stores them yet (`packages/se-bridge/README.md`).
- **Not built:** importing real past rosters, and storing self-reported seniority.

**Recommendation, ranked:**
1. **Import whatever past rosters BVAC has** (SportsEngine roster exports or spreadsheets) for the last 2–3 seasons, with an admin review screen.
2. **Fall back to self-reported answers** for players with no record, marked "self-reported" on the kid card.
3. **After the first live season, history is automatic:** publishing writes `player_history`.

## Why it matters

Priority points for seasons played and "played for this coach last season" are a large part of BVAC's rules (`DivisionSettings.priority`). Without history:
- every returning player looks new;
- coach continuity disappears;
- placements would look wrong to families who've played for years.

That's the first thing BVAC admins would notice.

## Sources, ranked

| Rank | Source | Quality | Notes |
| --- | --- | --- | --- |
| 1 | SportsEngine roster exports from past seasons (team rosters with player name and birthdate) | Good | Ask whether BVAC can export past seasons' rosters from SportsEngine. Names plus birthdates match well. |
| 2 | BVAC's own spreadsheets from hand-built rosters | Varies | Often names only, with nicknames and typos. Needs fuzzy matching and admin review. |
| 3 | Self-reported on the registration form ("Seasons played", "Last season's coach") | Fair | Already in the question pack and parsed by the importer. Families round up; admins spot-check. |
| 4 | Nothing: everyone starts at zero | — | Only acceptable for a division with no seniority rules (Division 1, first come, first served). |

## Recommended design

### History import (Admin → Import → "Past rosters")

1. **Upload one CSV per past season**, or one file with a Season column. Map columns:
   - required: player first name, last name and team;
   - optional: birthdate, division and coach name.

   This is the same mapping UI as the registration import.
2. **Match each row to a current player** using the bridge's existing matcher (`matchRequest`: full name, nickname, "First L.", then typos with edit distance ≤ 2). Birthdate, when present, makes a match certain.
3. **Review screen**, with three groups:
   - **Matched** (accept all);
   - **Probably** ("Maddie Smith, 2nd grade? 1 candidate");
   - **Not found**: past players not registered this season, which is normal. Store them anyway, so they match if they register later.
4. **Coaches:** match the coach column to `people` by name, or create a coach person record with no email. "Played for this coach" needs a stable coach id across seasons.
5. **Save** to `player_history` with `source: 'import'` and the file name, so a bad import can be removed as a batch.

### Self-reported seniority

- Store the importer's `selfReported` values as `player_history` rows with `source: 'self-reported'` and a season label of "Self-reported".
- Imported records win over self-reported ones for the same player.
- The kid card shows "3 BVAC seasons (self-reported)" so admins know which to check.

### Automatic history

- When a season's rosters are final (all rounds published), a "Close season" action writes one `player_history` row per published player: season, division, team and head coach.
- That's the only maintenance needed after the first live season. DESIGN.md: "A player and household persist across seasons, which is what makes seniority automatic after the first season".

### Data change

`PlayerHistory` gains `source: 'import' | 'self-reported' | 'automatic'` and an optional `batchId`. This is a deliberate change to `packages/core/src/types.ts`; the engine ignores both new fields.

## Effort (rough)

| Piece | Days |
| --- | --- |
| History import: mapping, matching, review screen | 3–4 |
| Store self-reported values, show "(self-reported)" | 1 |
| "Close season" writes history | 1 |
| **Total** | **about 1 week.** Works in single-admin mode too (stored in the backup file), so it can come before the backend. |

## Open questions for BVAC

1. What past roster records exist, and in what form? How many seasons back?
2. Should self-reported seniority count fully, count at half weight, or be ignored until verified? Recommended: count fully, flag for spot-checks.
