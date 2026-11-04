# Working on BVAC Team Builder

- Read `docs/BUILD_PLAN.md` first: it lists the tasks, which folders each owns, and the conventions. Product decisions are in `docs/DESIGN.md`; platform constraints are in `docs/SPORTSENGINE.md`.
- `pnpm check` (typecheck + Vitest) and `pnpm build` must pass before a PR.
- Contracts between packages are in `packages/core/src/contracts.ts`. Implement them exactly; change them only deliberately and note it in the PR.
- Determinism matters (the demo is prerendered and must hydrate identically):
  - Never use `Math.random()` or `Date.now()` in logic packages.
  - Never call the seeded `Rng` inside a sort comparator.
  - Sort strings with `compareStrings`, never `localeCompare`.
- If you change `packages/seed/src`, run `pnpm seed` and commit `packages/seed/data/`.
- All sample people are fictional (`example.com` emails, `555` phones). Never add real family or staff data.
- The web app's shared state is `apps/web/lib/season-store.tsx` (`useSeason()`). Keep changes there small and additive, because parallel tasks depend on it.
