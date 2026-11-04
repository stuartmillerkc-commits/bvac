# Usability review: first-time use

A walkthrough of the demo build (`pnpm build`, then `apps/web/out` served locally) in Chromium at desktop width (1280px) and phone width (390px), as three people:

- **A parent who has never seen it.** Starts on the home page, browses the Team Finder, registers a child for a team they liked, then opens the team preferences page from the receipt.
- **A volunteer admin with 20 minutes.** Opens the admin dashboard, tries to work out what needs doing, reviews the Division 1 and Division 3 boards, and runs round 1 (send to coaches, approval, publish).
- **A coach.** Signs in from the coach view after round 1 is sent, reads the roster and approves it.

The focus is intuitiveness: where someone would hesitate, misread a label, miss the next step, or not understand why the engine did something. Findings are ranked by impact, meaning how likely someone is to hit the problem times how badly it stops them. Each one is marked **Fixed** (in this change), **Partly fixed**, or **Not fixed** (with a reason).

No notes from the person who commissioned the review were supplied ("none"), so all findings come from this walkthrough.

## Summary

The core flows work and the engine's reasons are good: the waitlist explanations ("Only Mon, Thu 6–7pm work, and no Division 1 team practices then") are clear. The main problems were around **what to do next**, and around **labels that only make sense once you've built the tool**:

1. The rounds panel showed three equal-looking buttons, with "Publish" highlighted even before anything was sent. After sending, nothing changed except a counter, and nothing pointed to the coaches.
2. The registration form's hour-long time boxes didn't line up with half-hour practices, so a parent who picked a 6:30–7:30pm team and ticked "6–7pm" was told the team didn't fit.
3. A demo sign-up made before Jan 4 (that is, during the December pitch) was labelled "Regular registration. Placed in round 2," which contradicts the story being told.
4. Kid-card badges ("Not ranked", "Friend 0/1", "Coach ✗", "1 unmatched", "Regular") had no key, and only some had hover text, which phones don't show.

All four are fixed, along with ten smaller issues. Five lower-impact issues are listed at the end and not fixed.

## Findings, ranked by impact

### 1. The rounds panel doesn't say what to do next (admin, coach) — Fixed

**What happened.** On the board, the Round 1 panel showed *Send round 1 to coaches*, *Approve as admin*, *Publish round 1* and *Undo publish* side by side, with *Publish* as the primary (filled) button from the start. The volunteer admin's natural reading was "click the blue one," which skips the coaches entirely. After *Send*, the panel looked the same except for a "29 with coaches" chip. *Send* stayed clickable, and "29 placements are still waiting for coach approval" was at the end of a grey paragraph. Nothing said which coaches, or how to reach them.

**Fix.**
- The panel now shows three numbered steps, *Send to coaches → Coaches approve → Publish to families*, with the current step marked and earlier steps ticked.
- A "Next step" note (a live status region) changes at each stage:
  - before sending, it says what sending does;
  - after sending, it says how many kids on how many teams are waiting, with links straight to those coaches' views;
  - once everything is approved, it says to publish;
  - after publishing, it confirms "Round 1 is published: N kids are on final teams" and moves on to round 2;
  - when both rounds are published, it links to Exports.
- The button for the current step is the primary one. *Send* disappears once sent, since publishing also includes kids who registered later.
- The other labels are plainer: "waiting for coaches" instead of "with coaches", "Approve all as admin", and "Undo last publish" (shown only when there is something to undo).
- The note under the buttons warns that publishing early also publishes kids coaches haven't approved yet.

### 2. Practice-time boxes don't match half-hour practices (parent) — Fixed

**What happened.** The parent clicked *Register for this team* on Option B (Mon 6:30–7:30pm). On step 3 the 1st choice was filled in, but the day and time boxes were empty. Ticking Mon and "6:00–7:00pm", which is what most people would do for a 6:30 practice, showed **"✗ Outside the days and times you checked"** under their own 1st choice. A practice that starts at 6:30 needs both the 6–7pm and 7–8pm boxes, which nothing explained.

**Fix.**
- Coming from a Team Finder card now pre-checks that team's day and every hour box its practice touches. A note says "We checked Mon because Option B practices Mon 6:30–7:30pm. Check any other days that work too: more days means more teams to choose from."
- The times question has permanent help text: "Check every hour you could be at the field. A practice from 6:30 to 7:30pm needs both 6:00–7:00 and 7:00–8:00 checked."
- *Fill in sample answers* used to replace the chosen team's night with Tue/Thu, so the 1st choice became "can't be used." It now keeps the chosen team and answers with its night.

### 3. Demo sign-ups before Jan 4 are called "regular" (parent, presenter) — Fixed

**What happened.** The sample season's early registration runs Jan 4–31, so any sign-up made today (in November or at the December pitch) fell outside every window. The form treated it as **"Regular registration. Placed in round 2; rosters come out Sat Mar 13."** A parent who signed up before registration even opened was told they were too late for round 1. The SportsEngine import (`packages/se-bridge`) already counts anything up to the end of early registration as early, so the two ways in disagreed.

**Fix.** The form's `windowFor` in `apps/web/components/family/helpers.ts` now uses the same rule as the importer: on or before the early deadline is early, then regular, then late. (Before, a sign-up after rosters were final was also labelled "regular"; it is now "late.") The early-registration note also says when the family will hear their team.

### 4. Kid-card labels have no key (admin, coach) — Fixed

**What happened.** Cards on the board carried "Not ranked", "1 season", "With coach ×2", "Regular", "Late", "Friend 0/1", "Sibling ✗", "Coach ✗", "1 unmatched", "Coach's child" and "Sent to coach". The admin's first reading of "Not ranked" was "this kid has no ranking or priority," but it actually means the family didn't rank this team. "Regular" read as a skill level. "Friend 0/1" and "1 unmatched" needed decoding. A few badges had hover text, which doesn't exist on phones. The disclosure was labelled "Why here," which doesn't tell the admin what it opens.

**Fix.**
- **Labels.** "Didn't rank this team", "New to BVAC", "2 BVAC seasons", "Regular sign-up" and "Late sign-up", "Sibling together" and "Sibling apart", "Coach request ✓" and "✗", "1 name not found", and "Waiting for coach".
- **Reasons.** The disclosure reads "Why this team?" on teams and "Why waitlisted?" on the waitlist.
- **Key.** A collapsible **What the labels mean** key on the board and in the coach view explains each badge in a sentence.

### 5. The dashboard doesn't say what to do, and hides columns on phones (admin) — Fixed

**What happened.** The division table ended with "Round 1 not sent" and flag chips reading "1 critical · 9 warning · 16 notes". None of these were links, and "notes" didn't say what they were about. The flag details were in a separate set of collapsed sections further down. On a phone the table scrolled sideways inside its card, and Waitlist, Flags and Rounds were all off-screen with no scroll cue. "Teams vs needed 5 of 7" didn't say that 2 more coaches were needed.

**Fix.**
- **Next step.** A new column per division gives the next step as a link to that division's board:
  - "Review and send round 1 →" before anything is sent;
  - "Round 1: 4 of 29 approved by coaches · Check on coaches →" while coaches are reviewing;
  - "Publish round 1 →" once everything is approved;
  - "Export for SportsEngine" when both rounds are published.
- **To check.** The flags column is now "To check", with plain counts ("1 urgent", "9 to check", "16 unmet requests") linking to the board's list.
- **Teams.** Under "5 of 7" it says "needs 2 more coaches."
- **Phone layout.** Below 720px the table becomes one card per division, with every value labelled.
- **Footnote.** The note under the table explains "1st choice" and what "teams needed" means for coach recruiting.

### 6. The coach view talks like the admin console (coach) — Fixed

**What happened.**
- Players waiting for the coach were labelled **"Sent to coach,"** which is the admin's wording.
- Two players (a protected pick and a returning player) had no status at all, and nothing said why they were already locked on.
- There was no prompt at the top of the roster; the only cue was the *Approve roster (4)* button.
- A roster of 7, below the ideal of 9, gave no reason why it was small in round 1.
- The games line started with "schedule position 1".
- The sign-in list didn't show which coaches had something to approve, so a presenter had to remember who to pick.

**Fix.**
- **Banner.** A status note at the top of the roster changes with the state:
  - "The admin sent you 4 players to approve. Look them over…, then press Approve roster. If someone shouldn't be here, flag them or propose a swap," with "Round 1 only covers early sign-ups, so more players join after the regular deadline" in round 1;
  - after approving, "Thanks, you approved this roster. Next, the admin publishes it to families (planned for Sat Feb 13)";
  - a published-roster message once it's published, and "Nothing to do yet" before anything is sent.
- **Labels.** "Needs your approval" for players waiting on the coach, and "Your protected pick" or "Your child" for locked players.
- **Sign-in.** The sign-in list adds "· 4 to approve", and the landing page lists coaches waiting for approval as one-click links.
- **Games.** The games line leads with the plain description ("Mostly 9am · 1 game at 10am…").

### 7. Full teams still say "Register for this team" (parent) — Fixed

**What happened.** In Division 1 (first come, first served), Options B, C and E showed a red "Full · waitlist" chip, but their button was the same filled *Register for this team* as open teams. A parent could pay expecting a seat.

**Fix.**
- In first-come divisions, full teams show a secondary **Join the waitlist** button and the note "This team is full. Registering puts you on its waitlist; pick a 2nd choice with open seats too."
- In ranked divisions, likely-full teams say **Register anyway**, and the note suggests adding a 2nd choice with open seats.

### 8. The board on a phone is about 10,000px long (admin) — Partly fixed

**What happened.** At 390px every team column stacks, so Division 1's board is roughly 10,000px of kid cards. An admin couldn't see team sizes at a glance or find the waitlist without a long scroll.

**Fix.** A **Jump to:** row under the key links to each team and the waitlist, with counts ("Option A (8) · … · Waitlist (15)"). **Not fixed:** a compact phone view with collapsed teams. That is a larger layout change; the board is still easiest on a laptop, as DEMO_SCRIPT.md already says.

### 9. "Flags" are technical and hidden when there are none (admin) — Fixed

**What happened.** The board's flag summary read "10 flags" and "1 flags" (sic), with severity chips "critical" and "warning". When a division had no flags, the section disappeared, so an admin couldn't tell "nothing wrong" from "not loaded".

**Fix.**
- The summary now reads "N things to check", with "(n urgent)" when there are any.
- Severity chips say Urgent, Check and Note. The list opens by itself when something is urgent, and it has an `#flags` anchor the dashboard links to.
- With nothing to check, the board says so: "every team is within size and every family has a team that fits their days."

### 10. The preferences page doesn't say you're done (parent) — Fixed

**What happened.** After *Save preferences* the message was "Saved. BVAC will use these choices the next time teams are projected." Nothing said whether the family had anything left to do, or when they'd hear.

**Fix.** The message now reads: "Saved. You're all set: you'll hear which team on Sat Feb 13 (or Mar 13 for regular sign-ups). You can come back and change these until …". For late sign-ups it says a seat will be offered as one opens.

### 11. Friend match copy says "more than one" when there's one (parent) — Fixed

**What happened.** Typing "Ava" gave "More than one registered player could be 'Ava': Ava White, 1st grade · Division 3," which names one player. The preferences page then said "More than one registered player could match" above a single option.

**Fix.** With one candidate, the form asks "Did you mean Ava White, 1st grade · Division 3? We'll ask you to confirm on the team preferences page after you register." The preferences page asks "We think 'Ava' is the player below. Is that right?"

### 12. The "As of" control is unexplained (admin) — Fixed

**What happened.** The dashboard opened on "As of Wed Mar 17 · everyone registered" with a bare "Late registration" chip and a slider. The admin wasn't sure whether the date was today, a filter, or a setting.

**Fix.** The chip reads "Season: late registration." A line under the title says every admin page shows the season as it stood on that date, and how Play and the slider work.

### 13. No site icon, so every page logs a 404 (everyone) — Fixed

**What happened.** Real browsers request `/favicon.ico`. The static export had none, so every page logged "Failed to load resource: 404" in the console. The Playwright smoke tests failed for this reason when run with the full Chromium binary (`PW_CHROMIUM=/opt/pw-browsers/chromium`); with the bundled headless shell they pass, because it doesn't request favicons.

**Fix.** Added `apps/web/app/icon.svg` (the "BV" mark in the primary color). Next.js links it from every page, including under the GitHub Pages base path.

### 14. Empty states on the board (admin) — Fixed

**What happened.** An empty team said only "Drop kids here.", which means nothing on a phone where you can't drag. An empty waitlist still showed "0 kids, highest priority first…".

**Fix.**
- An empty team says "No players yet. Drag a kid here, or use a kid's 'Move to…' menu."
- An empty waitlist says "Nobody is waiting. Drag a kid here to take them off a team."
- A non-empty waitlist explains its order in plain words and points to "Why waitlisted?".

## Not fixed (lower impact)

| # | Where | Issue | Why not now |
| --- | --- | --- | --- |
| 15 | Compare | The method picker says "Priority-first (deferred acceptance)", and the results table has no plain verdict ("B gives 3 more kids their 1st choice but moves 4 kids"). | Compare is an optional, admin-only page; it's worth a dedicated pass. |
| 16 | Header | "Preferences" in the top nav takes a parent who hasn't registered to a family picker. | The page explains itself; in a real deployment families reach it only from their link. |
| 17 | Dashboard | "What changed" sits above the division table and is an empty explainer until Play is pressed, which pushes the table down. | It belongs next to the Play button; moving it means reworking the As-of card. |
| 18 | Board | Publishing has no confirmation step. | *Undo last publish* is one click away, and a confirm adds a click to a main path. |
| 19 | Register | There is no error summary at the top of a step. | Focus already moves to the first invalid field, and each error is next to its field. |

## How the fixes are tested

`apps/web/e2e/flows.spec.ts` has four new tests:

- **Rounds panel:** walks send → coach approves (via the panel's link) → dashboard shows "N of M approved by coaches" and links back → approve all → publish → round 2 is next and *Undo last publish* appears.
- **Team Finder to registration:** registering from Option B pre-checks Monday and both hour boxes, the 1st choice shows "Fits", and a December sign-up is labelled early (the clock is fixed for the test).
- **Full first-come teams:** they offer *Join the waitlist* with an explanation.
- **Board:** it shows "things to check", the label key, the jump links and "Why waitlisted?".

The existing smoke tests (every page loads without console errors, no horizontal overflow at phone width, no serious axe violations in light and dark) cover the new markup.

Logic packages (`packages/*`) are unchanged. The registration-window fix is in the web app's own helper, and it now matches the rule `packages/se-bridge` already used.
