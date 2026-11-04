# BVAC Team Builder

A companion tool for [BVAC](https://www.bvacsports.org/) youth sports that turns registrations into teams. Coaches pick practice nights first. Families see real team options before they register in SportsEngine. Teams then build themselves as registrations come in, following BVAC's rules for siblings, friends, seniority and team size, and admins and coaches review everything before it's final.

It is built to work **alongside SportsEngine**, not replace it: registration, payment and team pages stay there, and the tool imports registrations and hands back team and schedule files.

> Status: early demo with a made-up Spring 2027 soccer season. An independent proposal by a BVAC parent, not an official BVAC or SportsEngine product.

## Docs

- [Design](docs/DESIGN.md): the product, organizing models, placement rules, workflow, data model, open questions
- [SportsEngine research](docs/SPORTSENGINE.md): what BVAC's platform can and can't do, exports, API, pricing
- [Build plan](docs/BUILD_PLAN.md): tasks, conventions and prompts for building it
- [Sample season](packages/seed/data/SUMMARY.md): what's in the demo data

## Run it

Requires Node 22.12+ and pnpm 10 (`corepack enable`).

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm check      # typecheck + tests
pnpm build      # static site in apps/web/out
pnpm seed       # regenerate packages/seed/data after changing the generator
```

## Layout

| Path | What |
| --- | --- |
| `packages/core` | Domain types, settings defaults, time helpers, package contracts |
| `packages/seed` | Deterministic fictional season (5 divisions, ~300 kids, 27 team options) |
| `packages/engine` | Placement engine (stub until Task 1) |
| `packages/schedule` | Game schedule builder (stub until Task 2) |
| `packages/se-bridge` | SportsEngine import/export (stub until Task 3) |
| `apps/web` | Next.js static demo: Team Finder, mock SportsEngine form, preferences, admin, coach |
