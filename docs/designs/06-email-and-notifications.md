# Email and notifications

Which emails exist, who sends them, and how.

**Status:** the tool sends no email. The coach view shows guardian addresses as `mailto:` links after a roster is published.

**Recommendation, ranked:**
1. **Let SportsEngine send what it already can.** That's the confirmation email with the preferences link, at no build cost.
2. **Resend for the tool's own email,** sent from `teams.bvacsports.org`. That covers sign-in links, placement notices and admin alerts.

Every message is queued in the database and can be previewed and held by an admin.

## Which emails are needed

| # | Email | To | When | Sender | Needs the backend? |
| --- | --- | --- | --- | --- | --- |
| 1 | Registration confirmation, with "Continue to team preferences" | Guardian | Right after paying | **SportsEngine** (auto-notification on a Saved Report) | No |
| 2 | Sign-in link or code | Anyone signing in | On request | Tool (Supabase Auth via custom SMTP) | Yes |
| 3 | "Your roster is ready to approve" | Coach | Admin sends a round | Tool | Yes |
| 4 | "Team placement for Riley: Option C, Tuesdays 5:30" | Guardian | Admin publishes a round | Tool | Yes |
| 5 | "A spot opened on your waitlisted team: accept by Fri" | Guardian | Waitlist offer ([07](07-placement-responses.md)) | Tool | Yes |
| 6 | Reminder: "Please accept or decline by tomorrow" | Guardian | 24h before a response deadline | Tool | Yes |
| 7 | Admin alerts: "SportsEngine sync stopped", "3 families declined", "Coach flagged a player" | Admins | On event, or a daily digest | Tool | Yes |

**SportsEngine first.** Email 1 can be set up today, with no code. SportsEngine's Saved Report auto-notifications send each registrant a personalized email right after registration ([help](https://help.sportsengine.com/en/articles/6326177-how-to-send-auto-email-notifications-to-my-registrants)). The email links to `https://teams.bvacsports.org/preferences/`, where the family signs in with the same email ([03](03-accounts-and-roles.md)). Families already trust SportsEngine's emails, so this also avoids a new sender in their inbox at the moment they're most likely to act.

## Sending options for the tool's own email, ranked

| Rank | Service | Free tier | Fit |
| --- | --- | --- | --- |
| 1 | **Resend** | 3,000 emails a month, max 100 a day | Simple API and SMTP (Supabase Auth can use it as custom SMTP). Good deliverability. One custom domain on the free plan. Pro is $20/month for 50,000 emails, if a busy week ever needs more than 100 a day. |
| 2 | **Postmark** | 100 emails a month | Excellent deliverability for transactional email. Small free tier, so paid from the start (about $15/month). |
| 3 | **BVAC's own Google Workspace or Microsoft 365 mailbox via SMTP** | Included, if BVAC has it | Emails come from a familiar `@bvacsports.org` address. But daily sending limits, app passwords and shared credentials make it fragile. Fine for admin alerts only. |
| 4 | **Amazon SES** | About $0.10 per 1,000 | Cheapest at scale, but needs an AWS account, sandbox approval and more setup than this club needs. |
| — | **Supabase's built-in sender** | A few emails an hour | For testing only. Supabase limits it to a handful of emails per hour, and sign-in emails fail silently once the limit is hit ([guide](https://makerkit.dev/docs/next-supabase-turbo/going-to-production/authentication)). Custom SMTP is required for real use. |

**Volume check:**
- About 300 families × (1 placement notice + about 0.3 reminders), plus about 30 coaches × 2, plus sign-ins: roughly 600–900 emails a season.
- Publishing one round sends up to about 150 notices at once. That exceeds Resend's free 100-a-day cap, so the outbox throttles: it sends up to 90 a day, with the rest the next morning.
- Alternatively, use Resend Pro for the two publish weeks.

Pricing checked November 2026: [Resend pricing](https://resend.com/pricing). Re-check before committing.

## Recommended design

### Domain and deliverability

- Send from `notices@teams.bvacsports.org`, with replies to an address BVAC chooses (for example, the soccer coordinator).
- BVAC adds the DNS records Resend gives (SPF, DKIM) plus a DMARC record for the subdomain. That's about 15 minutes for BVAC's website admin. Without them, emails land in spam.
- Plain, short emails: text plus one link, no images, and BVAC's name and the season in the subject. "BVAC Soccer · Spring 2027: Riley's team" is far less likely to be filtered than marketing-style HTML.

### Outbox

- **Never send directly from a page.** Every email is a row in `email_outbox`:
  - `to`, `template`, `data` (jsonb), `status` (`queued`, `held`, `sent`, `failed`), `send_after`, `sent_at`, `error`;
  - `related_registration_id`, `related_round`.
- **An Edge Function, `notify`,** runs every minute. It sends queued rows whose `send_after` has passed, within the daily cap, and records each result.
- **Publishing a round queues the placement notices as `held`.** Admin → Exports (or the rounds panel) shows "148 placement emails ready. Preview · Send now · Send tomorrow at 8am". Nothing reaches families until an admin presses send. This is the confirmation step for families that [USABILITY_REVIEW.md](../USABILITY_REVIEW.md) item 18 notes publishing lacks: undoing a publish is easy, un-sending an email isn't.
- **Undo after send:** if an admin undoes a publish after notices went out, the panel says "Placement emails were already sent to 148 families. Send a correction?" and queues a correction template.

### Templates

- **Where they live:** templates are TypeScript functions in a small new package, `packages/notify`. Each takes `SeasonData` plus ids and returns `{ subject, text }`. They're pure and unit-tested, so wording can be checked in tests like the rest of the UI.
- **Wording:** plain words matching DESIGN.md. Every family email includes:
  - the child's name, team, practice night and field;
  - the coach's name (if the division shows coach names);
  - what to do next, with any deadline;
  - a "Questions? Reply to this email" line.

### Opt-out and frequency

Emails 2–6 are transactional (about the family's own registration), so they don't need an unsubscribe link. Still:
- No marketing.
- One email per event, with at most one reminder.
- Admin alerts can be set per admin to "as it happens" or "daily digest".

### Testing

- Template unit tests in `packages/notify`.
- Staging uses Resend's test mode, or a capture inbox, so no real family ever gets a staging email.
- An outbox Playwright test against staging: publish → held notices appear → "Send now" marks them as sent.

## Effort (rough)

| Piece | Days |
| --- | --- |
| Resend account, DNS, Supabase custom SMTP | 0.5 (plus BVAC's DNS step) |
| `email_outbox`, `notify` function, throttling | 2 |
| `packages/notify` templates and tests | 2 |
| Held-notices UI in the rounds panel | 1–2 |
| SportsEngine auto-notification setup (BVAC admin) | 0.5, no code |
| **Total** | **about 1–1.5 weeks** |

## Open questions

- Which BVAC address should replies go to?
- Does BVAC want copies of family notices (BCC to an archive address), or is the outbox record enough? Recommended: the outbox record. BCCs fill an inbox with children's details.
