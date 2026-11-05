# Exports and getting results back into SportsEngine

What comes out of the tool, in what format, and how teams end up in SportsEngine.

**Status:** built, on Admin → Exports (`components/admin/ExportsPage.tsx`, formats in `packages/se-bridge`):

| Export | Format | Purpose |
| --- | --- | --- |
| Teams | CSV | SportsEngine Season Management → Teams Import |
| Game and practice schedule | CSV, plus an instructions `.txt` | Season Management → Schedule Import |
| Roster list | CSV, plus a printable page | The order an admin follows in SportsEngine's drag-and-drop rostering tool |
| Question pack | Text, with a copy button | Paste into SportsEngine's Registration Builder |

CSV opens directly in Excel and Google Sheets. Column names are best guesses until a real SportsEngine import template is seen; they're all in `packages/se-bridge/src/formats.ts`.

**Not built:** a full data export (backup and "leave with everything"), putting rosters into SportsEngine automatically, and native Excel files.

**Recommendation, ranked:**
1. A full data export: needed for backups and for DESIGN.md's promise that BVAC can stop at any point with nothing lost.
2. Check the three existing CSVs against SportsEngine's real import templates.
3. Roster write-back by API, only if SportsEngine allows it.
4. Native `.xlsx` output: skip unless asked.

## 1. Full data export (recommended first)

**Why:** backups between rounds, moving off the free tier, and leaving cleanly. DESIGN.md "Rollout plan": "At each gate BVAC can stop, and the export keeps everything they put in."

**What:** one **"Download everything"** button on Admin → Exports. It produces a `.zip` with:
- `season.json`: the full `SeasonData` plus placements, snapshots, coach notes, responses and the audit log, versioned with `schemaVersion`. This file restores everything: single-admin mode loads it back ([10](10-single-admin-pilot.md)), and live mode can import it into an empty project.
- one CSV per table for people who want spreadsheets: `players.csv`, `registrations.csv` (one row per registration, answers flattened), `placements.csv` (player, division, team, state, round, top reason), `teams.csv`, `coaches.csv`.

**Zip without a dependency:** the browser can build an uncompressed (stored) zip in about 60 lines, which is fine at this size, and avoids adding a zip library. Alternative: separate downloads with no zip. Ranked second, because one file is easier to keep safe.

**Sensitive file:** it contains children's names and birthdates and guardians' contacts. Admins only. The button says "Contains family contact details. Store it somewhere private, such as BVAC's shared drive, not email." In live mode, each download is written to the audit log.

**Effort:** 2 days.

## 2. Verify the SportsEngine CSVs

The Teams and Schedule CSVs follow SportsEngine's help pages, not real templates.
- Ask a BVAC admin to download the blank templates from Season Management, or to try importing a small file into a test season.
- Fix `formats.ts` and the column snapshots.
- Note the schedule warning that's already in the instructions file: re-uploading a schedule can replace events from earlier uploads.

**Effort:** half a day, once templates are available.

## 3. Rosters back into SportsEngine

| Rank | Route | Status |
| --- | --- | --- |
| 1 | **Roster list + drag and drop:** the admin follows the sorted list (division → team → last name) in SportsEngine's rostering tool. About 300 drags a season. | **Built** |
| 2 | **API roster write:** after publish, an Edge Function assigns each published player to their SportsEngine team. | Not built; **unconfirmed** whether SportsEngine's API allows roster writes (SPORTSENGINE.md "Exports and API") |
| 3 | **Roster CSV import into SportsEngine,** if the rostering tool accepts a file | Unknown; ask a BVAC admin |

If route 2 exists:
- It runs only on admin request ("Send published rosters to SportsEngine"), never automatically.
- It shows a preview ("124 players to add to 14 teams, 3 already rostered elsewhere: skip").
- It records each write in the audit log.
- It's idempotent: re-running it skips players already on the right team.

**Effort:** 3–5 days, if the API supports it.

## 4. Excel files

CSV covers every current use, and SportsEngine imports CSV. Native `.xlsx` output (bold headers, one sheet per division) would need a library and adds nothing SportsEngine needs. **Not recommended** unless an admin specifically asks for formatted sheets. If they do, it's 1 day with a lazily loaded writer.

## Printable outputs

The roster list already prints cleanly (`@media print` in `app/globals.css` hides navigation). Two cheap additions the same way:
- a printable team sheet per coach: roster, practice night, games;
- a waitlist list per division.

**Effort:** 1 day for both.
