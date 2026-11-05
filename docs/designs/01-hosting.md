# Hosting

Where the web app lives, and at what address.

**Status:** the demo is live on GitHub Pages at <https://stuartmillerkc-commits.github.io/bvac/>, deployed by `.github/workflows/pages.yml` on every push to `main`.

**Recommendation:** keep GitHub Pages for the demo. For a pilot with real data, move the site to Cloudflare Pages at `teams.bvacsports.org`.

## What the app needs from a host

`pnpm build` produces a plain static site in `apps/web/out`: HTML, JS, CSS, the font files and `icon.svg`. Next.js runs with `output: 'export'` (see `apps/web/next.config.ts`), so there is no server code to run. The backend in [02-data-and-backend.md](02-data-and-backend.md) stays a separate hosted service (Supabase), called from the browser. Any static host works, so the choice comes down to cost, terms of use, and a few practical features:

- a custom domain with HTTPS (`teams.bvacsports.org`);
- a preview link for each pull request, so changes can be checked before they go live;
- custom response headers (a Content Security Policy, `X-Frame-Options`) once real family data is involved;
- terms that allow use by a club, which may count as "commercial".

## Options, ranked

| Rank | Host | Cost | Fit |
| --- | --- | --- | --- |
| 1 | **Cloudflare Pages** | Free | Unlimited static bandwidth. 500 builds a month. Custom domains, PR previews and a `_headers` file for security headers. No non-commercial restriction found. |
| 2 | **GitHub Pages** (current) | Free | Already working, with zero extra setup. No custom headers, so no Content Security Policy beyond a `<meta>` tag. No PR previews. Its terms rule out sites "primarily directed at … commercial transactions or … SaaS", which a club tool isn't, but it's a grey area worth avoiding for real data. |
| 3 | **Netlify** | Free tier, credit-based | Good developer experience, previews and headers. Since 2025 the free plan is 300 credits a month, and sites pause when credits run out. That's roughly 15 GB of bandwidth at the April 2026 rate. Workable, but a hard cap is a risk during registration week. |
| 4 | **Vercel** | Free (Hobby) or $20 per member per month (Pro) | The natural home for Next.js. The Hobby plan is limited to "non-commercial personal use", and a club's registration tool is arguably not personal, so the honest choice is Pro. That cost buys nothing this static site needs. |

Cloudflare ranks first because it's the only free option with unlimited bandwidth, security headers and previews, and no usage terms that could bite a club. GitHub Pages is a close second for the demo, because it already works.

Prices and terms checked November 2026: [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits), [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), [Netlify April 2026 pricing update](https://www.netlify.com/changelog/2026-04-14-pricing-updates-april-2026/), [Vercel fair use guidelines](https://vercel.com/docs/limits/fair-use-guidelines). These change often, so re-check before committing.

## Recommended setup (Cloudflare Pages)

1. **Project:**
   - connect the GitHub repo in the Cloudflare dashboard;
   - build command: `pnpm install --frozen-lockfile && pnpm build`;
   - output directory: `apps/web/out`;
   - Node version from `.nvmrc`.
   - Leave `NEXT_PUBLIC_BASE_PATH` unset: the site is served at the root.
2. **Domain:** BVAC adds one CNAME record, `teams.bvacsports.org` → `<project>.pages.dev`. Until then, the `*.pages.dev` address works.
3. **Environment variables:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, once the backend exists. Both are public by design; the database's row-level security is what protects data.
4. **Headers:** add `apps/web/public/_headers`. It's copied to `out/` and covers:
   - a Content Security Policy that only allows the site itself and the Supabase project URL;
   - `X-Frame-Options: DENY`;
   - `Referrer-Policy: strict-origin-when-cross-origin`;
   - `Permissions-Policy` with camera, microphone and geolocation off.
5. **Previews:** keep them on, but point them at a separate Supabase *staging* project with fictional data. Real data is reachable only from production.
6. **CI:** keep `.github/workflows/ci.yml` as the gate (typecheck, tests, build, Playwright). Cloudflare only deploys.

**Keep the demo separate.** It should stay a static site with the fictional season and no backend, so it can be shown to anyone. Either keep it on GitHub Pages, or deploy it as a second Cloudflare project from the same repo with a build flag such as `NEXT_PUBLIC_MODE=demo`. Real BVAC data must never be reachable from the demo's address.

## Work involved

| Step | Effort | Who |
| --- | --- | --- |
| Cloudflare project, previews, `_headers` | Half a day | Developer |
| Demo/production build flag | Half a day (comes with the backend work) | Developer |
| DNS record for `teams.bvacsports.org` | 10 minutes | BVAC's website admin |

## Open questions

- Who owns the Cloudflare account? Recommended: an account under a BVAC email, with the developer invited, so BVAC keeps the site if the volunteer moves on.
- Does BVAC's website admin control DNS for `bvacsports.org`, or does SportsEngine? If SportsEngine hosts the main site, a subdomain CNAME is usually still possible, but confirm.
