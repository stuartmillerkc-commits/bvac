# Accounts, sign-in and roles

Who can sign in, how, and what each role can see and do.

**Status:** there are no accounts. The coach view uses a "Sign in as" dropdown with no password (`components/admin/CoachView.tsx`). Admin pages are open to anyone. The preferences page opens any registration from `?ref=<registration id>`. That's fine for fictional data and must not ship with real data.

**Recommendation:** Supabase Auth magic links (an emailed sign-in link, no passwords), with roles stored in a `user_roles` table and enforced by row-level security. Families reach the preferences page by signing in with the email they gave SportsEngine. Registration ids in links are not treated as secret.

This depends on [02-data-and-backend.md](02-data-and-backend.md) (Supabase) and [06-email-and-notifications.md](06-email-and-notifications.md) (custom SMTP, so sign-in emails arrive reliably).

## Roles

From [DESIGN.md](../DESIGN.md) "Users and roles", made concrete:

| Role | Granted by | Sees | Does |
| --- | --- | --- | --- |
| **Admin** | Another admin, or the setup script for the first one | Everything | Settings, import and export, rounds, publish, manage users |
| **Division coordinator** | An admin | Everything in their division(s) | Admin actions, limited to their division(s) |
| **Coach** (head or assistant) | Automatic when an admin assigns them to a team. Assistants can't claim slots. | Own team: players, reasons, requests, and guardian contacts once the roster is **published**. Same division: player names and request flags only. | Claim a slot (head only), approve the roster, flag or propose a swap, make protected picks |
| **Guardian** | Automatic: their email is on a household from an import or registration | Own household: kids, registrations, the published placement | Preferences page, confirm friend matches, accept or decline a placement |
| **Public** (not signed in) | — | Team Finder: team options and seat status, no personal data | — |

One person can hold several roles, such as a coach who is also a guardian. The UI shows the union of what their roles allow.

## Sign-in options, ranked

| Rank | Method | Why |
| --- | --- | --- |
| 1 | **Email magic link** | No passwords for volunteers to forget or reuse. Proves the person controls the email SportsEngine has on file, which is how guardians are matched to households. Built into Supabase. |
| 2 | **Email one-time code** (6 digits) | Same proof, and works when the link opens in the wrong browser (common on phones, where mail apps use an in-app browser). Supabase supports both, so offer the code as a fallback on the same screen. |
| 3 | **Google sign-in** | One tap for people with Gmail, but not everyone has Google, and the Google address must still match the email on file. Add later only if asked. |
| 4 | **Passwords** | More support burden (resets) and more risk. Not recommended. |

**Recommended:** magic link with a one-time code on the same email ("Click the link, or type this code: 482913").

## How each person gets in

- **Admins:** an admin types the person's email on a new **Admin → People** page. They're added to `user_roles` and get an invitation email. The first admin is created by a one-off setup script.
- **Coaches:** when an admin assigns a coach to a team, which already happens via `coach_assignments` and the coach slot claim, the coach's email gets the coach role. They sign in at `/coach/` with that email. The current "Sign in as" dropdown stays only in demo mode.
- **New coaches claiming a slot:** an admin invites them first (Admin → People → "Invite coach"). After signing in, they see the "Claim a practice slot" screen that exists today.
- **Guardians:**
  1. The SportsEngine confirmation email (sent by SportsEngine, see [06-email-and-notifications.md](06-email-and-notifications.md)) links to `/preferences/`.
  2. The page asks for their email and sends a sign-in link.
  3. Once signed in, it lists the registrations whose household includes that email. The registration picker already exists in `components/family/Preferences.tsx`, and it filters to their own registrations.
  4. If the email matches no household (they used a different email in SportsEngine), the page says so and asks them to use the email from their SportsEngine account. The admin can add a second email to the household.

**Why not a secret link per family?** A per-registration token link (`/preferences/?t=<random>`) would skip the sign-in step. But the tool would have to email each family its own link, because SportsEngine can't insert our token into its emails. And anyone a link is forwarded to gets access. Signing in with the email on file needs no email from us and is safer. Ranked second; revisit only if families find signing in too much friction.

## Enforcing it

- **Helpers:** SQL functions `is_admin()`, `coordinator_divisions()`, `coach_team_ids()` and `guardian_household_ids()` read `user_roles`, `coach_assignments` and `household_guardians` for `auth.uid()`.
- **Policies, for example:**
  - `registrations`: select if admin, or the division is in `coordinator_divisions()`, or the player's household is in `guardian_household_ids()`, or the registration's placement team is in `coach_team_ids()`.
  - `people` contact columns: exposed to coaches only through `coach_roster_contacts`, a view that joins `placements` with `state = 'published'`.
  - Division-mates for coaches: a `coach_division_players` view with first name, last initial and request flags only, which is what the coach view shows today.
  - `placements` updates by coaches: only `proposed` → `approved` on their own team, via an RPC (`approve_roster(team_id)`), never by a direct update.
- **Admin pages** check the role on load and show "You don't have access" otherwise. The database is what actually protects data; the page check is only for clarity.

## Pages to add or change

| Page | Change |
| --- | --- |
| `/sign-in/` (new) | Email box, then "Check your email": link or code. Remembers the page to return to. |
| Header | Shows the signed-in name with a sign-out link, and "Admin" only for admins and coordinators. |
| `/admin/people/` (new) | List of admins, coordinators and coaches; invite by email; change or remove a role. |
| `/coach/` | Live mode: the signed-in coach's teams. The demo keeps the dropdown. |
| `/preferences/` | Live mode: the signed-in guardian's registrations only. The `?ref=` link opens that registration only if it belongs to them. |

## Edge cases

- **Shared family email:** both guardians use one address. That's fine; it's one household.
- **Divorced or separated parents with separate SportsEngine accounts:** two households for the same player. The importer already matches players by name and birthdate. An admin can link the second guardian's email to the household (Admin → People → household).
- **A coach who leaves mid-season:** removing the team assignment removes access immediately, because policies are evaluated on every query.
- **Lost access to email:** an admin updates the person's email; the old sessions expire.

## Effort (rough)

| Piece | Days |
| --- | --- |
| Sign-in page, session handling in the store, header | 2 |
| Role helpers, policies and tests (shared with the backend work) | included in [02](02-data-and-backend.md) |
| Admin → People page and invitations | 2 |
| Coach and preferences live-mode changes | 2 |
| **Total** | **about 1 week** on top of the backend |

## Open questions

- Should coordinators exist in the pilot, or only admins? Recommended: admins only at first. The role is cheap to add later because the policies already take a division list.
- Can BVAC confirm the guardian email in SportsEngine is the one families actually read? If many families use a rarely checked address, Google sign-in moves up the ranking.
