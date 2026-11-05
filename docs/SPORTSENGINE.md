# SportsEngine research

Exported from the design doc's "SportsEngine research" tab, Nov 4, 2026. Findings came from search-engine copies of pages; verify before relying on them.

## Bottom line

SportsEngine is strong at collecting money, forms and waivers, and at running team pages and the app. It does almost nothing to decide *who goes on which team*. Its rostering tool is a manual drag-and-drop list filtered by birthdate and gender, with no idea of practice availability, requests, siblings or seniority. That gap is exactly where BVAC's hand work happens, and a companion tool can fill it without replacing SportsEngine.

- **Is SportsEngine worth it?** Yes, for what it does: payments, registration forms, waivers, website, team messaging. No, as a team-building tool. Admins and reviewers consistently describe the admin side as convoluted, reporting as weak, and support as slow.
- **Can we get the data out?** Yes, three ways. A Saved Report updates itself as people register and exports to CSV (manual click). An official API with org-approved access can pull registrations and their answers automatically. And BVAC can add structured custom questions to its form today.
- **Can we put results back?** Partly. Teams and game/practice schedules can be bulk-imported by CSV through Season Management. Putting each player on a team is still a drag-and-drop step in SportsEngine's rostering tool, unless the API allows roster writes (unconfirmed).
- **Recommended setup:** BVAC keeps SportsEngine for registration and payment and adds 7 structured custom questions. The companion pulls registrations (CSV at first, API later), builds and explains teams, lets coaches review, then hands back team and schedule CSVs.
- **Watch out:** PlayMetrics bought SportsEngine on May 1, 2026. Pricing and the product roadmap may change over the next year or two, so the companion should depend only on CSV exports and imports, with the API as an add-on.

## What BVAC runs today

BVAC is the [Blue Valley Activity Center](https://www.bvacsports.org/), a Christian-focused rec program sponsored by Community of Christ at 19404 E. Holke Rd., Independence, MO, with 6 soccer fields on site. It runs soccer, basketball, baseball and volleyball. The office is open weekdays 1–5pm, phone 816-796-8702.

- **Website:** the current site uses an older `Default.aspx?tabid=` page system and says BVAC is "switching web servers." A SportsEngine version of the site is staged at [bluevalleyactivitycenter.sportsengine-prelive.com](https://bluevalleyactivitycenter.sportsengine-prelive.com/), and an org page is at [sportsengine.com/org/bvac-sports](https://www.sportsengine.com/org/bvac-sports). So BVAC is mid-move to SportsEngine for both website and registration.
- **Soccer:** the [soccer information page](https://www.bvacsports.org/Default.aspx?tabid=615796) listed spring 2026 at $100 plus a transaction fee, ages 3 through 11th grade, deadline Feb 27, 2026. The soccer menu links to division schedules and a **Practice Chart**, so BVAC already publishes practice times per team after the fact. Fall 2026 games began Sep 12.
- **Form (from your screenshot):** five grade-based divisions (Div 1: ages 3–4 · Div 2: age 5/K · Div 3: 1st–2nd · Div 4: 3rd–4th · Div 5: 5th–6th), gender, shirt size, address, and one free-text **Request** box. That box is the only place for coach, friend, sibling and practice-night requests, so admins have to read and decode every one by hand.

The page details above come from search-engine copies; this session can't open bvacsports.org or sportsengine.com directly, so confirm dates and fees on the live site.

## Pricing

SportsEngine HQ costs about $800–$2,200 a year plus roughly 3.2–3.25% and $1–$2 per payment, usually passed on to families. That's the "transaction fee" on BVAC's $100 soccer fee. Published figures vary by source and date, and one 2026 report says pricing moved to custom quotes after the PlayMetrics deal.

| Plan | Subscription | Processing fee | Notes |
| --- | --- | --- | --- |
| Free tier | $0 | — | Website basics; one comparison says registration isn't included |
| Express | \~$799/yr or $79/mo | not stated | Entry paid tier |
| Premium | \~$1,299/yr or $129/mo | 3.25% + $1.50 (another SportsEngine page says + $2.00) | Registration, invoicing |
| Pro | \~$2,199/yr | 3.20% + $1.00 | Adds streaming, class/lesson management, affiliate connections |

**How it scales:**

- The subscription is a flat yearly price per organization, set by plan, not by number of players.
- The processing fee applies to each online payment: a percentage of that payment plus a flat fee per transaction. It is not a cut of BVAC's overall revenue, only of money paid online through SportsEngine.
- SportsEngine's own example at 3.25% + $2: a $100 registration paid in full costs $5.25. Split into 2 installments it's $7.25, and 3 installments $9.25, because each installment is its own transaction.
- BVAC chooses who pays: the family (a separate line at checkout, which is the "transaction fee" on BVAC's page), or BVAC (taken out of the weekly payout) ([processing fees](https://intercom.help/SportsEngine/en/articles/6310814-what-are-processing-fees-and-how-do-they-work), [who pays](https://intercom.help/SportsEngine/en/articles/6333339-how-to-change-who-pays-the-processing-fee)).

Other terms seen: a 90-day trial period then a 1-year contract, and an expectation of at least $1,000 in payments processed per year. Figures from [SportsEngine pricing pages](https://discover.sportsengineplay.com/solutions/pricing-and-bundling/), [Capterra](https://www.capterra.com/p/134125/SportsEngine/pricing), [Software Advice](https://www.softwareadvice.com/club-management/sportsengine-profile/) and [Waresport](https://www.waresport.com/blog/sportsengine-pricing-2026-hidden-fees-vs-waresport) (a competitor).

**For a rough sense of scale:** if 300 soccer kids pay $100 each, processing at 3.25% + $1.50 is about $1,425 a season, on top of the subscription. (300 kids is an illustration, not a BVAC figure.)

## What SportsEngine offers an organization

It covers the business side of a club well and the team-building side barely at all.

| Area | What it does | Gap for BVAC's problem |
| --- | --- | --- |
| Registration | Multi-page forms, household profiles ("Who are you registering?"), payments, fees, waivers. Custom questions: long text, checkbox (multi-select), radio, pulldown, date, with conditional logic | No ranked choices, no live seat counts per practice night, no linking of friend/sibling requests to other kids' records |
| Reports | Saved Reports that update as people register, exportable to Excel/CSV; custom-question answers can be included | Export is a manual click; no scheduled email of new sign-ups found |
| Rostering | Pull registrants into teams by filter (keyword, birthdate, gender, rostered status) and drag or assign | No awareness of availability, requests, siblings, seniority or team size targets |
| Season Management | Divisions, teams, Teams Import CSV, schedule import CSV, a "Generate Schedule" step | Practice slots aren't a first-class idea; schedules are built after teams exist |
| Tourney (separate product) | Facilities and availability, pools, round-robin matchups, batch scheduler, drag-and-drop | Built for tournaments; separate tool |
| Team pages and app | Rosters, schedules, messaging; coaches added to a roster get team admin access | Comes after placement |
| Website | Sitebuilder, which BVAC is moving to | — |

Sources: [Registration Builder help](https://help.sportsengine.com/en/articles/6380779-welcome-registration-builders), [question types](https://help.sportsengine.com/en/articles/8418009-getting-registrations-and-results), [rostering tool](https://help.sportsengine.com/en/articles/2876231-how-to-roster-using-the-rostering-tool), [registration reports](https://intercom.help/SportsEngine/en/articles/6402397-how-to-create-registration-reports), [schedule import](https://help.sportsengine.com/en/articles/9670909-season-management-schedule-import-tool), [Tourney setup](https://tourney-help.sportsengine.com/en/articles/8562876-tournament-setup-guide).

## How teams and schedules get built in SportsEngine

SportsEngine assumes the admin has already decided the teams; its tools record decisions rather than help make them. The usual sequence:

1. **Registration closes.** Admin opens a Saved Report and exports it, then reads every Request answer.
2. **Coaches.** Coaches complete their own registration (a separate staff form). Only people who registered through SportsEngine can be pulled into the rostering tool.
3. **Teams.** Admin creates teams in Season Management by hand or with the Teams Import CSV.
4. **Placement — the hand step.** In Rostering → Assign Players, the admin filters by birthdate or gender and drags players onto teams one by one. Moving a player means removing them from one roster before adding to another. By default a player can be on only one team per registration.
5. **Practices.** Entered as events per team, either one at a time or mass-uploaded as "standard events" by CSV. There's no step where families choose or see practice nights before placement.
6. **Games.** Built with the Generate Schedule step, the CSV schedule import, SportsEngine Tourney's round-robin and batch scheduler, or an outside tool like [Diamond Scheduler](https://cactusware.com/), which links to SportsEngine and uploads schedules back.
7. **Publish.** Families see their team, coach and schedule on the team page and in the app.

The matching decisions in step 4 — who wanted Tuesdays, who asked for which coach, which kids are siblings or friends, who played for whom last year — all happen in the admin's head or a side spreadsheet. That's the step the companion replaces.

One caution from the import docs: re-uploading a schedule CSV can replace *all* events previously uploaded by that tool unless the "ignore games before today" option is set ([SportsEngine](https://help.sportsengine.com/en/articles/6380725-schedule-upload-tutorial), [Cactusware](https://support.cactusware.com/sportsengine/how-to-export-your-schedule-via-csv-to-sportsengine)). The companion's export has to account for that.

## Exports and API

Registrations can come out as they arrive, by hand today and automatically with the API once a BVAC admin approves access.

| Path | How fresh | Effort | Status |
| --- | --- | --- | --- |
| Saved Report → CSV | As often as an admin clicks export (it always holds the latest sign-ups) | \~1 minute per export, then upload to the companion | Documented; works on any plan with registration |
| Registration confirmation emails | Each sign-up | Send SportsEngine's per-registrant results email to an inbox the companion reads | Documented setting; reading emails is less sturdy than the API |
| SportsEngine API | Every few minutes, automatic | One-time setup: BVAC admin approves the app's access | Documented; no published price or add-on found |
| Back into SportsEngine: Teams Import + Schedule Import CSVs | On publish | Admin uploads 2 files | Documented |
| Back into SportsEngine: player-to-team rosters | On publish | Drag-and-drop in rostering, or API if roster writes are allowed | Hand step unless the API supports it |

**About the API:**

- An app gets a Client ID and Client Secret from *API Settings* in a SportsEngine account. A BVAC admin signs in and approves data access for the organization, and the app gets that organization's grant ([Authenticating with SportsEngine](https://help.sportsengine.com/en/articles/8891727-authenticating-with-sportsengine)).
- Registrations and their "results" (each answer to each question, multi-select answers as lists) can be read. SportsEngine notes the registration holds a snapshot of profile data at sign-up time ([Getting Registrations and Results](https://help.sportsengine.com/en/articles/8418009-getting-registrations-and-results)).
- An older [Legacy API](https://dev.sportsengine.com/v1/Registration.html) also had a survey-results report built for bulk export.
- Other products already use this pattern: [TeamGenius](https://help.teamgenius.com/support/solutions/articles/69000864934-adding-players-from-sportsengine-new-) pulls registered players from SportsEngine for tryout evaluations.
- I found no webhooks (push notices on new sign-ups), so "live" means polling every few minutes.

**Is the API a paid add-on?** I found no add-on listing or price for it. Outside products that connect to SportsEngine, such as [TeamGenius](https://help.teamgenius.com/support/solutions/articles/69000864934-adding-players-from-sportsengine-new-) and [HorizonWebRef](https://helpcenter.horizonwebref.com/en/articles/6238985-setting-up-sports-engine-integration), have the club's admin switch the connection on in their own account, which suggests no extra fee for the club. SportsEngine has also announced a newer "Integrations API" for HQ ([announcement](https://sportngin.com/blog/admin-topics-product-release-internal-use-managing-operations/new-release-integrations-api)). The plan doesn't depend on it: alert emails and CSV exports cover everything, and the API only removes manual steps.

**Alerts on each sign-up:** yes, built in.

- **Admin alert:** each registration has an "email results to" field. Every address listed gets an email for each new registrant, with their answers. Older help pages also describe daily, weekly or monthly summaries ([help](https://help.sportsengine.com/en/articles/6380779-welcome-registration-builders), [community answer](https://community.sportsengine.com/topic/752-is-there-an-alert-for-new-registrations/)).
- **Auto notifications to families:** set on a Saved Report, sent right after registration or in a daily batch, and personalized with registration fields ([help](https://help.sportsengine.com/en/articles/6326177-how-to-send-auto-email-notifications-to-my-registrants)). This is how each family could get their own link to the preferences page.

**Export format:** Saved Reports export as Excel or CSV. The companion's import reads CSV only: export as CSV, or open the Excel file and save it as CSV. Excel upload is designed in [designs/04-intake.md](designs/04-intake.md) but not built.

**Questions for a BVAC admin to check in their HQ account:** Is *API Settings* visible on their plan? Can a Saved Report include every custom question? Does the rostering tool or API accept a roster upload?

## Reviews and complaints

Reviews are mixed. People like it for day-to-day club basics, and complain most about support, a confusing admin side and weak reporting. Your guess that it gets plenty of complaints holds up, though the samples are small (about 200 reviews on [Software Advice](https://www.softwareadvice.com/club-management/sportsengine-profile/reviews/)).

| Theme | What people say | Where |
| --- | --- | --- |
| Support | Hard to reach and slow; "Lots of promises but nothing works as advertised. Customer support is awful." | [Capterra](https://www.capterra.com/p/134125/SportsEngine/reviews/), Software Advice |
| Admin tools | Interface "somewhat convoluted and not user friendly"; "does not offer true report functionality" | Capterra |
| Notifications | Parents not getting emails; league integrations broken in the app | [App Store](https://apps.apple.com/us/app/sportsengine-team-management/id499597400?see-all=reviews&platform=iphone), [JustUseApp](https://justuseapp.com/en/app/499597400/sportsengine/reviews) |
| Billing and migrations | Billing trouble; "the new platform is completely worthless" | [BBB](https://www.bbb.org/us/mn/minneapolis/profile/digital-media/sportsengine-0704-1000003966/complaints) |
| Praised | "Beats every other league platform"; works well for everyday club management | Software Advice, Capterra |
| Scheduling at scale | Needs manual drag-and-drop rework; no constraint solving across divisions | A competitor's claim ([Fastbreak](https://www.fastbreak.ai/blog/sports-schedule-generator-guide)); not verified |

No review I found said SportsEngine helps admins match kids to teams by preferences. Clubs that need that tend to add another tool, such as TeamGenius for tryout-based placement or Diamond Scheduler for game schedules.

## Companion tool alongside SportsEngine

Yes, this can be built. SportsEngine stays the place families register and pay and where teams are published. The companion sits beside it and does the matching.

> *(Diagram in the online doc: Companion alongside SportsEngine · data in by CSV or API, teams and schedule back by CSV)*

The only step still done by hand in SportsEngine is putting each player on their team in the rostering tool. The companion turns that into copying from a sorted list instead of making decisions.

### Better SportsEngine questions BVAC can add now

These use SportsEngine's own question types, so they help even if the companion is never used. With them, the Saved Report carries everything the engine needs, and families don't need a second form.

1. **Practice days available** — checkbox: Mon, Tue, Wed, Thu, Fri.
2. **Are these the only days that work?** — radio: "Yes, only the days checked" / "No, they're preferences."
3. **Practice times available** — checkbox: 5:00–6:00, 6:00–7:00, 7:00–8:00. Once coaches claim slots, this becomes the real list ("Option A · Tue 5:30 · Field 2").
4. **Coach request** — pulldown: each coach, "Same coach as last season," "No preference."
5. **Player requests** — two pairs of fields: player name (text) + "Sibling or friend?" (radio).
6. **What matters most?** — pulldown: practice time / coach / friends / same team as last season. SportsEngine has no drag-to-rank, so a 1st and 2nd pulldown stands in for it.
7. **Seasons played at BVAC** — pulldown 0–5+, plus "Last season's coach" (text). Needed only until the companion has history to work from.

The existing **Request** box stays for anything else.

### Building the options into the SportsEngine form

BVAC controls the questions in its SportsEngine form; SportsEngine controls the layout and the checkout. I found no cap on the number of custom questions. Seven is my recommendation, not a SportsEngine limit.

- **Seat limits per team option.** A question's answer can carry an item with "Limit the total quantity to sell." So each team option ("Option A · Tue 5:30 · Field 2") can hold 12 seats, and the count drops as families pick it. Full options have to be hidden by hand, with a waitlist option added ([inventory](https://help.sportsengine.com/en/articles/6326243-how-to-create-or-update-inventory-on-a-registration), [waitlists](https://help.sportsengine.com/en/articles/6329354-how-to-create-a-wait-list-using-registration)). That gives first-come-first-served booking inside SportsEngine. Unconfirmed: whether the item can be $0.
- **Options by division.** Conditional logic can show only Division 3's team options to a family that picked Division 3.
- **Ranking.** A "1st choice" and "2nd choice" pulldown stand in for drag-to-rank. Put the seat limit on 1st choice only if BVAC wants first come, first served.
- **Handoff.** The text on the form's last page is editable, so it can say "Want to rank every option or check a friend request? Continue here," and the auto-notification email can carry the same link. Unconfirmed: whether SportsEngine lets that link be a clickable button.

### Where practice and game schedules live

- **Before teams exist:** SportsEngine has no idea of a practice slot. The slots live in the companion and appear in the SportsEngine form only as answer options. The companion can print the option list so the admin can paste it in.
- **After rosters are set:** games and practices import into Season Management by CSV, with practices as regular events tied to a team ("Division > Team"). They then show on team pages and in families' and coaches' app calendars ([schedule import](https://help.sportsengine.com/en/articles/9670909-season-management-schedule-import-tool)).
- **Changes:** re-importing practices means deleting the earlier events first, which [Diamond Scheduler's guide](https://support.cactusware.com/sportsengine/how-to-send-changes-to-practice-schedules-to-sportsengine) also does. The companion's export should list only what changed.

### What the preferences page adds

The optional page linked from the SportsEngine receipt adds what a SportsEngine form can't: true ranking of team options, live seats left per option, and requests checked against other registered kids ("We couldn't find 'Jake M.' — is this Jacob Martinez, Div 3?").

### Build stages

1. **CSV in and out.** Works on any plan; nothing needed from SportsEngine.
2. **Preferences page** linked from the receipt.
3. **API pull** every few minutes, after a BVAC admin grants access once.
4. **Roster write-back** through the API, if SportsEngine allows it. If not, a printable list by team to speed up the drag step.

## Sources

This session can't open bvacsports.org or sportsengine.com directly. Everything here comes from search-engine copies of these pages, so check anything you'll act on against the live page.

- BVAC: [home](https://www.bvacsports.org/), [soccer information](https://www.bvacsports.org/Default.aspx?tabid=615796), [contact](https://www.bvacsports.org/Default.aspx?tabid=350648), [SportsEngine org page](https://www.sportsengine.com/org/bvac-sports), [staged SportsEngine site](https://bluevalleyactivitycenter.sportsengine-prelive.com/)
- SportsEngine help: [Registration Builder](https://help.sportsengine.com/en/articles/6380779-welcome-registration-builders), [Registration Builder cheat sheet](https://help.sportsengine.com/en/articles/6325766-registration-builder-cheat-sheet), [registration reports](https://intercom.help/SportsEngine/en/articles/6402397-how-to-create-registration-reports), [exporting member data](https://help.sportsengine.com/en/articles/6310277-how-to-view-and-export-member-data), [rostering tool](https://help.sportsengine.com/en/articles/2876231-how-to-roster-using-the-rostering-tool), [Season Management rostering](https://help.sportsengine.com/en/articles/6345009-season-management-rostering), [Teams Import](https://help.sportsengine.com/en/articles/6342663-season-management-teams-import), [Schedule Import](https://help.sportsengine.com/en/articles/9670909-season-management-schedule-import-tool), [Schedule Upload](https://help.sportsengine.com/en/articles/6380725-schedule-upload-tutorial), [HQ CSV imports](https://help.sportsengine.com/en/articles/6634196-hq-csv-imports-uploads), [Tourney setup](https://tourney-help.sportsengine.com/en/articles/8562876-tournament-setup-guide)
- SportsEngine API: [API help collection](https://help.sportsengine.com/en/collections/6024309-sportsengine-api), [authentication](https://help.sportsengine.com/en/articles/8891727-authenticating-with-sportsengine), [registrations and results](https://help.sportsengine.com/en/articles/8418009-getting-registrations-and-results), [Legacy Registration API](https://dev.sportsengine.com/v1/Registration.html), [TeamGenius import guide](https://help.teamgenius.com/support/solutions/articles/69000864934-adding-players-from-sportsengine-new-)
- Pricing: [SportsEngine bundles](https://discover.sportsengineplay.com/solutions/pricing-and-bundling/), [Capterra pricing](https://www.capterra.com/p/134125/SportsEngine/pricing), [Software Advice](https://www.softwareadvice.com/club-management/sportsengine-profile/), [Waresport](https://www.waresport.com/blog/sportsengine-pricing-2026-hidden-fees-vs-waresport)
- Reviews: [Capterra](https://www.capterra.com/p/134125/SportsEngine/reviews/), [Software Advice](https://www.softwareadvice.com/club-management/sportsengine-profile/reviews/), [BBB](https://www.bbb.org/us/mn/minneapolis/profile/digital-media/sportsengine-0704-1000003966/complaints), [App Store](https://apps.apple.com/us/app/sportsengine-team-management/id499597400?see-all=reviews&platform=iphone), [JustUseApp](https://justuseapp.com/en/app/499597400/sportsengine/reviews)
- Ownership: [Versant press release](https://pressroom.versantmedia.com/versant-media/press-releases/playmetrics-acquires-sportsengine-versant), [Sports Video Group](https://www.sportsvideo.org/2026/05/04/playmetrics-acquires-sportsengine-from-versant/)
- Scheduling tools: [Diamond Scheduler](https://cactusware.com/), [Cactusware SportsEngine CSV guide](https://support.cactusware.com/sportsengine/how-to-export-your-schedule-via-csv-to-sportsengine)
