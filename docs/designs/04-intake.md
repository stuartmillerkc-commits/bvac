# Getting registrations in

How registrations get from SportsEngine into the tool, and how they stay in sync.

**Status:**
- **Built: CSV upload on Admin → Import** (`components/admin/ImportPage.tsx`, using `packages/se-bridge`):
  - column mapping, with best guesses from the header names;
  - an import report that lists unreadable rows by row number;
  - re-imports update records in place and never duplicate, matching on the SportsEngine registration id, then player name and birthdate;
  - friend and sibling requests matched to registered kids.
- **Not built:** Excel (`.xlsx`) upload, the alert-email inbox, API polling, withdrawals.
- **Untested against real data:** nobody has seen a real BVAC Saved Report yet. Every header and answer wording is in `packages/se-bridge/src/formats.ts`, so adjusting to the real file is a one-file change.

**Recommendation, ranked:**
1. Keep CSV upload as the always-available path, and get one real BVAC export to tune `formats.ts`.
2. Add SportsEngine API polling once a BVAC admin can approve access.
3. Skip the email-inbox route unless the API turns out to be unavailable.

## Where registrations come from

Families keep registering and paying in SportsEngine. The tool never takes registrations or payments itself (DESIGN.md "Recommended workflow"). BVAC adds the structured questions to its SportsEngine form; the exact text is on **Admin → Exports → Question pack**. Those answers are what the tool imports.

## Options, ranked

| Rank | Route | Freshness | Admin effort | Depends on | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | **Saved Report CSV upload** | Whenever an admin exports | About 1 minute per export | Nothing; works on any SportsEngine plan with registration | **Built** |
| 2 | **SportsEngine API polling** | Every 5–15 minutes, automatic | One-time approval by a BVAC admin | Whether "API Settings" is visible on BVAC's plan (unconfirmed, [SPORTSENGINE.md](../SPORTSENGINE.md) "Exports and API"); the backend ([02](02-data-and-backend.md)) | Not built |
| 3 | **Alert-email inbox:** SportsEngine's "email results to" setting sends one email per registrant to an address the tool reads | Within minutes | One-time setting per registration form | An inbound-email service (e.g. Cloudflare Email Routing to a Worker, or Postmark inbound) and the backend | Not built |
| 4 | **Excel (`.xlsx`) upload** | Same as CSV | Same as CSV | A spreadsheet-parsing library | Not built |

API polling ranks above the inbox because it reads structured data from the source, and SportsEngine documents it ([Getting Registrations and Results](https://help.sportsengine.com/en/articles/8418009-getting-registrations-and-results)). Parsing emails breaks whenever SportsEngine changes its email layout.

Excel ranks last because SportsEngine's Saved Reports already export CSV. The only fix needed is the documentation: [SPORTSENGINE.md](../SPORTSENGINE.md) used to say "the companion takes either", but the upload only accepts `.csv`. Until `.xlsx` is supported, the import page should say "Export the Saved Report as CSV (in Excel: File → Save As → CSV)".

## 1. CSV upload (built): what's left

- **Tune to a real file.** Ask a BVAC admin for one Saved Report export, even an old season's with names removed. Update `formats.ts`, refresh the fixture, and check the column snapshots (the steps are in `packages/se-bridge/README.md`).
- **Saved mapping.** DESIGN.md calls for the column mapping to be saved, so the second import is one click. Today the mapping is guessed again on each upload; it usually matches, but should be remembered. With the backend, store it in a `import_mappings` row per season. In demo or single-admin mode, keep it in the backup file.
- **Withdrawals.** Today a registration that disappears from the report (refunded or cancelled) stays active. Add: rows missing from a full re-import are listed as "Not in this file: 3 registrations. Mark as withdrawn?", and the admin confirms. Never withdraw automatically from a file that might be filtered. Withdrawn registrations free their seat on the next engine run. `RegistrationStatus` already has `withdrawn`.
- **Import history.** In live mode, record each import in `imports`: who ran it, when, created, updated, skipped, and the issues. The import report then has a history list.

## 2. SportsEngine API polling (recommended next)

**Flow:**
1. **Admin → Import → "Connect SportsEngine".** This redirects to SportsEngine. A BVAC admin approves access for the organization, and the tool stores the grant. The client id and secret come from the developer's SportsEngine API Settings and live in Supabase secrets, never in the browser.
2. **A scheduled Edge Function, `se-sync`,** runs every 10 minutes during registration windows (from the season dates) and hourly otherwise. It fetches registrations changed since the last sync, along with their results (answers).
3. **Each result is converted to the same row shape the CSV parser produces** (`Record<header, answer>`) and fed through `importRegistrations(rows, mapping, existing)`. The matching, request resolution and issue reporting all stay in `@bvac/se-bridge`. The contract in `packages/core/src/contracts.ts` already takes rows, not a file.
4. **Imported registrations get `source: 'sportsengine-api'`.** The `place` function re-runs for touched divisions ([02](02-data-and-backend.md)), and Team Finder seat counts update.
5. **Admin → Import shows** "Last synced 4 minutes ago · 3 new, 1 updated", plus a "Sync now" button. Issues appear in the same report as a CSV import.

**Safety:**
- The sync only ever creates or updates. Withdrawals go through the same confirm step as CSV.
- If the API fails three times in a row, it emails the admins ([06](06-email-and-notifications.md)) and the Import page says "SportsEngine sync stopped: last success Jan 12, 4:10pm. Upload a CSV meanwhile." CSV upload always remains available.
- SportsEngine offers no webhooks (SPORTSENGINE.md), so "live" means polling. Ten minutes is plenty: placement isn't first-come-by-the-second except in first come, first served divisions, which use `submittedAt`, not import time.

**Effort:** 4–6 days, once API access is confirmed, plus a day of testing against BVAC's real organization with an admin present.

## 3. Alert-email inbox (fallback only)

If the API isn't available on BVAC's plan:
1. Set SportsEngine's "email results to" field to `intake@teams.bvacsports.org`.
2. Inbound mail goes to a Worker or Edge Function that extracts the answer table into the row shape above and calls `importRegistrations`.
3. Keep the original email for 30 days, for debugging.

It's fragile: the email layout isn't a documented format. So keep regular CSV uploads (say, weekly) as the source of truth that corrects any drift.

**Effort:** 3–4 days, plus ongoing upkeep.

## 4. Excel upload (low priority)

If admins struggle with "Save as CSV":
- read `.xlsx` in the browser with a small parser such as `read-excel-file`;
- load it only on the Import page, so other pages don't download it;
- convert the first sheet to the same rows.

This adds one runtime dependency, which needs a line in the PR (BUILD_PLAN.md conventions). **Effort:** 1 day.

## Other data that comes in

| Data | How | Status |
| --- | --- | --- |
| Coaches and practice slots | Coach view: an admin invites the coach, and they claim a slot ([03](03-accounts-and-roles.md)) | Built (demo) |
| Family preferences, friend confirmations | Preferences page | Built (demo) |
| Past rosters (seniority) | History import ([09-player-history.md](09-player-history.md)) | Not built |
| Fields, practice slots, game dates | Admin setup. Today they come from the seed; live mode needs a setup screen or a one-time CSV. | Not built: see the [index](README.md) "Not covered yet" |

## Open questions for BVAC

1. Is **API Settings** visible in BVAC's SportsEngine HQ? (Decides between options 2 and 3.)
2. Can a Saved Report include every custom question? (Needed for option 1.)
3. May we have one real export, with names removed?
