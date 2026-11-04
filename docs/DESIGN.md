# BVAC Sports Sign-Up & Team Builder — Design Document

Exported from the living design doc: https://claude.ai/artifact/1TycDc28DEZiT5wQtvvNNN (Nov 4, 2026). The doc is the source of truth for product decisions; this copy is for coding sessions.

## Summary

BVAC Team Builder is a companion web app that takes in youth soccer registrations as they arrive, sorts kids into projected teams in real time, and gives admins and coaches a shared board to approve, adjust and publish rosters. The first target is Spring 2027 soccer. It runs alongside BVAC's current sign-up process, so admins can compare its suggestions to their usual hand-built rosters and drop it at any point with nothing lost.

The core idea is **schedule-first teams**. Before families register, coaches claim a practice slot ("Tuesday 5:30–6:30, Field 2") and a place in a pre-built game schedule. Families then see real team options at sign-up and rank them, along with coach, friend and sibling requests. A placement engine assigns kids using BVAC-set rules for seniority, siblings, early registration and team size, and it explains every placement it makes.

The tool does not pick one process for BVAC. Admins choose from five organizing models (below), and every rule — team size, number of coach picks, whether sibling grouping is mandatory, how much seniority counts — is a setting. Payments, waivers and medical information stay in BVAC's existing system.

**What it fixes:** hand-sorting a spreadsheet of free-text requests, families finding out late that practice night doesn't work, coaches with no view until rosters are final, and no consistent, explainable rule for who gets priority.

## Current process and how the tool coexists

BVAC is the Blue Valley Activity Center in Independence, MO, and it is moving its registration and website to SportsEngine. What SportsEngine can and can't do, its exports and API, pricing and reviews are in SportsEngine research.

**Today:** families register on SportsEngine. The soccer form asks for name, birthdate, one of five grade-based divisions (ages 3–4 through 5th–6th grade), gender, shirt size, address and one free-text **Request** box. Admins export the registrations and build teams by hand from those Request answers, then drag each player onto a team in SportsEngine's rostering tool. BVAC already publishes a Practice Chart per team, but only after teams are set.

**Coexistence plan — three ways in, picked per season:**

| Mode | How registrations arrive | What families see | Admin effort |
| --- | --- | --- | --- |
| Shadow | Admins upload the existing CSV export (daily or whenever) | Nothing new | Lowest; tool just suggests teams |
| Add-on form | Families register as usual, then the confirmation email or page links to a short BVAC Team Builder preferences form | Normal form + 3-minute preferences step | Low; records match on player name + birthdate + guardian email |
| Native | Full registration in this tool, payment link hands off to the existing platform | One combined flow | Medium; replaces the old preference questions |

In every mode the existing system stays the record for payments, waivers and refunds. Rosters export back as CSV in the column layout BVAC's platform imports. If admins don't like the results, they ignore the suggestions and build teams the old way — nothing in the tool blocks that.

**Recommended for Spring 2027:** add 7 structured custom questions to the SportsEngine form (listed in the research tab) and feed its Saved Report CSV into the tool. The preferences page is an optional extra for ranking and live seat counts.

## Recommended workflow with SportsEngine

Coaches build teams first, families pick teams that fit before paying, and everything stays tentative until admins publish. Three choices make it work: team choices are recorded *inside* the SportsEngine form, only paid registrations take a seat, and rosters publish twice (after the early deadline and after the regular one), not once at the end.

**Phase 1 — Teams take shape (December)**

1. *Admin, companion:* sets practice slots (night, time, field) and game tracks for each division.
2. *Coach, companion:* claims a practice slot and game track. That pair becomes a team option. The coach also completes BVAC's SportsEngine coach registration, which SportsEngine needs before it can roster them and run background checks.
3. *Admin, companion:* publishes the **Team Finder**, a public page with no login. Each team option shows its division, practice night and time, field, game-time pattern, coach and seats.

**Phase 2 — Families choose and register (January–March)**

4. *Family, Team Finder:* filters by division and the nights that work, and sees each team marked *open*, *filling* or *waitlist*. Linked from BVAC's soccer page and the first page of the SportsEngine form.
5. *Family, SportsEngine:* registers and pays. The form asks for 1st and 2nd choice team (dropdowns showing only that division's teams), days available and whether they're the only days, and up to 2 player requests marked sibling or friend.
6. *Companion:* picks up the registration within minutes (SportsEngine's per-registrant email to a companion inbox, or a CSV upload) and matches it to the player. The engine places the kid tentatively, and Team Finder seat counts update.
7. *Family, preferences page (optional):* the link on SportsEngine's last page and in its follow-up email lets families rank every team they could make work, say "any Tue/Thu team is fine," and confirm friend matches.

**Phase 3 — Tentative rosters and rounds**

8. *Admin and coaches, companion:* the board shows projected rosters as they fill. Coaches see their own roster and make protected picks. Families don't see projected placements.
9. *Early deadline → Round 1:* admin reviews, coaches approve or swap, admin publishes to early registrants. Families have 72 hours to accept or decline.
10. *Regular deadline → Round 2:* same steps for everyone else and for declines, then a priority-ordered waitlist.

**Phase 4 — Finalize in SportsEngine**

11. *Admin:* locks rosters. The companion exports a teams CSV and a schedule CSV (games plus practices), and the admin imports both in Season Management.
12. *Admin, SportsEngine:* rosters each player using the companion's sorted list, or by API if that turns out to be available.
13. *SportsEngine:* team pages and the app show each family their team, coach and full schedule.

**Why choices go in the SportsEngine form, not only in the companion**

- If a family picks teams in the companion and then never pays, the seat is held for nobody. Counting only paid registrations prevents that.
- If the companion is unavailable or dropped, admins still have every family's team choices in their own SportsEngine export.
- Families enter the core choices once. The preferences page only adds detail.

**How seats "fill" depends on the model.** In first come, first served, a 1st choice holds a seat at payment, and SportsEngine's seat-limit on that answer can enforce it. In ranked choice, seats show as estimates ("likely full"), because a returning player with higher priority can still take a spot. Team Finder says which rule a division uses.

## Goals, non-goals and principles

**Goals**

1. Families know their practice night and approximate game times before they commit.
2. Admins see projected teams update with each new registration, plus where demand outstrips coaches or slots.
3. Placement follows published, consistent rules, and each placement says why ("returning player with Coach Rivera; sibling kept together").
4. Coaches can watch their roster form, make their protected picks and approve or swap players.
5. Every rule is a setting, so BVAC can try different models without code changes.

**Non-goals for Spring 2027:** payments, waivers, medical forms, uniform ordering, referee scheduling, skill evaluations, and a mobile app (the site is mobile-friendly web).

**Principles**

- *Fallback-safe.* The tool never becomes the only copy of anything. Admins can export and walk away.
- *Admins have the last word.* The engine proposes; a person publishes. Any placement can be locked or moved by hand.
- *Stable once published.* Projected placements can reshuffle; published ones only change by explicit admin action.
- *Collect the minimum.* No data about kids beyond what team placement needs.
- *Explainable over optimal.* A slightly less "efficient" roster that admins can defend to a parent beats a black box.

## Users and roles

Four roles, all signing in by emailed magic link (no passwords to manage).

| Role | Can see | Can do |
| --- | --- | --- |
| Family (guardian) | Their own household's kids, open team options with seats left, their placement once published | Register, rank options, make requests, accept or decline a placement, join a waitlist |
| Coach | Projected roster for their own team; in their division, player names and request flags only | Claim slots and game times, make protected picks, approve or decline, answer admin choice requests, leave notes |
| Division coordinator | Everything in their division | Everything an admin can, limited to one division |
| Admin | Everything | Season settings, run and lock rounds, override placements, publish, export, manage users |

Coaches don't see guardian phone numbers or emails until rosters are published (setting). Assistant coaches get the coach role on a team without slot-claiming rights.

## Organizing models

Admins pick one model per division, so U6 could be first-come-first-served while U10 uses ranked choice. All five run on the same data, so switching models mid-season means re-running the engine, not re-collecting data.

| Model | How it works | Best when | Trade-off |
| --- | --- | --- | --- |
| **1. Ranked choice (recommended default)** | Coaches claim slots first. Families rank team options and factors. Engine places by priority rules in rounds. | Most divisions; enough coaches signed up early | Needs coaches committed before registration opens |
| 2. First come, first served | Families pick a team option with open seats, like booking a class. Full options show a waitlist. | Young divisions where requests matter less; simplest to explain | Rewards whoever registers first; friend groups scatter |
| 3. Coach selection | Coaches get protected picks, then draft in rotating order or approve a suggested list. | Older divisions with strong coach–player continuity | Slower; needs coach time; can look cliquey |
| 4. Availability clustering | No pre-built slots. Families give availability windows; engine finds the practice times that cover the most kids, then admins recruit coaches. | Coaches not known until late | Families can't see their team schedule at sign-up |
| 5. Hybrid | Coach protected picks → ranked-choice round 1 → coach approval → round 2 → waitlist | The full process from your notes | Most steps to run; best results |

**Recommendation:** Hybrid (5) for U8 and up, first come, first served (2) for the youngest division. Ranked choice is the hybrid's engine with the coach steps switched off, so admins can scale down if coaches don't engage.

**Team option labels.** Each team option shows a short code ("Option C") plus its real schedule ("Thu 6:00–7:00 · Field 3 · Games Sat 10–11am"). Letters are just display; admins can rename them, or hide coach names and show only times.

## Season timeline

Coaches commit to slots in December, so families see real team options when early registration opens. Early registrants are placed first; regular registrants fill the remaining seats in round 2.

> *(Diagram in the online doc: Spring 2027 season timeline · proposed dates)*

- **Early registration** is fully refundable until round 1 publishes. Families can change their rankings until the day after Meet the Coaches.
- **Round 1** places early registrants, filling teams to *preferred* size. Coaches review proposed rosters the week before it publishes. Families have 72 hours to accept or decline.
- **Round 2** places regular registrants and declines, filling to *max*. Anyone left goes to a priority-ordered waitlist.
- **Late registrations** (after Mar 7) go straight to the waitlist and are offered seats as they open.

## Family registration form

The form takes about 5 minutes per kid, and it saves a draft as the family goes. One household account covers all siblings, so sibling links are automatic.

**1. Player basics** — name, birthdate, school grade (sets the division, as BVAC does today), division gender if BVAC splits by gender, jersey size if wanted. Returning players are recognized by name + birthdate and their history fills in.

**2. Practice availability**

- A week grid: Mon–Fri plus weekends if used, each with a time range ("Tue 5:00–7:00").
- A **Required** toggle. On means "we can only do these days"; the engine never places the kid outside them. Off means "preferred." This is the only hard requirement families can set.
- If schedule-first is on, the grid is replaced (or supplemented) by the actual team options, each marked fits / doesn't fit for this family's grid.

**3. Team option ranking** — rank up to 4 options, or "any option that fits my days." Each option shows practice day, time, field, game time pattern, seats left (live) and, if BVAC allows, the coach.

**4. Requests**

- Coach request: pick from the coach list, or "returning to last season's coach."
- Player requests: up to 2 (setting). Each is marked **Sibling** or **Friend**. Siblings in the same household are listed automatically; others are typed and matched by name, with the admin confirming fuzzy matches. Mutual friend requests count more than one-way ones.
- Optional free-text note to the admin.

**5. What matters most to you** — drag to rank: practice time, coach, playing with friends, staying with last season's team. The family's ranking scales how much each factor counts for their kid only (details in the placement engine section).

**6. Volunteer** — willing to head coach / assist / team parent. Coach volunteers are routed to the coach sign-up.

**7. Review and submit** — shows the registration window (early vs regular), the refund deadline and when placements come out. In Add-on mode, steps 1 and 6 are skipped because the main form already has them.

## Coach sign-up and slot catalog

Coaches sign up about 4 weeks before families, so the team options exist when family registration opens.

**Admin sets up the catalog first**

- **Practice slots** per division: day, start–end, field, and how many teams that field can hold at once (e.g. "Tue 5:30–6:30, Field 2, 2 teams"). Admins can add slots later.
- **Game slots**: each game date × time × field ("Sat Apr 10, 9:00, Field 1").
- **Game tracks**: the pre-built schedule assigns each team position (Team 1, Team 2 …) a fixed set of game slots. A track is described in plain words: "mostly 9am, two 11am games."

**Coach flow**

1. Pick division(s), and mark own kids (they're locked to the coach's team).
2. Give practice availability and game-time constraints ("no 8am," "can't do Apr 24").
3. Claim a practice slot and a game track from what's open. Two coaches can't claim the same seat; a slot with room for 2 teams takes 2 coaches.
4. Optionally list protected picks (returning players, assistant coach's kids) up to the admin-set number.
5. Choose how much shows to families: name + times, or times only.

Once a coach claims a slot + track, that pair becomes a **team option** families can see and rank. If a division ends up with more kids than options can hold, the admin dashboard flags it ("U10 needs 2 more teams; Tuesday and Thursday are most requested"), which doubles as a coach-recruiting message.

## Placement engine

The engine uses the method many school districts use for school choice (deferred acceptance): families rank teams, each team ranks kids by BVAC's priority rules, and nobody gets bumped from a team they ranked higher by a kid with lower priority. It is fair, easy to explain, and families can't gain by gaming their rankings.

**Step 1 — Build placement units.** Siblings in the same division become one unit if "keep siblings together" is on (default: on, family can opt out). The coach's own kids and confirmed protected picks are locked to their team before anything else runs.

**Step 2 — Filter.** A unit can only go to a team in its division, with seats left, whose practice day is inside the family's days if they marked days Required.

**Step 3 — Order each family's choices.** The family's ranked options come first. Every other team that fits is ordered by a fit score:

```latex
\text{fit}(p,t) = \sum_{f} W_f \cdot a_{p,f} \cdot s_f(p,t)
```

where f is a factor (practice time, coach, friends, last season's team), W is BVAC's weight for that factor, a is the family's own ranking of the factor (1st = 4, 2nd = 3, 3rd = 2, 4th = 1), and s is how well team t satisfies it (0 to 1).

**Step 4 — Order each team's applicants by priority.** Points are per team, so a returning player has priority on *their coach's* team, not every team.

| Priority rule | Points (default) | Applies to |
| --- | --- | --- |
| Coach's own child / protected pick | Locked | That team |
| Registered in early window | +30 | Every team |
| Played for this coach last season | +25 | That coach's team |
| Played BVAC last season | +20 | Every team |
| Sibling already on this team (other division sibling, or unit opted out) | +20 | That team |
| Each earlier BVAC season | +5, max +25 | Every team |
| Each earlier season with this coach | +5, max +15 | That coach's team |
| Registration time | Tiebreak, earlier wins | Every team |

**Step 5 — Place.** Each unit applies to its top choice; each team holds its highest-priority applicants up to its cap and turns the rest away; turned-away units apply to their next choice. Repeat until settled. In round 1, teams fill only to *preferred* size so round 2 has room; round 2 fills to *max*.

**Step 6 — Friend pass.** The engine looks for swaps that put requested friends together without moving anyone to a team they ranked lower or breaking priority. Mutual requests are matched first.

**Step 7 — Checks and flags.** Teams under minimum, units with no fitting team (go to the waitlist with the reason, e.g. "only Monday available; no Monday U8 team"), and unmatched friend or coach requests.

**Every placement carries its reasons**, shown to admins and coaches: "1st choice · returning with Coach Lee (+25) · sibling kept together · friend request met."

**Alternative mode — maximize satisfaction.** Instead of priority-first, admins can ask the engine for the roster set with the highest total fit score, with priority as a weighted term. It may give more kids their top choice overall, but it's harder to explain to a family who got their 3rd choice. Offered as a side-by-side comparison, not the default.

### Live projections as registrations trickle in

- Each new or edited registration re-runs its division. At a few hundred kids this takes under a second.
- Placements have states: **Projected** (can move) → **Proposed** (sent to coach) → **Approved** → **Published** (fixed). Only Projected placements move on re-runs.
- Admins get a daily "what changed" summary: new kids, moves and why, new flags.
- Families don't see projected placements (setting). They see a live signal per option: *seats open / filling / likely full*.

### Key settings (per division)

| Setting | Default |
| --- | --- |
| Team size min / preferred / max | Set by division, e.g. U8: 8 / 10 / 12 |
| Number of teams | Suggested from registrations ÷ preferred size; admin sets |
| Coach protected picks | 2 plus own kids |
| Keep same-division siblings together | On (family can opt out) |
| Player requests per kid | 2 |
| Factor weights W | Practice time 40 · coach 25 · friends 20 · last team 15 |
| Priority points | Table above, each editable |
| Round 1 fill level | Preferred size |
| Show coach names to families | On |
| Show projected placements to families | Off |

## Admin console and coach view

### Admin console

- **Season dashboard** — per division: registrations (early / regular / waitlist), projected teams vs needed, seats left per option, and open flags. A day × time demand grid shows where families want practices that no team offers.
- **Team board** — one column per team with its practice slot, game track, coach and size bar (min / preferred / max). Kid cards show seniority badges, request icons (sibling, friend, coach) and their choice rank met (1st, 2nd …). Drag a card to move it; the board shows what that breaks ("friend request lost; 3rd choice"). Pin a card to lock it.
- **Compare view** — two scenarios side by side, e.g. ranked choice vs maximize satisfaction, or the engine's teams vs an imported hand-built roster. Shows % top choice met, requests met, team-size spread.
- **Rounds** — run round, review, send to coaches, publish. Each publish snapshots the rosters so admins can roll back.
- **Coach requests** — send a roster for approval, or send a specific choice: "Pick 2 of these 4 waitlisted players by Feb 20." Tracks who has answered and sends reminders.
- **Waitlist** — ordered by the same priority rules; offer a seat with a 48-hour accept window, then move to the next.
- **Messages** — email templates for placement published, waitlist offer, schedule change. Sent from the tool, or exported for BVAC's own email system.
- **Exports** — rosters, coach contact sheets, schedule, all as CSV and printable PDF.

### Coach view

- Their team's projected roster as it fills, with each kid's reasons and seniority.
- Approve the list, flag a kid for admin review, or propose a swap with another team (the other coach and admin both approve).
- Answer admin choice requests.
- See their practice slot, game track and full schedule.
- After publish: guardian contacts and a roster export.

## Game schedule builder

The game schedule is built before registration, using team positions (Team 1 … Team N) instead of real teams. A coach claiming a position inherits its games, so coaches and families know game times at sign-up.

**Inputs:** game dates, time slots, fields per time slot, planned number of teams per division, rainout makeup dates, and coach game-time constraints.

**How it builds**

1. Generates a round robin (each team plays each other team once, then repeats as weeks allow). An odd team count gets a bye each week.
2. Places each matchup into a date × time × field slot.
3. Balances times by the admin's chosen style:
   - *Rotating* — every team gets about the same mix of early and late games.
   - *Anchored* — each position has a home time ("mostly 9am") with a few games at other times.
4. Checks conflicts: a coach on two teams never has overlapping games; siblings in different divisions get back-to-back or same-time games at the same park where possible (soft rule).
5. Holds the last date(s) open for makeups.

**A trade-off to show admins:** fully fixed game times limit who a team can play. If only 2 fields run at 9am, the four "9am teams" can only play each other. Anchored with 2–3 off-time games per season is the recommended middle ground.

**If the team count changes** after families register (a slot cancels for low numbers, or a new coach is added), the builder re-generates only the remaining weeks and lists every game that moved, so admins can tell families before publishing.

**Tournament format (optional):** an end-of-season bracket can be pre-slotted the same way ("Semifinal 1, Sat May 22, 9:00, Field 1"), with seeds filled in from standings or set by admin. For young divisions, a jamboree day instead of a bracket.

## Data model

About 22 tables in Postgres. A player and household persist across seasons, which is what makes seniority automatic after the first season.

| Entity | Key fields | Notes |
| --- | --- | --- |
| Season | sport, name, registration windows, refund deadline, round dates | "Soccer · Spring 2027" |
| Division | season, age rule, gender, team size min/pref/max, model, settings | Settings stored as JSON per division |
| Field | name, park, address |  |
| PracticeSlot | division, field, weekday, start, end, team capacity |  |
| GameSlot | date, start, field |  |
| GameTrack | division, position number, description | Pre-built schedule position |
| Game | game slot, home position, away position | Positions, not teams, until claimed |
| Team | division, practice slot, game track, display label, status | A team option until rostered |
| Person | name, email, phone | Guardians and coaches |
| CoachAssignment | person, team, role (head/assistant), protected picks limit |  |
| CoachAvailability | person, weekday/time windows, blackout dates |  |
| Household | guardians, address (optional) | Links siblings |
| Player | household, name, birthdate, grade, gender | One record across seasons |
| PlayerHistory | player, season, team, coach | Imported for past seasons, automatic after |
| Registration | player, division, window (early/regular/late), submitted at, source (native/add-on/import), external id, status | External id links to BVAC's platform record |
| Availability | registration, weekday, start, end, required |  |
| Choice | registration, team, rank |  |
| Request | registration, type (sibling/friend/coach), target player or coach, match status |  |
| FactorRanking | registration, factor, rank |  |
| Placement | registration, team, round, state, locked, reasons, scenario | Projected → Proposed → Approved → Published |
| CoachTask | team, type (approve list / choose N), items, due, answer |  |
| AuditLog | who, what, when, before, after | Every manual move and publish |

## Integration, tech stack, privacy

### Integration with BVAC's intake

- **Import:** CSV upload with a column-mapping screen saved per platform, so the second import is one click. Re-importing updates existing records by external id and never duplicates.
- **Add-on link:** a per-family link (`…/prefs?ref=<registration id>`) that BVAC drops into its confirmation email. Without an id, records match on player name + birthdate + guardian email, and admins confirm the uncertain ones.
- **Export:** rosters in BVAC's platform import format, so published teams can live in the system families already use.
- **History seed:** import past seasons' rosters (even a messy spreadsheet) to fill seniority. Without it, families self-report seasons and admins verify.

### Tech stack (recommended)

| Layer | Choice | Why |
| --- | --- | --- |
| Web app | Next.js (TypeScript) | One codebase for family, coach and admin pages; mobile-friendly |
| Database + auth | Supabase (Postgres, magic-link email, row-level security) | Free tier covers a club this size; roles enforced in the database |
| Placement engine | TypeScript module, runs on the server per division | Under a second for hundreds of kids; unit-tested with sample seasons |
| Hosting | Vercel | Free or about $20/month |
| Email | Resend or the club's existing email | Placement and waitlist notices |
| Theme | Color, font and logo tokens | Swapped to match bvacsports.org once I can load it |

The app can live at a subdomain like `teams.bvacsports.org` and link to and from the main site, so it reads as part of it.

### Privacy and safety

- Data comes from guardians, not kids. Collect only name, birthdate, grade, division gender and guardian contacts — no medical, school or photo data.
- Coaches see their own team's roster and limited division info; contact details only after publish.
- Row-level security in the database enforces roles, not just the UI.
- Every manual change is in the audit log.
- Data retention: delete contact details for inactive households after 2 years; keep only player history needed for seniority.
- A short privacy notice on the form saying what's collected and who sees it.

## Rollout plan

The realistic path is a demo in December, a low-risk Add-on pilot for Spring 2027, and native registration no earlier than Fall 2027.

1. **Phase 0 — Demo (Nov–Dec 2026).** Working prototype loaded with a made-up season (about 300 kids, 4 divisions). Admin board, family form, coach view, and a side-by-side of models. *Gate:* BVAC agrees to try it.
2. **Phase 1 — Shadow + Add-on pilot (Spring 2027).** BVAC registers as usual; families get the preferences link; admins see suggested teams next to their own process. Coach sign-up and slot catalog used for 1–2 divisions. *Gate:* admins use at least one division's suggested rosters.
3. **Phase 2 — Full use (Fall 2027).** Every division, coach portal, game schedule builder, waitlist offers, seniority from Spring 2027 history.
4. **Phase 3 — Other sports and native registration.** Basketball, baseball etc. use the same model with sport-specific settings. Native registration only if BVAC wants it, with payment still handed to their platform.

At each gate BVAC can stop, and the export keeps everything they put in.

## Open questions

Each question has the default I'll build with unless you say otherwise. The first three only BVAC or you can answer; the rest are judgment calls.

| # | Question | Recommended default | Why it matters |
| --- | --- | --- | --- |
| 1 | Partly answered from your screenshot. Can you allow bvacsports.org and sportsengine.com in this session's network settings so I can read pages directly? | — | Style match and form fields |
| 2 | SportsEngine (answered). Can a BVAC admin see API Settings in HQ, and add custom questions to the soccer form? | Start with Saved Report CSV; API later | Shadow and Add-on modes depend on it |
| 3 | Are past rosters available (even spreadsheets)? | Self-reported seniority, admin-verified | Seniority rules need history |
| 4 | Divisions by birth year or school grade? | Grade, as BVAC's form does today (5 divisions); configurable | Sets who's eligible for which teams |
| 5 | Coed or split by gender, and at what age? | Configurable per division; coed through U8 in the demo | Affects divisions and team count |
| 6 | Practices per week? | 1 (2 as a setting) | A team option may need two slots |
| 7 | Does BVAC assign practice fields, or do coaches find their own? | BVAC assigns | If coaches find fields, slots become coach-entered |
| 8 | Games in-house only, or against other clubs? | In-house round robin | Other clubs means the schedule isn't ours to build |
| 9 | Siblings in the same division: always together? | Together unless family opts out | Hard vs soft rule |
| 10 | Coach protected picks? | 2 plus own kids | Coach continuity vs fairness to new families |
| 11 | Player requests per kid? | 2 | More requests means more chains that can't all be met |
| 12 | Show coach names to families at sign-up? | Yes | Coach requests need names; some clubs prefer times only |
| 13 | Can families decline a placement? | Yes, within 72 hours; they go to the round 2 waitlist | Keeps seats moving |
| 14 | Early registration: refundable until when, and does it cost more or less? | Refundable until round 1 publishes | Sets priority value of early sign-up |
| 15 | Skill balancing between teams? | Off (rec league) | If on, coaches would rate players, adding work and sensitivity |
| 16 | Default placement method? | Priority-first (deferred acceptance), with maximize-satisfaction as a comparison | Fairness vs total happiness |
| 17 | Who hosts it for the pilot, and who pays the \~$0–20/month? | You host; hand off if BVAC adopts | Data ownership and support |
| 18 | OK to use BVAC's name and logo in the demo? | Ask BVAC first; use a neutral theme until then | Avoids it looking official before it is |

**Next step I'd suggest:** I build the Phase 0 demo with a sample Spring 2027 season so you can show BVAC a working board, not just this document.
