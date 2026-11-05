# Design docs: from demo to real use

The demo works end to end with a made-up season, entirely in the browser. These docs cover what it would take to run it for real at BVAC: hosting, data, sign-in, intake, exports, email, family responses, history and audit. Each doc ranks its options and recommends one.

Read [DESIGN.md](../DESIGN.md) first for the product, and [SPORTSENGINE.md](../SPORTSENGINE.md) for what SportsEngine can and can't do.

## Where things stand

| Area | Today | Doc |
| --- | --- | --- |
| Hosting | Static demo on GitHub Pages | [01-hosting.md](01-hosting.md) |
| Data storage | In each browser (`localStorage`). Nothing shared or backed up. | [02-data-and-backend.md](02-data-and-backend.md) |
| Sign-in and roles | None. Coach "Sign in as" dropdown; open admin pages. | [03-accounts-and-roles.md](03-accounts-and-roles.md) |
| Getting registrations in | **CSV upload built.** No API, email or Excel intake. | [04-intake.md](04-intake.md) |
| Exports | **Teams, schedule and roster CSVs and the question pack built.** No full backup export or roster write-back. | [05-exports.md](05-exports.md) |
| Email | None | [06-email-and-notifications.md](06-email-and-notifications.md) |
| Families accept or decline; waitlist offers | Not built | [07-placement-responses.md](07-placement-responses.md) |
| Audit log | Type defined, nothing written | [08-audit-log.md](08-audit-log.md) |
| Past rosters (seniority) | Sample data only; self-reported answers parsed but not stored | [09-player-history.md](09-player-history.md) |
| Pilot without a backend | — | [10-single-admin-pilot.md](10-single-admin-pilot.md) |

## The main decision: how much to build, and when

Four ways to run team building at BVAC, ranked for where things stand now (a pitch in December, with Spring 2027 registration soon after):

| Rank | Approach | Cost to run | Build effort | Who can use it |
| --- | --- | --- | --- | --- |
| 1 | **Shadow pilot in single-admin mode for Spring 2027, then the full backend for Fall 2027** | $0 for the pilot; about $25–45/month in season later | About 4 weeks, then about 9–11 weeks | One admin in spring; everyone by fall |
| 2 | **Full backend straight away** | About $25–45/month in season | About 10–12 weeks before anyone can use it | Everyone |
| 3 | **Demo only:** show it, and keep building teams by hand | $0 | None | — |
| 4 | **Buy something else** | Varies | None | — |

**Why rank 1:**
- It matches DESIGN.md's rollout: Phase 1 is a "shadow" pilot where admins compare suggestions with their usual process.
- It puts no family data on any server.
- It's buildable before registration opens.
- Everything built for it (setup import, backup format, history import, CSV fixes) is reused by the backend.

**Why not rank 2:** about 3 months of volunteer work before BVAC has tried anything, with the risk of building logins and emails for a process BVAC may change after one season.

**Rank 3** is the fallback if BVAC isn't ready.

**Rank 4:** [SPORTSENGINE.md](../SPORTSENGINE.md) found that SportsEngine's rostering is manual, and the connected tools it found (such as TeamGenius) do tryout evaluations, not placement. Worth asking PlayMetrics, SportsEngine's new owner, whether placement is on its roadmap before BVAC commits to a custom tool.

## Recommended roadmap, ranked

### Stage 0: before the December pitch (no code)

1. Keep the demo on GitHub Pages ([01](01-hosting.md)).
2. Ask BVAC for three things. Each one unblocks a later stage:
   - one real SportsEngine Saved Report export, even an old season's with names removed ([04](04-intake.md));
   - whether **API Settings** is visible in their SportsEngine HQ ([04](04-intake.md));
   - what past rosters exist ([09](09-player-history.md)).
3. Ask BVAC to own the accounts: Cloudflare and, later, Supabase and Resend, with the developer as a member ([01](01-hosting.md), [02](02-data-and-backend.md)).

### Stage 1: Spring 2027 shadow pilot (about 4 weeks of work)

| Order | Work | Doc | Effort |
| --- | --- | --- | --- |
| 1 | Single-admin mode: empty season, setup CSV, backup save and load with optional passphrase | [10](10-single-admin-pilot.md) | ~2 weeks |
| 2 | Full data export (the same backup format, plus readable CSVs) | [05](05-exports.md) | 2 days |
| 3 | Tune the importer to BVAC's real export; saved mapping; withdrawals | [04](04-intake.md) | 2–3 days |
| 4 | Past-roster import and self-reported seniority | [09](09-player-history.md) | ~1 week |
| 5 | Pilot build on Cloudflare Pages at `teams.bvacsports.org` | [01](01-hosting.md) | Half a day + BVAC's DNS step |
| 6 | SportsEngine form: add the question pack's questions. Set up the auto-email linking to the Team Finder. | [04](04-intake.md), [06](06-email-and-notifications.md) | BVAC admin, no code |

**Gate:** do admins use at least one division's suggested rosters? (DESIGN.md "Rollout plan".)

### Stage 2: full use, Fall 2027 (about 9–11 weeks of work)

| Order | Work | Doc | Effort |
| --- | --- | --- | --- |
| 1 | Supabase backend, schema, row-level security, `place` function | [02](02-data-and-backend.md) | 3–4 weeks |
| 2 | Magic-link sign-in, roles, Admin → People | [03](03-accounts-and-roles.md) | ~1 week |
| 3 | Audit log (triggers, History tab) | [08](08-audit-log.md) | 3–4 days |
| 4 | Email: outbox, Resend, templates, held notices on publish | [06](06-email-and-notifications.md) | 1–1.5 weeks |
| 5 | Family responses (silence means accept) and waitlist offers | [07](07-placement-responses.md) | 1.5–2 weeks |
| 6 | SportsEngine API polling, if available | [04](04-intake.md) | ~1 week |
| 7 | Roster write-back to SportsEngine, if the API allows it | [05](05-exports.md) | 3–5 days |

Items 1–3 must come together: no real logins without row-level security, and no shared data without an audit trail. Items 4–7 can ship one at a time.

**Effort figures** are rough, for one developer working focused days. Volunteer evenings stretch them about 3×.

## Running costs (checked November 2026; re-check before committing)

| Stage | Hosting | Database | Email | Total |
| --- | --- | --- | --- | --- |
| Demo | GitHub Pages, $0 | — | — | **$0** |
| Spring pilot (single-admin) | Cloudflare Pages, $0 | — (data stays on the admin's computer) | — (SportsEngine sends its own) | **$0** |
| Full use, during a season | Cloudflare Pages, $0 | Supabase Pro, $25/month (backups, no pausing) | Resend free, or $20/month in publish weeks | **$25–45/month** |
| Full use, off-season | $0 | Free tier after a full export (it pauses when idle), or stay on Pro | $0 | **$0–25/month** |

This updates DESIGN.md's "free to about $20/month". Supabase's free tier pauses idle projects and has no automatic backups, which isn't acceptable while families depend on it.

## Decisions needed

**From BVAC:**
1. Shadow pilot in single-admin mode for Spring 2027? (Rank 1 above.)
2. The three facts in Stage 0: real export, API Settings, past rosters.
3. Who owns the accounts, and who pays about $25–45/month in season from Fall 2027?
4. Who controls DNS for `bvacsports.org`?
5. For [07](07-placement-responses.md): silence means accept? Are 72 hours to respond and 48 hours for waitlist offers right?

**From the developer, before Stage 2:**
- confirm the engine runs in a Supabase Edge Function (Deno) without changes;
- choose between realtime updates and refetch-on-focus.

## Not covered yet

These come up in Stage 1 or 2 but aren't designed here:
- **Season setup screens:** forms for fields, practice slots and game dates. Stage 1 uses a setup CSV ([10](10-single-admin-pilot.md)).
- **Coach availability and blackout dates:** typed (`CoachAvailability`), but unused by the UI.
- **Other sports:** DESIGN.md "Rollout plan" Phase 3.
- **A privacy notice** for the SportsEngine form and the tool. BVAC should approve the wording.
