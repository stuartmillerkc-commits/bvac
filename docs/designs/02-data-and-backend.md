# Data storage and backend

Where data lives, who can read it, and whether a backend is needed.

**Status:** there is no backend. The sample season is generated in the browser (`packages/seed`). Every change goes into one `localStorage` entry, `bvac-team-builder-demo-v1`, managed by `apps/web/lib/season-store.tsx`: mock registrations, imports, moves, rounds, coach notes and settings. Each browser has its own private copy. Nothing is shared, nothing is backed up, and clearing site data erases it.

**Recommendation, ranked:**
1. **Spring 2027 shadow pilot:** single-admin mode, using the browser plus a backup file ([10-single-admin-pilot.md](10-single-admin-pilot.md)).
2. **Once coaches or families need to sign in:** Supabase (Postgres, auth, row-level security), as below.

## Does it need a backend?

Not for the demo, and not for a pilot where one admin does all the work. Yes, as soon as any of these is needed:

| Need | Why a browser can't do it |
| --- | --- |
| Two or more people see the same data | `localStorage` is per browser |
| Coaches see their own roster | Needs a login, and needs the server to hide other teams' details |
| Families use the preferences page | Their answers must reach the admin |
| Guardian contacts hidden until publish | Must be enforced where the data lives, not just in the page ([DESIGN.md](../DESIGN.md) "Users and roles") |
| Email notices, SportsEngine API polling | Need something running when nobody has the page open |
| Audit log, backups, data retention | Need durable storage BVAC controls |

## Options, ranked

| Rank | Option | Cost | Strengths | Weaknesses |
| --- | --- | --- | --- | --- |
| 1 | **Supabase:** Postgres, magic-link auth, row-level security (RLS), Edge Functions, scheduled jobs | Free tier; Pro $25/month | One service covers database, logins, per-role access rules enforced by the database, scheduled jobs and server functions. Postgres is standard and exportable. Works with the static site: the browser talks to it directly. | Free projects **pause after 7 days without activity** and have no automatic backups, so the off-season needs care (below). Another account to own. Adds `@supabase/supabase-js` as a runtime dependency. |
| 2 | **Browser only, plus a backup file** (single-admin mode) | $0 | No real data on any server. Nothing to secure or pay for. Days of work, not weeks. | One person only. No coach or family logins, no emails, no API polling. |
| 3 | **Cloudflare D1 + Workers + a hosted auth service** | Mostly free | Same vendor as the recommended host. Fast. | Auth, row-level rules and admin tooling all have to be built or bolted on (e.g. Clerk or Auth0). Much more code to get the same safety. |
| 4 | **Firebase** (Firestore + Auth) | Free tier | Mature auth, realtime updates. | A document database fits the relational model (players → registrations → placements) poorly. Security rules are less natural than SQL policies. Harder to export to spreadsheets. |
| 5 | **Google Sheets as the database** (Apps Script) | $0 | Volunteers already know spreadsheets. | No per-coach access control, fragile under concurrent edits, slow for the engine, and easy to break by editing a cell. Not recommended for children's data. |

Supabase ranks first because it's the only option where the privacy rules ("a coach sees only their own team; no contacts before publish") are enforced by the database itself, with little custom code, at $0–25 a month. Single-admin mode ranks second only because it can't grow past one person. It's the right first step: see the [index](README.md) for sequencing.

Pricing checked November 2026: [Supabase pricing](https://supabase.com/pricing). Free plan: 2 active projects, 500 MB database, pauses after 1 week of inactivity, no automatic backups. Pro: $25/month, daily backups, no pausing. Re-check before committing.

**Cost advice:** use Pro ($25/month) during registration and rounds, and pause or downgrade between seasons only after a full export. A paused free project is restorable, but restoring it in the middle of registration week is the wrong time to find out how. This replaces DESIGN.md's "free to about $20/month" estimate. The realistic cost is $0 for the demo and $25 a month while a season is live.

## Recommended design (Supabase)

### Architecture

```
Browser (static site on Cloudflare Pages)
  ├─ public pages: Team Finder ── reads team_options_public (view, no personal data)
  ├─ family pages ── supabase-js, signed in as a guardian ── RLS: own household only
  ├─ coach view ──── supabase-js, signed in as a coach ───── RLS: own team, contacts after publish
  └─ admin pages ─── supabase-js, signed in as an admin ──── RLS: everything (division coordinators: own division)

Supabase
  ├─ Postgres: tables below, RLS on every table, audit triggers
  ├─ Auth: magic-link email (custom SMTP, see 06-email-and-notifications.md)
  ├─ Edge Function "place": runs @bvac/engine per division and writes projected placements
  ├─ Edge Function "notify": sends queued emails
  └─ Scheduled jobs (pg_cron): "place" after changes, SportsEngine API poll (04-intake.md), email queue
```

### Tables

These map one-to-one onto the types in `packages/core/src/types.ts`, so the logic packages keep working unchanged. Ids stay text (`ID = string`); the seed's ids such as `person_…` remain valid.

| Table | From type | Notes |
| --- | --- | --- |
| `seasons`, `divisions` (settings as `jsonb`), `fields`, `practice_slots`, `game_slots`, `game_tracks`, `games`, `teams` | `Season`, `Division`, … | Admin-edited setup. `divisions.settings` holds `DivisionSettings`. |
| `people` | `Person` | Guardians and coaches. `auth_user_id` links to a Supabase login (nullable until they first sign in). |
| `households`, `household_guardians` | `Household.guardianIds` | Join table instead of an array, so policies can check membership. |
| `players`, `player_history` | `Player`, `PlayerHistory` | Persist across seasons. History drives seniority ([09-player-history.md](09-player-history.md)). |
| `registrations` | `Registration` | `availability`, `choices`, `requests`, `factor_ranking` as `jsonb`, matching the type. `external_id` is unique per season (the SportsEngine id). |
| `coach_assignments`, `coach_availability` | same | |
| `placements` | `Placement` | One row per registration per season. `state`: projected, proposed, approved, published, waitlisted. `reasons` as `jsonb`. The engine writes projected rows; admins and coaches move them through the states. |
| `publish_snapshots` | `DemoEdits.publishSnapshots` | Placements before each publish, for "Undo last publish". |
| `coach_notes` | `CoachNote` | |
| `placement_responses` | new | Family accepts or declines a published placement ([07-placement-responses.md](07-placement-responses.md)). |
| `audit_log` | `AuditEntry` | Written by triggers ([08-audit-log.md](08-audit-log.md)). |
| `imports` | new | One row per SportsEngine file or API sync: who ran it, counts and issues ([04-intake.md](04-intake.md)). |
| `email_outbox` | new | Queued notices with status ([06-email-and-notifications.md](06-email-and-notifications.md)). |
| `user_roles` | new | `person_id`, `role` (`admin`, `coordinator`, `coach`, `guardian`), optional `division_id` ([03-accounts-and-roles.md](03-accounts-and-roles.md)). |

### Where the engine runs (options, ranked)

The engine needs every registration in a division to place anyone, but a coach may only see their own team. So the engine can't run in a coach's browser on raw data.

1. **Recommended: an Edge Function.** `place` loads the division, runs `placeDivision`, and replaces that division's projected and waitlisted rows in `placements`. Locked, proposed, approved and published rows are passed as `fixed` and never touched, exactly as the store does today. It's triggered after any change to registrations, settings or locks, with about a minute of debounce (`pg_cron` plus a "dirty" flag per division), and on demand from the admin board. There is one source of truth, and it works when no admin is online. The engine is pure TypeScript with no browser APIs, so it bundles for Deno.
2. **Admin's browser.** The admin board runs the engine as it does now and writes the results. This is simpler, but coaches only see updates after an admin opens the board, and two admins could race.

The As-of replay and Compare pages keep running the engine in the admin's browser. They're what-if views and are never saved.

### Changing the web app

`season-store.tsx` already says "Phase 1 swaps this for a real backend behind the same hook". The plan:

- Keep `useSeason()` and the `SeasonState` shape. Add a data-source switch, `NEXT_PUBLIC_MODE=demo | live`:
  - **demo** keeps today's generated season plus `localStorage`, unchanged, so the public demo and the Playwright tests keep working;
  - **live** loads `SeasonData` from Supabase (only the rows the signed-in user may see) and turns each edit function into a database write.
- Edits become explicit writes, not one JSON blob. `addRecords`, `patchRegistration`, `setDivisionSettings`, `applyImported`, `setFixed` and the rounds actions in `components/admin/model.ts` each become an insert or update, or an RPC for multi-row actions such as "publish round 1", so they happen all at once.
- Realtime is optional. Supabase can push changes, so a coach sees "Approved" without reloading. Start with refetch-on-focus and add realtime only if people ask.

### Privacy and safety

- **RLS on every table.** No table is readable with the public key alone, except the `team_options_public` view: team label, night, field, coach name if the setting allows, and seat status. That view is all the Team Finder needs.
- **Guardian contact columns** (`people.email`, `people.phone`) are readable by a coach only through a view that checks the team's placements are `published`.
- **Data kept:** only what DESIGN.md lists. No medical, school or photo data.
- **Retention:** a yearly scheduled job deletes contact details for households with no registration in 2 years, keeping only the `player_history` that seniority needs (DESIGN.md "Privacy and safety").
- **Backups:** Pro plan daily backups, plus a full export after each round ([05-exports.md](05-exports.md) "Full data export").
- **Two projects:** `staging` (fictional seed data, used by PR previews) and `production`. Developers don't need production access day to day.

### Testing

- **Unit:** the engine, schedule and bridge tests don't change.
- **Database:** policy tests (pgTAP, or SQL run in CI against a local Supabase) prove each role sees only what it should. For example, a coach can't select another team's players, and can't see guardian email before publish.
- **End to end:** the Playwright tests keep running against the demo build. A smaller live-mode suite runs against staging, signing in as a seeded admin, coach and guardian.

## Effort (rough, focused days)

| Piece | Days |
| --- | --- |
| Schema, migrations, seed loader for staging | 3–4 |
| RLS policies and policy tests | 3–4 |
| Store data source (`live` mode) and write paths | 5–7 |
| `place` Edge Function and scheduling | 2–3 |
| Team Finder public view, admin user management | 2 |
| **Total** | **about 3–4 weeks** for one developer, before email, intake automation and responses |

## Open questions

- **Account ownership:** a BVAC-owned Supabase organization with the developer as a member (recommended), or the developer's own account for the pilot (DESIGN.md open question 17).
- **Cost:** who pays $25 a month during the season?
- **Retention:** does BVAC have a retention policy that should override the 2-year default?
