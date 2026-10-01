# 008 · BE-11 — Backend tooling baseline

> Status: **closed**
> Origin: [backend audit 2026-09-30](../../../reports/2026-09-30-backend.md), improvement 11 (diagnosis G)

## Context

The backend has no linter, no formatter, no test runner and no `lint`/`typecheck`/`test` scripts; the only safety net is `tsc` (and, since spec 005, the CI `check` job that runs it). The frontend already standardised on ESLint 10 flat config + `typescript-eslint` 8 (no Prettier). Specs 004–007 verified every change with disposable scripts and manual smoke runs; the next audit items (BE-06 commands, BE-07 sizing, BE-09 bounded EMA queries) touch money-related calculations and deserve unit tests. Also, `tsconfig` does not flag unused locals/parameters, which hides a real leftover (`services/scanner.ts:78-79`).

## Affected layers

- backend
- infra (CI `check` job runs lint and tests)

## New dependencies (devDependencies, proposed)

| Package | Why |
|---|---|
| `eslint`, `@eslint/js`, `typescript-eslint`, `globals` | same stack and versions as the frontend; one convention for the monorepo |
| `vitest` | TypeScript tests without a build step; the frontend has no runner yet, so this sets the standard for both |

No runtime dependency changes.

## User stories

- As the developer, I want `npm run lint`, `npm run typecheck` and `npm test` in the backend, so that every change is checked the same way locally and in CI.
- As the developer, I want unit tests on the pure calculation modules, so that the upcoming changes to sizing, queries and indicators cannot silently alter their results.
- As the operator, I want CI to refuse a push whose lint or tests fail, so that the gate added in spec 005 covers more than types.

## Acceptance criteria

- AC 1. WHEN `npm run lint` runs in `backend/` THEN ESLint (flat config, `@eslint/js` recommended + `typescript-eslint` recommended, Node globals) checks `src/**/*.ts` and `scripts/*.ts` and exits 0 on `master` — pre-existing findings are fixed in this spec or, if behaviour-changing, listed as explicit `eslint-disable-next-line` with a reason.
- AC 2. WHEN `npm run typecheck` runs THEN `tsc --noEmit` passes with `noUnusedLocals` and `noUnusedParameters` enabled; the unused `lastSetup` / `candlesSinceCross` in `services/scanner.ts` are removed.
- AC 3. WHEN `npm test` runs THEN Vitest executes `src/**/*.test.ts` and passes; tests need no database, network or bridge files.
- AC 4. WHEN the first test suite is in place THEN it covers: `indicators/ema.ts` (known EMA values on a fixed series, warm-up nulls), `indicators/ema-cross.ts` (a synthetic bullish and bearish cross with their activation index, direction and levels), `services/sizing.ts` (EURUSD/USDJPY/GBPCHF with account EUR/USD, direct/inverse/missing conversion), `services/stats.ts` (a 3-month period with one deposit: netPnl, cashFlow, startBalance, monthly returnPct, curve length), `middleware/parse.ts` (the task-3 cases of spec 004), `middleware/loginLimiter.ts` (window, block, reset).
- AC 5. WHEN `package.json` is read THEN it declares `"engines": { "node": ">=20" }` and a `.nvmrc` with `20` exists; `npm start` is removed (pm2 uses the ecosystem file) or kept — decision in design.
- AC 6. WHEN the CI `check` job runs THEN it executes `npm run lint`, `npm run typecheck` and `npm test` after `prisma generate`, and the deploy job still depends on it.
- AC 7. WHEN all of the above is merged THEN `npm run build` output and runtime behaviour are unchanged (no production code change beyond removing dead locals and lint-driven fixes that preserve behaviour).

## Out of scope

- Prettier (frontend has none; a monorepo-wide formatting spec can follow).
- Frontend lint fixes (33 pre-existing problems — frontend audit).
- Tests for routes/DB (would need a test database); integration coverage stays with the smoke script.
- Upgrading Express or Prisma.
