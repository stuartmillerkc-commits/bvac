# @bvac/se-bridge

The SportsEngine bridge (Task 3 in [docs/BUILD_PLAN.md](../../docs/BUILD_PLAN.md)). It implements `BridgeApi` from `@bvac/core`:

| Function | What it does |
| --- | --- |
| `suggestMapping(headers)` | Guesses which column holds each import field: exact header, synonyms, then fuzzy matching. Ignores case, punctuation and the school year. |
| `importRegistrations(rows, mapping, existing)` | Reads a registration report into people, households, players and registrations, matched against existing data. |
| `exportTeamsCsv(data, teams)` | Season Management "Teams Import". |
| `exportScheduleCsv(data, teams, games)` | Season Management "Schedule Import": games and weekly practices. |
| `rosterList(data, placements)` | The list an admin follows in SportsEngine's rostering tool. |
| `questionPack(data)` | The questions and options to paste into the Registration Builder. |

Also exported: `sampleSportsEngineExport(data)` (the demo's import file), `parseCsv` / `parseCsvRecords` / `toCsv`, `applyImport(data, result)`, `scheduleImportReadme(data)`, `rosterListCsv(rows)`, `questionPackItems(data)` (structured, for copy buttons), and `matchRequest` (for the preferences page's live "We found…" hints).

## The formats are unconfirmed: edit `src/formats.ts`

Nobody on the project has seen a real BVAC Saved Report or the Season Management import templates yet (see [docs/SPORTSENGINE.md](../../docs/SPORTSENGINE.md)). Every header name, column order and answer wording the bridge reads or writes is in [`src/formats.ts`](src/formats.ts). When a BVAC admin sends a real file or template, change the strings there; nothing else should need to change. Then run `pnpm --filter @bvac/se-bridge fixture` and `pnpm --filter @bvac/se-bridge test -u` to refresh the fixture and the column snapshots, and check the snapshot diff.

Choices made while the formats are unknown:

- **Report headers** follow the question titles in the question pack, so whatever BVAC types in the Registration Builder matches what the importer looks for.
- **Options by division:** SportsEngine's conditional logic probably needs one copy of a question per division. If the copies share a title, the Saved Report has several columns with the same header, and `parseCsvRecords` combines them (first non-blank answer wins).
- **Practice times** are the division's practice-slot times plus "None of these times work". Without that option, a blank answer would read as "any time".
- **Schedule warning:** re-uploading a schedule can replace every event from earlier uploads. The warning goes in a README next to the CSV (`scheduleImportReadme`), because SportsEngine may reject a CSV with a comment line. Set `SCHEDULE_WARNING_PLACEMENT = 'commentRow'` to put it on the first CSV line instead. `exportScheduleCsv(..., { fromDate })` leaves out earlier events.
- **Team names:** a team's rostered `name` if it has one, else its option label ("Option C"). Schedule rows name teams as "Division 3 > Option C".
- **Games without a team:** a game whose schedule position has no team yet is left out, because SportsEngine needs real teams.

The sample report is committed at [`fixtures/sportsengine-saved-report.csv`](fixtures/sportsengine-saved-report.csv). It is the demo's import file. A test fails when it is out of date. Column snapshots of the other exports are in [`test/__snapshots__/`](test/__snapshots__).

## Importing

- **Records** match by registration id (`externalId`), then by player first name + last name + birthdate. Guardians match by email, so siblings land in one household. A re-import updates records in place and never duplicates them. Running the same file twice changes nothing.
- **Answers:** days and times become `TimeWindow`s (every checked day × every checked time, with touching times merged). Team options are matched by full text, then by label, within the player's division. The division answer can be BVAC's wording, "Division 3", "Div 3" or "D3". If it can't be read, the division comes from the birthdate (Sep 1 cutoff). "What matters most" becomes `factorRanking`.
- **Keeping companion detail:** when a group of answers (days and times, team choices, coach, factors, each player request) reads the same as what the existing record would export, the existing value is kept. So a re-import never drops a 3rd choice, a confirmed friend match, or exact hours added on the preferences page. Unmapped columns also keep existing values.
- **Player requests** are matched after every row is read, so a request can name a kid further down the file. The steps, stopping at the first that finds anyone:
  1. Siblings look in their own household first.
  2. The requester's division: full name, nickname + last name, "First L.", then first name only. Each is tried as typed before trying nicknames.
  3. Every division, the same way except first name only.
  4. Typos: edit distance ≤ 2 across first and last name, division first.

  One hit is `matched`, several are `ambiguous` (with candidates), none is `unmatched`. Confirmed or matched requests are kept on re-import; unmatched and ambiguous ones are tried again. Nicknames are in [`src/nicknames.ts`](src/nicknames.ts), which covers the seed's `NICKNAMES`.
- **Issues:** every problem becomes an `importIssue` flag starting "Row N:", where N is the spreadsheet row (the header is row 1). Rows without a player name or a readable birthdate are skipped. Other problems keep the row and say what was assumed.
- **Self-reported seniority** ("Seasons played at BVAC", "Last season's coach") comes back as `selfReported` on the result. The core model has no field for it yet.

## Round trip: what doesn't come back

Exporting the sample season and importing it into an empty copy brings back every registration, player, guardian, household grouping, division, submission time, 1st/2nd choice, coach request, "only these days" answer, note, and every matched request (to the same player). The import also matches 5 typo'd friend requests the seed's simple matcher left unmatched. These are lost, by design of the SportsEngine form:

| Lost | Why |
| --- | --- |
| 3rd and later team choices | The form has 1st and 2nd choice pulldowns. |
| Factor ranks 3–4 | The form asks for the top two. Missing factors count as least important. |
| Exact hours | Availability shrinks to the practice-time options. Which teams fit stays the same, except when a family gave different hours on different days (only coaches' kids in the sample); then a few extra teams can fit. |
| "Any team that fits is fine" | Not on the form. Assumed true only when no team was chosen. |
| Sibling opt-out, volunteer roles | Not on the form. |
| Player nicknames | No such field. Nickname requests still match through the nickname table. |
| Second guardian | The report carries one parent/guardian. |
| Player history | Comes back only as self-reported seniority. |
| Internal ids, request ids, seconds in timestamps | New ids are `*_se_NNN`. Times are to the minute in US Central (`-06:00`). |
