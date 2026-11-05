# BVAC Team Builder

A companion tool for [BVAC](https://www.bvacsports.org/) youth sports that turns registrations into teams. Coaches pick practice nights first. Families see real team options before they register in SportsEngine. Teams then build themselves as registrations come in, following BVAC's rules for siblings, friends, seniority and team size, and admins and coaches review everything before it's final.

It is built to work **alongside SportsEngine**, not replace it: registration, payment and team pages stay there, and the tool imports registrations and hands back team and schedule files.

> Status: working demo with a made-up Spring 2027 soccer season. An independent proposal by a BVAC parent, not an official BVAC or SportsEngine product.

**Live demo: https://stuartmillerkc-commits.github.io/bvac/** (start with the [guided tour](https://stuartmillerkc-commits.github.io/bvac/tour/)). Everything runs in your browser; changes you make are saved only on your device.

## Docs

- [Design](docs/DESIGN.md): the product, organizing models, placement rules, workflow, data model, open questions
- [SportsEngine research](docs/SPORTSENGINE.md): what BVAC's platform can and can't do, exports, API, pricing
- [Demo script](docs/DEMO_SCRIPT.md): a 10-minute talk track for showing it to BVAC
- [Build plan](docs/BUILD_PLAN.md): tasks, conventions and prompts for building it
- [Design docs: from demo to real use](docs/designs/README.md): hosting, data and backend, sign-in, intake, exports, email, family responses, audit log, history and a single-admin pilot, each with ranked options
- [Sample season](packages/seed/data/SUMMARY.md): what's in the demo data

## Run it

Requires Node 22.12+ and pnpm 10 (`corepack enable`).

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm check      # typecheck + tests
pnpm build      # static site in apps/web/out
pnpm e2e        # Playwright smoke + accessibility tests against apps/web/out (run pnpm build first)
pnpm seed       # regenerate packages/seed/data after changing the generator
```

The first time you run `pnpm e2e`, install the browser with `pnpm --filter @bvac/web exec playwright install chromium`.

## Deploy

Pushing to `main` builds the static site with the repo's base path and publishes it to GitHub Pages (`.github/workflows/pages.yml`). One-time setup: in the repo's **Settings → Pages**, set **Source** to **GitHub Actions**.

## Layout

| Path | What |
| --- | --- |
| `packages/core` | Domain types, settings defaults, time helpers, package contracts |
| `packages/seed` | Deterministic fictional season (5 divisions, ~300 kids, 27 team options) |
| `packages/engine` | Placement engine: priority-first deferred acceptance, sibling units, friend pass, reasons and flags |
| `packages/schedule` | Game schedule builder: round robin by schedule position, time balancing, conflict checks |
| `packages/se-bridge` | SportsEngine bridge: Saved Report import, Teams/Schedule import CSVs, roster list, question pack |
| `apps/web` | Next.js static demo: tour, Team Finder, mock SportsEngine form, preferences, coach view, admin (dashboard and replay, board, rounds, compare, settings, import, exports) |
| `apps/web/e2e` | Playwright smoke tests: every page (desktop, phone, dark mode), axe accessibility, key flows |
