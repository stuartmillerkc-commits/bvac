# Audit log

A record of every manual change: who did what, when, and what it was before.

**Status:**
- **Not built.** `AuditEntry` is defined in `packages/core/src/types.ts` but nothing writes it.
- Moves on the board show a one-off "Moved Riley to Option C. Breaks: friend request" note, and "Undo last publish" keeps snapshots. Neither is a history.

**Recommendation:** database triggers that write every change to the tables that matter. Only a short reason is typed by hand, and only for publishes and overrides. Ranked first because it can't be skipped by a page that forgets to log.

## Why it matters

- **Trust:** when a family asks "why did my child move?", an admin can answer from the record.
- **Mistakes:** an admin can see and undo a wrong bulk action.
- **Accountability for overrides:** DESIGN.md says admins always have the last word, so their changes should be visible.

## Options, ranked

| Rank | Approach | Why |
| --- | --- | --- |
| 1 | **Postgres triggers** on `placements`, `registrations`, `teams`, `divisions.settings`, `coach_assignments` and `user_roles`. They write `audit_log(actor, table, row_id, action, before, after, at)`. | Complete by construction. Survives UI bugs. The actor comes from `auth.uid()`. |
| 2 | Application-level logging: each write path in the store also inserts a log row | Easier to make readable, but easy to miss a path. |
| 3 | Supabase's own logs | Not meant for this: short retention, technical format, not searchable by player. |

## Recommended design

- **Table:** `audit_log(id, at, actor_person_id, action, table_name, row_id, division_id, before jsonb, after jsonb, reason text)`. Admins and coordinators (for their division) can read it. Nobody can update or delete rows; only a retention job can remove them.
- **Readable labels:** a view turns raw rows into sentences using the same helpers as the board. For example:
  - "Jan 14, 3:02pm · Alex Admin moved Riley Sample from Option B to Option C (pinned)";
  - "Feb 13, 9:00am · Alex Admin published round 1 in Division 3 (29 kids)";
  - "Jan 20 · Coach Ortiz approved 4 players".
- **System changes:** engine re-runs, which change projected placements constantly, are **not** logged row by row; that would be noise. Logged instead: one "Engine run" summary per division per sync, and every change to a locked, proposed, approved or published placement.
- **Reason prompts:** an optional "Why?" box appears only on publish, undo publish, and moving a published kid. Example: "Family asked for Tuesday after a job change".
- **Where to see it:**
  - Admin → **History** (new tab), filterable by division, player and person;
  - on each kid card, a "History" link under "Why this team?".
- **Retention:** keep for 2 years, the same as contact data ([02](02-data-and-backend.md) "Privacy and safety").

**Single-admin mode:** keep a simple in-browser list of the same sentences in the backup file ([10](10-single-admin-pilot.md)), so the habit and the format carry over.

## Effort (rough)

| Piece | Days |
| --- | --- |
| Table, triggers, policies | 1 |
| Readable view and History tab | 2 |
| Reason prompt on publish and overrides | 0.5 |
| **Total** | **about 3–4 days**, after the backend |
