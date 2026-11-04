# Demo script: 10 minutes for BVAC

A talk track for showing BVAC Team Builder to BVAC's soccer admins. It follows the in-app **Guided tour** (`/tour`), one section per step. Times are targets; skip a step if you're short.

**Before you start**
- Open the demo link on a laptop. A phone works, but the team board is easier to read on a big screen.
- Open `/tour` and press **Start fresh**. This clears anything you clicked while practicing.
- Have one more tab open on the admin dashboard (`/admin`).

**Framing (30 seconds).** "I'm a BVAC parent, not staff. I watched how much hand work goes into turning a stack of SportsEngine registrations and free-text requests into teams, so I built a companion tool. It doesn't replace SportsEngine: registration, payment and team pages stay there. Everything you'll see uses made-up families."

## 1. Coaches claim practice slots (1 min)

Coach view → sign in as a **new coach** → claim an open slot and schedule position.

- "Coaches pick their practice night and field first, in December. The moment a coach claims a slot, that team option exists, with its game times."
- "That's the key change: families see real nights *before* they register, instead of finding out in March."

## 2. Team Finder (1 min)

Team Finder → Division 3 → tick Tuesday and Thursday → open **See every game**.

- "This is the page BVAC would link from its soccer page and from the SportsEngine form. Every option shows the practice night, field, Saturday game pattern, coach and seats left."
- Point at a **Full · waitlist** chip: "Families know before they pay."
- Division 1 is first come, first served, and its banner says seats are held at registration. The older divisions say counts are estimates, because returning players get priority.

## 3. The SportsEngine form (1 min)

Register (mock) → fill a made-up child → 1st and 2nd choice → add a friend request → submit.

- "These are BVAC's current SportsEngine fields. Then there are seven structured questions SportsEngine already supports: practice days, whether those days are the only ones that work, 1st and 2nd choice team, coach request, sibling or friend requests, and what matters most."
- "That replaces the single free-text Request box that someone has to read and decode by hand."
- Watch the friend request match a registered kid. Then open the **team preferences** link: "This optional page lets a family rank every team that works for them."

## 4. Watch registrations arrive (1.5 min)

Admin dashboard → **Play from Jan 4** → let it run 10–15 seconds → pause.

- "This replays the sample season's registrations day by day. Teams build themselves as sign-ups come in."
- Read two lines from **What changed**: one kid placed on their 1st choice, and one flag.
- Point at **Teams vs needed** and the "Needs 1 more team; most-wanted nights: Tue and Thu" flag. "This is also a coach-recruiting message."

## 5. Team board (1.5 min)

Board → Division 3 → expand a kid card → drag a kid to another team.

- "Every placement says why: '1st choice · friend request met · returning with Coach Torres (+25) · priority 65'."
- "Priority follows BVAC's rules: early registration, seasons played, playing for this coach last season, siblings. They're all settings."
- After the drag: "The board tells you what the move breaks before you commit. Admins always have the last word."

## 6–8. Round 1, coach approval, publish (2 min)

Board → **Send round 1 to coaches** → Coach view as the D3 coach → **Approve** → back to the board → **Publish round 1**.

- "After the early deadline, round 1 holds the early registrants' teams in place and sends them to coaches."
- "Coaches see their roster forming and the reasons, but not guardian contacts until it's published."
- "Publishing makes it final for families. Later registrations never bump a published kid. Early families get certainty in February."
- Optionally show **Undo publish**.

## 9. Back into SportsEngine (1 min)

Admin → Exports.

- "When rosters are final, this hands SportsEngine what it needs: a teams CSV and a schedule CSV, including every practice and game, for Season Management. It also gives a printed list for the rostering tool."
- "The question pack is the exact text to paste into SportsEngine's registration builder."
- Be honest: "The column names are my best reading of SportsEngine's help pages. I'd adjust them in an hour once I can see a real export from BVAC's account."

## 10. Importing real exports (30 seconds)

Admin → Import → **Use the sample file** → **Add**.

- "This works with the Saved Report export BVAC can pull today. Re-imports never duplicate, and anything it can't read is listed by row."

## Close (30 seconds)

- "Everything is a setting: team sizes, protected picks, the sibling rule, how much seniority counts, and first come first served versus ranked choice per division."
- "It can run alongside your normal process for one division this spring. If you don't like what it suggests, you ignore it and nothing is lost."
- **The ask:** "Could I see one real SportsEngine export, even an old season's with names removed, and could we try it on one division?"

## Likely questions

| Question | Short answer |
| --- | --- |
| Does this replace SportsEngine? | No. Families still register and pay there, and teams still publish there. This decides the teams and hands over the files. |
| What does it cost? | Hosting is free to about $20/month. There are no per-player fees. |
| Where does family data live? | In the demo, only in your browser. In a pilot, in a small database BVAC controls, with coaches seeing only their own team. |
| What if a family's request can't be met? | It's flagged with the reason, and an admin decides. Nothing is silent. |
| Can we keep doing it by hand? | Yes. Run both for a season and compare. The Compare page shows side-by-side scenarios. |
| What about other sports? | Basketball is next. Same engine, different settings. |
