# Accepting or declining a placement, and waitlist offers

What happens after a round publishes: families confirm, decline, or get offered a spot.

**Status:**
- **Built:** publishing makes placements final (`published`), and later engine runs never move published kids (`components/admin/model.ts`, `RoundsPanel.tsx`).
- **Not built:** families can't respond to a placement. Waitlisted kids are listed in priority order on the board, but nobody is offered a spot when one opens.
- **Designed but unbuilt:** DESIGN.md calls for "accept or decline a placement, join a waitlist" for families, and Open question 13 recommends "Yes, within 72 hours; they go to the round 2 waitlist".

**Recommendation, ranked:**
1. **Silence means accept.** Families who do nothing keep their team. Only a decline needs an action. This puts the least burden on families, and seats stay predictable.
2. Explicit accept within 72 hours, with unanswered placements released. This is more accurate, but every family has to act, and missed emails cost kids their seats.
3. No responses at all: admins handle declines by phone or email. That's today's behavior, and fine for a shadow pilot.

## Why silence means accept

- In a rec league, nearly every family wants the team they got. Making about 300 families click "accept" to keep a seat creates work for the many to catch the few. It also creates real harm when an email lands in spam: a kid loses a seat for missing it.
- Declines are what free seats, so the design only needs to make declining easy and timely.
- It matches how SportsEngine already works: the family has registered and paid, and the placement is the club's decision.

## Recommended design

### States

A published placement gets a response status, stored in `placement_responses` (one row per registration per round):

| Status | Meaning |
| --- | --- |
| `none` | No response (default). Counts as accepted after the deadline. |
| `accepted` | Family pressed "Yes, we'll be there". Optional; gives the admin confidence. |
| `declined_team` | Wants a different team. Goes to the round 2 waitlist for their other choices, keeping their round 1 priority. |
| `withdrawn` | Not playing this season. Seat freed; BVAC handles any refund in SportsEngine. |

The response deadline is 72 hours after the notices are *sent* (not after publish, since sending may be held; see [06](06-email-and-notifications.md)). It's a division setting, `responseHours`, defaulting to 72, alongside the other `DivisionSettings`.

### Family side (`/preferences/`, signed in)

After publish, the top of the registration page shows:

> **Riley is on Option C: Tuesdays 5:30–6:30pm, Field 3, Coach Richardson.**
> Games are Saturdays, mostly 9am. [See every game]
> ✓ Nothing else to do. If this team doesn't work, tell us by **Fri Feb 16, 6pm**:
> [This night doesn't work: put us on the waitlist for another team] [We're not playing this season]

- Both buttons ask for confirmation: "Riley will lose the seat on Option C. Continue?"
- The decline asks which of their other ranked teams would work, and pre-fills from their choices.
- After the deadline, the buttons are replaced by "Need a change? Contact BVAC at …". Admins can still move kids by hand.

### Admin side

- The rounds panel's "Next step" note gains a response line after publish: "Responses: 4 declined, 1 not playing, 12 accepted, 131 no reply (deadline Fri 6pm)."
- The board shows a badge on declined kids ("Declined: wants another night") and on withdrawn ones. "What the labels mean" gets matching rows.
- A decline or withdrawal frees the seat immediately. The engine's next run fills it from the waitlist, following the division's rules.

### Waitlist offers

When a seat opens after publish, from a decline, withdrawal or admin move:

1. **The engine proposes the next waitlisted kid** whose availability fits that team. This is the existing priority order, already shown on the board.
2. **The admin sees an offer card:** "Option C has 1 open seat. Next on the waitlist: Maya Chavez (priority 62, fits Tue). [Offer seat] [Skip]". Offers are never sent automatically: a human confirms.
3. **"Offer seat"** creates an offer row, queues email 5 ([06](06-email-and-notifications.md)), and holds the seat for 48 hours (`offerHours` setting).
4. **The family accepts or passes** on the preferences page. If they accept, the placement becomes `published` on that team. If they pass, or the offer expires, the admin is prompted to offer the next kid.

Ranked alternative: auto-offer to the next kid with no admin step. It's faster, but a wrong offer is hard to take back. Revisit after a season of manual offers.

### Data

| Table | Columns |
| --- | --- |
| `placement_responses` | `registration_id`, `round`, `status`, `responded_at`, `responded_by` (person), `note` |
| `waitlist_offers` | `id`, `registration_id`, `team_id`, `offered_at`, `expires_at`, `status` (`open`, `accepted`, `passed`, `expired`), `offered_by` |

These are new types in `packages/core/src/types.ts`, added deliberately and noted in the PR. The engine contract doesn't change: declines and withdrawals feed the engine as `fixed` placements or `status: 'withdrawn'`.

## Effort (rough)

| Piece | Days |
| --- | --- |
| Tables, policies, types | 1 |
| Family response UI and confirmation steps | 2 |
| Admin response summary and board badges | 1–2 |
| Waitlist offer card, offer and expiry job | 2–3 |
| Tests (e2e: publish → decline → offer → accept) | 1–2 |
| **Total** | **about 1.5–2 weeks**, after the backend and email |

## Open questions for BVAC

1. Silence means accept (recommended), or explicit accept?
2. Is 72 hours the right window? Is 48 hours right for waitlist offers?
3. Does declining a round 1 team keep the family's early-registration priority in round 2? Recommended: yes, so declining isn't punished.
