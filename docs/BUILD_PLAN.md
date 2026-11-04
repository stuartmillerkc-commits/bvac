# Build plan

How the BVAC Team Builder demo gets built: one setup step (done), four tasks that run in parallel, one admin/coach UI task that can start alongside them, and one integration task at the end. Each task is sized for a single Claude Code session and ends in one pull request.

Read [DESIGN.md](DESIGN.md) for the product, [SPORTSENGINE.md](SPORTSENGINE.md) for what BVAC's registration platform can and can't do, and [`packages/seed/data/SUMMARY.md`](../packages/seed/data/SUMMARY.md) for the sample season.

## Goal of this phase

A **working, self-contained demo** a BVAC parent can show BVAC admins: realistic sample season, real placement logic, real schedules, the family, coach and admin views, and the SportsEngine import and export files. It runs entirely in the browser with no database and no real family data, so it can be shared as a link. The logic packages stay pure TypeScript, so a real backend can call them unchanged later (Phase 1, after BVAC says yes).

## Order

| Step | Task | Owns | Can run alongside | Status |
| --- | --- | --- | --- | --- |
| 0 | Setup: repo, types, sample season, contracts, app shell | everything below, initially | — | Done |
| 1 | Placement engine | `packages/engine` | 2, 3, 4, 5 | Done |
| 2 | Schedule builder | `packages/schedule` | 1, 3, 4, 5 | Done |
| 3 | SportsEngine bridge | `packages/se-bridge` | 1, 2, 4, 5 | Done |
| 4 | Family pages | `apps/web/app/{finder,register,preferences}`, `apps/web/components/family` | 1, 2, 3, 5 | Done |
| 5 | Admin and coach pages | `apps/web/app/{admin,coach}`, `apps/web/components/admin` | 1–4 (uses the stub engine until 1 merges) | Done |
| 6 | Integration, demo polish, deploy | anything | — (after 1–5 merge) | Done |

Steps 1–5 each touch only the folders they own. Shared files (`packages/core`, `apps/web/lib`, `apps/web/app/layout.tsx`, `globals.css`) change only if a task truly needs it. If you change one, keep the change small and additive, and say so in the PR description, because parallel tasks depend on it.

## Conventions (all tasks)

- **pnpm workspace, TypeScript strict, Vitest.** `pnpm check` (typecheck and tests) must pass, and so must `pnpm build`.
- **No new runtime dependencies** without a line in the PR description explaining why. Prefer small, well-known packages. The demo must build into a static site.
- **Deterministic.** Logic packages never call `Math.random()` or `Date.now()`. Randomness only comes through the seeded `Rng` in `@bvac/seed`, and never inside a sort comparator, because engines call comparators a different number of times. Sort strings with `compareStrings` from `@bvac/core`, never `localeCompare`, since collation differs between Node and browsers. Both bugs were caught in step 0 as hydration mismatches.
- **Contracts live in `packages/core/src/contracts.ts`.** Implement them exactly. If a contract has to change, update it there, fix every caller, and note it in the PR.
- **Times** are minutes after midnight, **dates** are `YYYY-MM-DD`, and **timestamps** are ISO with the `-06:00` offset (BVAC is US Central). Format with the helpers in `@bvac/core` (`formatWindow`, `formatDate`, `formatTime`).
- **Sample data is fictional.** Don't add real names, emails or BVAC staff. Emails use `example.com`, phones use `555`.
- **Seed changes:** if you change the generator, run `pnpm seed` and commit `packages/seed/data/*`. CI fails if they're out of date.
- **UI:** use the tokens and shared components in `apps/web/app/globals.css` (type and spacing scales, colors for light and dark, `.button`, `.badge`, `.card`, tables and form fields; see [visual-pass/README.md](visual-pass/README.md)), keep pages usable at 390px wide, and use plain words that make sense to a parent or volunteer admin. Wording should match DESIGN.md.
- **Branch and PR:** one branch per task (`task-N-short-name`), one PR into `main`. Use conventional, descriptive commit messages.

## Task 1 — Placement engine (`packages/engine`)

Replace the stub `placeDivision` with the engine in DESIGN.md "Placement engine". Keep the `PlaceDivision` contract.

**Scope**

1. **Units:** same-division siblings become one unit when `keepSiblingsTogether` is on and neither family opted out (`siblingsTogetherOptOut`). Siblings are players in the same household, and also matched sibling requests. Coach protected picks (`CoachAssignment.protectedPlayerIds`, which include the coach's own kids) and `fixed` placements are locked first. A unit containing a locked player goes with that player.
2. **Filter:** right division, team not cancelled, and if `availabilityRequired`, the team's practice window fits the family's availability (`fitsAvailability`). Registrations after `asOf` are excluded.
3. **Family preference order:** ranked choices first. Then, if `acceptAnyFittingTeam` (or no choices were given), every other team that fits, ordered by the fit score `Σ W_f · a_f · s_f(p,t)`. Use `factorMultiplier` for `a`. `s` is 0..1 for practice time (fits availability), coach (requested coach or last season's coach), friends (share of matched friend requests already on the team) and last team (same coach as last season). Families with no fitting teams and `availabilityRequired` go to the waitlist with reason `noFittingTeam`.
4. **Team priority, per team:** points from `settings.priority`. Early window applies to every team. Played-for-this-coach-last-season and seasons-with-coach apply only to that coach's team. Played last season and per-prior-season apply to every team. Sibling-already-on-team applies when a sibling in another unit is on that team. Tiebreak by `submittedAt`, then id. Use `PlayerHistory` and `SeasonIndex.lastSeasonOrder`.
5. **Place:** student-proposing deferred acceptance with capacities. In round 1 with `round1Fill: 'preferred'` the capacity is `teamSize.preferred`; otherwise it's `teamSize.max`. A unit takes as many seats as it has kids. Handle units that don't fit a partly full team sensibly, and document what you chose.
6. **Friend pass:** swaps or moves that satisfy more matched friend requests (mutual ones first) without moving anyone to a team they ranked lower or breaking priority, and without exceeding caps.
7. **Models:** `ranked` and `hybrid` use the above. `fcfs` places in `submittedAt` order into the first ranked choice with room, then any fitting team if allowed. `coachSelect`: same as ranked, but leave unlocked placements in state `proposed` for coach approval. `availabilityCluster`: out of scope here (Task 6 may add `suggestPracticeTimes`).
8. **`placementMethod: 'maxSatisfaction'`:** an alternative that maximizes total fit score with priority as a weighted term. A greedy pass plus local improvement is fine. It must still respect caps, locks and required days.
9. **Reasons:** every placement gets human-readable reasons, matching the DESIGN.md example: "1st choice · returning with Coach Lee (+25) · sibling kept together · friend request met".
10. **Flags:** `teamUnderMin`, `noFittingTeam`, `requestUnmet` (matched friend request not met), `coachRequestUnmet`, `demandExceedsCapacity` (division registrations > teams × max, with how many more teams are needed and the most-requested nights).
11. **Stats:** fill every `PlacementRunStats` field.
12. **Also export:** `priorityFor(index, registration, team)` returning points and reasons, so the UI can explain them.

**Done when**

- Contract tests still pass. New tests cover:
  - no placement exceeds caps;
  - required days are never violated;
  - locked and fixed placements are unchanged;
  - siblings stay together unless opted out;
  - deterministic output;
  - **stability:** no kid and team where the kid prefers that team over their own placement and the team has room or holds someone with lower priority (excluding locks);
  - round 1 fills only to preferred;
  - `fcfs` honors submission order;
  - `maxSatisfaction` has total fit ≥ priority-first on the sample season.
- All five sample divisions run in under 200 ms total in Node.
- `ENGINE_IS_STUB` is removed or set to `false`. Update the stub note on the home page.

## Task 2 — Schedule builder (`packages/schedule`)

Replace the stub `buildSchedule` with DESIGN.md "Game schedule builder". Keep the `BuildSchedule` contract.

**Scope**

1. A round robin by schedule position (`GameTrack`) using the circle method, with a bye each week for odd counts, repeated across `season.gameDates` (not makeup dates).
2. Assign each matchup to a `GameSlot` of that division on that date. Never double-book a slot or a track on a date.
3. **Balance by `style`:**
   - `rotating`: each track gets a near-equal mix of time slots.
   - `anchored`: each track has a home time and plays 2–3 games at other times. This mitigates the "only play the other 9am teams" problem; show the trade-off in the track description.
4. Constraints, once teams are claimed (team → track → head coach):
   - A coach's `gamesNotBefore` and `gamesNotAfter` are hard where possible, otherwise flagged.
   - Blackout dates are flagged.
   - A person coaching two teams never has overlapping games.
   - Siblings on teams in different divisions get the same or back-to-back times where possible (soft).
5. Fill `GameTrack.description` in plain words ("Mostly 9am · 2 games at 10am · bye Apr 17").
6. `fromDate` + `existingGames`: rebuild only games on or after that date, and return `changedGameIds`.
7. **Also export:** `practiceEvents(data, teams)`, the weekly practice occurrences between `season.practices.start` and `.end`. Task 3 uses them for the SportsEngine schedule CSV, and Task 4 for the calendar.

**Done when** tests cover all of the following, and all five sample divisions build in under 100 ms:

- every pair of tracks meets at least once when there are enough dates;
- no double-booking;
- byes are spread out;
- the anchored home-time share is at least 60%;
- rotating spread is at most 1 game per time;
- coach constraints are honored or flagged;
- output is deterministic.

## Task 3 — SportsEngine bridge (`packages/se-bridge`)

Implement `BridgeApi` from `packages/core/src/contracts.ts`. Real SportsEngine export headers aren't known yet (see SPORTSENGINE.md), so every header name and output column lives in **one editable config file** (`src/formats.ts`), and import goes through a column-mapping step.

**Scope**

1. **`sampleSportsEngineExport(data)`:** generates a realistic "Saved Report" CSV from the sample season, as SportsEngine would export it after BVAC adds the 7 questions. Use human headers like "Player First Name", "What age/grade is the player during the 2026-27 school year?", "Practice days available", "1st choice team", "Player request 1", "Sibling or friend? (1)" and so on, with answers in display form ("Option C · Tue 5:30–6:30pm · Field 3"). Commit one generated copy to `fixtures/` for humans and tests. This is the demo's import file.
2. **CSV parsing:** RFC 4180 (quotes, embedded commas and newlines, BOM, CRLF), with no dependency, or a tiny one if justified. XLSX is optional; if added, justify the dependency.
3. **`suggestMapping`:** header synonyms and fuzzy matching to `ImportField`s.
4. **`importRegistrations`:**
   - Parse answers back into structured data: days and times into `TimeWindow`s, team option labels into team ids, division answer into division, factor answers into `factorRanking`.
   - Match existing records by `externalId`, then by player name + birthdate. Re-imports update records and never duplicate.
   - **Request matching:** normalize case and punctuation, nicknames (`NICKNAMES` in the seed is a starting point), "First L." initials, typos (edit distance ≤ 2), and limit to the same division first. The result is `matched`, `ambiguous` with candidates, or `unmatched`.
   - Every problem becomes an `importIssue` flag with the row number.
5. **`exportTeamsCsv`:** SportsEngine Season Management "Teams Import".
6. **`exportScheduleCsv`:** SportsEngine "Schedule Import". Games have Event Type = Game; practices are events with Teams = "Division Name > Team Name". It includes the warning about the replace-all behavior from SPORTSENGINE.md, delivered as a comment row or a README alongside, per format support.
7. **`rosterList`:** the sorted list an admin follows in SportsEngine's rostering tool (division → team → player last name).
8. **`questionPack`:** the text BVAC pastes into the SportsEngine registration builder: each question, its type (checkbox, radio, pulldown, text), its options (team options per division with conditional logic notes), and the seat limit per option for first-come-first-served divisions.

**Done when** tests cover:

- a round trip: export the sample → import into an empty copy, and registrations come back equivalent (choices, availability, requests) apart from expected losses, which are documented;
- re-import idempotence;
- the CSV edge cases;
- mapping suggestions on the sample headers are 100% correct;
- request-matching cases (exact, nickname, initial, typo, ambiguous, unmatched);
- export column snapshots.

## Task 4 — Family pages (`apps/web`)

Build the three family-facing pages from DESIGN.md "Recommended workflow with SportsEngine" (phase 2) and "Family registration form". Use `useSeason()` from `apps/web/lib/season-store.tsx`. Put components in `apps/web/components/family/`.

**Scope**

1. **`/finder` Team Finder:** public, no login.
   - Division picker; also "which division am I in?" from grade or birthdate.
   - Night filter checkboxes and an optional "only these nights" switch.
   - A card per team option: label, practice window (`formatWindow`), field, game pattern (track description; "Game times to be announced" until Task 2), coach (if `showCoachNames`), and a seat status chip.
     - **Seat status** comes from engine results: *open* below preferred, *filling* between preferred and max, *waitlist* at max.
     - In `fcfs` divisions the chip says seats are held at registration. In ranked divisions it says counts are estimates, with a one-line explanation of the rule.
   - "Register for this team" links to `/register?division=…&first=…`.
2. **`/register`:** a mock of BVAC's SportsEngine soccer form. Visually it reads as "SportsEngine-like": neutral, stepwise, plainly a mock, with a banner explaining it.
   - **Steps:**
     1. Who are you registering?
     2. Player information: the existing BVAC fields from SPORTSENGINE.md, such as name, DOB, the 5-division grade question, gender, shirt size, and address with city only.
     3. **New questions:** the 7 from SPORTSENGINE.md "Better SportsEngine questions". 1st and 2nd choice dropdowns are limited to the chosen division's teams. The friend request fields show "We found: Ava Martinez, 1st grade" matches live.
     4. Review and pay (mocked).
   - On submit, call `addRecords(...)` to add person, household, player and registration with `source: 'native'`, the current timestamp as `submittedAt`, and the window derived from season dates (or "regular" if outside). Then show the SportsEngine-style receipt with the "Continue to team preferences" link to `/preferences?ref=<registration id>`.
3. **`/preferences?ref=`:**
   - Drag or arrow-key ranking of every team that fits the family's days, with fits / doesn't-fit marks and seat chips.
   - "Any team on these nights is fine."
   - The factor ranking (drag).
   - Confirming ambiguous or unmatched friend requests against registered kids in the division.
   - Saving updates the registration through `updateEdits`. Add a small helper in `season-store.tsx` if needed, and say so in the PR.
   - Without `ref`, offer a picker of demo registrations ("view as a family").
4. **Accessible:** labels, keyboard ranking, focus states, 390px layout.

**Done when** all three pages work against the stub engine and seed data. A family registered through `/register` appears in admin data, survives reload, and its preferences round-trip. Add Playwright smoke tests if time allows; otherwise Task 6 adds them.

## Task 5 — Admin and coach pages (`apps/web`)

Build DESIGN.md "Admin console and coach view". Use `useSeason()`; add store helpers only if needed, and say so in the PR. Put components in `apps/web/components/admin/`. Works with the stub engine; it picks up the real engine automatically when Task 1 merges.

**Scope**

1. **`/admin`:** the season dashboard.
   - Per division: registrations by window, teams versus needed (`ceil(registrations / preferred)`), placed, waitlisted, first-choice rate, and flags.
   - A day × time demand grid: how many families are available per night and time, versus team options offered.
   - An "As of" control showing the season on any date between Jan 4 and Mar 17 (`setAsOf`), so admins can watch it fill up, with a play button.
   - Reset demo.
2. **`/admin/board?d=D3`:** the team board.
   - One column per team: label, practice, coach, and a size bar against min/preferred/max.
   - Kid cards: name, grade, seniority badges (seasons, played for this coach), request icons (sibling, friend, coach, met or unmet), choice rank met, and reasons on expand.
   - **Drag** a card to another team or the waitlist. This creates a `fixed` placement with `locked: true` and state `projected`, and the board says what the move breaks ("friend request lost · now 3rd choice").
   - Pin and unpin. A waitlist column. Keyboard alternative: a "Move to…" menu.
3. **Rounds:** for a division, "Send round N to coaches" sets unlocked placements to `proposed`, "Approve" sets them to `approved` (coach or admin), and "Publish round N" sets them to `published` and fixes them. "Undo publish" rolls back to the previous snapshot. Show state on cards.
4. **`/admin/compare`:** runs `placeDivision` twice with different `settingsOverride` values (method, team sizes, round fill, sibling rule, factor weights) and shows the stats side by side, plus how many kids change teams.
5. **`/admin/settings`:** every `DivisionSettings` field as a form, with plain-language help text from DESIGN.md. Saves via `setDivisionSettings`.
6. **`/coach`:** a "sign in as" picker of demo coaches.
   - The coach's team: practice slot, game track, and roster with reasons and seniority.
   - Approve the roster (sets approved on that team's proposed placements) and flag a kid for admin review.
   - Propose a swap with another team (recorded as a pending note for the admin).
   - Protected picks: choose up to N returning players.
   - **Claim a slot (coach sign-up):** for the demo, a coach without a team (add 2 to the demo via `addRecords`) can claim an open practice slot and game track, which creates a team option visible in the Team Finder.

**Done when** every page works on the sample season, admin moves persist across reloads, rounds move placements through the states, and the coach view respects the visibility rules in DESIGN.md "Users and roles" (no guardian contacts before publish).

## Task 6 — Integration, demo polish, deploy

After Tasks 1–5 merge.

1. **Wire the real packages everywhere:**
   - Track descriptions and game lists on the Team Finder, coach view and board.
   - Admin **Import** page: upload the sample SportsEngine CSV (link to download it), the mapping screen, an import report with issues, and the new registrations appearing.
   - Admin **Exports**: teams CSV, schedule CSV, roster list (printable), and question pack (copy button).
2. **"Registrations arriving" replay:** the As-of play button steps through `submittedAt` order with a running "what changed" feed (new kid, moves and why, new flags), as in DESIGN.md "Live projections".
3. **A guided tour** for the BVAC pitch: a short `/tour` page or step overlay that walks through coaches claiming slots → Team Finder → register → board filling → round 1 → coach approval → publish → exports. Write `docs/DEMO_SCRIPT.md`, a 10-minute talk track.
4. **Playwright smoke tests:** each page loads without console errors, register → appears on board, drag → persists, round publish.
5. **Deploy** the static site via GitHub Pages: a workflow on `main` with `NEXT_PUBLIC_BASE_PATH`, and the README updated with the link.
6. **Polish:**
   - An accessibility pass (axe), plus mobile and dark mode checks.
   - Page titles, empty and error states.
   - Remove every `Placeholder` and stub notice.

**Done when** the deployed link walks through the full story with no stubs, and CI runs the smoke tests.

## Later (not this phase)

- **Phase 1 backend:** Supabase (Postgres, magic-link auth, row-level security for roles), the same packages server-side, a SportsEngine alert-email inbox or API polling for intake, and email notices. Decide after BVAC feedback.
- `availabilityCluster` model: suggest practice nights from availability when coaches aren't known yet.
- Other sports (basketball next: BVAC opens basketball sign-ups Oct 1).

## Prompts for new sessions

Start each in a fresh Claude Code session on this repo after step 0 is merged:

```
Read docs/DESIGN.md, docs/SPORTSENGINE.md and docs/BUILD_PLAN.md. Do Task N from docs/BUILD_PLAN.md. Work only in the folders that task owns, follow its contract in packages/core/src/contracts.ts, add tests, make sure `pnpm check` and `pnpm build` pass, and open a PR into main.
```

For Task 6, add: "Tasks 1–5 are merged."
