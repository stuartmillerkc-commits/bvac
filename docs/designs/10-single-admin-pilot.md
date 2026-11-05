# Single-admin mode: a pilot with no backend

A way to run the Spring 2027 shadow pilot with real registrations without building the backend first.

**Recommendation:** build this first if BVAC agrees to a shadow pilot (DESIGN.md "Rollout plan", Phase 1). It's days of work, puts no family data on any server, and everything built for it carries over to the backend version.

## The idea

The demo already does almost everything an admin needs, entirely in the browser. CSV import, the engine, the board, rounds, Compare and the exports all work today. Real use is held back by three things:

1. The data is the fictional seed season, not BVAC's season.
2. Work lives only in one browser's `localStorage`, with no backup and no way to move to another computer.
3. Coaches and families can't take part. Acceptable for a *shadow* pilot, where admins compare the tool's suggestions with their usual process.

Single-admin mode fixes 1 and 2 and accepts 3.

## How it works

1. **A separate build at its own address,** e.g. `teams.bvacsports.org/admin-pilot/`, or a Cloudflare Pages project. It's the same static site with `NEXT_PUBLIC_MODE=pilot`. Nothing about it is secret: it contains no data. The data only ever exists in the admin's browser and backup file.
2. **Start a season.** The first screen offers "Start a new season" or "Open a backup file". A new season starts empty, not from the seed. The admin then:
   - enters season dates and divisions, or loads a small setup CSV (see "Setup" below);
   - adds fields, practice slots, coaches and teams;
   - imports registrations from SportsEngine CSV on Admin → Import, which is built today.
3. **Work as normal:** the board, rounds, Compare and exports. Coach approval is done by the admin on the coach's behalf (the admin's "Approve all as admin" already exists).
4. **Back up constantly:**
   - a **"Save backup"** button downloads `bvac-season-YYYY-MM-DD-HHmm.json` (the same `season.json` format as the full export, [05-exports.md](05-exports.md));
   - the header shows "Last backup: 2 hours ago", in warning color after 24 hours or after any publish;
   - **"Open a backup file"** restores everything on another computer, or after the browser is cleared.
5. **Share results without sharing access:** printed or PDF rosters for coaches (the existing print view) and the exports for SportsEngine.

## Setup

The demo's seed builds fields, practice slots, game dates and tracks in code (`packages/seed`). A real season needs a way to enter them. Options, ranked:

| Rank | Option | Effort |
| --- | --- | --- |
| 1 | **Setup CSV:** one small spreadsheet template with tabs or files for season dates, divisions, fields, practice slots and game dates. Load it, review on screen, edit later in Settings. | 3–4 days |
| 2 | **Setup screens:** forms for each entity | 6–8 days; needed eventually for live mode anyway |
| 3 | **Developer edits the seed config** for BVAC's real season | 1 day, but only a developer can change anything |

Rank 1 is quickest for an admin and reuses the CSV parser. The forms can follow with the backend.

## Privacy

- Family data stays on the admin's computer: in the browser's storage and in backup files.
- **Backups contain children's names and birthdates and guardians' contacts.** The save dialog says: "Store this file somewhere private, such as BVAC's shared drive. Don't email it."
- **Optional encryption:** "Protect with a passphrase" encrypts the JSON with the browser's Web Crypto (AES-GCM, key from PBKDF2), with no new dependency. Recommended, since files get copied around.
- **"Close season and clear this browser"** wipes `localStorage` after a final backup.

## What changes in the code

| Area | Change |
| --- | --- |
| `apps/web/lib/season-store.tsx` | A data-source switch: `demo` (seed + `localStorage`, unchanged) or `pilot`, which starts from an empty or loaded `SeasonData` instead of `generateSeason()`, stored under a different key. This is the same switch the backend needs later. Keep it small and additive (CLAUDE.md). |
| New: backup save and load | Serialize `SeasonData` + `DemoEdits`, with `schemaVersion` and an optional passphrase. Validate on load ("This file is from a newer version" / "This isn't a BVAC season file"). |
| New: setup CSV import | Parse with `@bvac/se-bridge`'s CSV helpers into `Season`, `Division`, `Field`, `PracticeSlot` and `GameSlot`, then review. |
| Header | Pilot mode: "BVAC Soccer · Spring 2027 · Last backup 2h ago · Save backup". No demo banner; instead "Pilot: data stays on this computer". |
| Pages hidden in pilot mode | Tour, Team Finder (no public data), mock registration, preferences (families can't reach it), and the coach "Sign in as" list (admin acts for coaches). |
| Tests | Playwright: save backup → clear storage → load backup → the board is identical. Unit tests for backup validation and the setup CSV. |

## Effort (rough)

| Piece | Days |
| --- | --- |
| Data-source switch and empty season | 2 |
| Backup save/load, with passphrase | 2 |
| Setup CSV and review | 3–4 |
| Pilot-mode header and hidden pages | 1 |
| Tests | 1–2 |
| **Total** | **about 2 weeks** |

## Limits, and when to move on

Single-admin mode stops fitting when:
- **more than one admin** needs to work at the same time (passing backup files around invites overwrites);
- **coaches should approve their own rosters,** or families should use the preferences page or respond to placements;
- **BVAC wants automatic intake** from the SportsEngine API.

At that point, move to [02-data-and-backend.md](02-data-and-backend.md). The backup file imports straight into the new database, so the pilot season's data, including published rosters, becomes the first live season's history.
