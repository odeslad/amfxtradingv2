# 008 · BE-11 — Backend tooling baseline · Design

> Status: **approved**

## Approach

Mirror the frontend's lint stack, add Vitest, tighten `tsconfig`, add scripts and the CI steps — then write the first tests against pure modules only. Order: tooling first (so the tests are written against a linted codebase), tests second, CI last.

## 1. ESLint — `backend/eslint.config.js`

```js
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist', 'dist.prev', 'dist.next', 'node_modules', 'ecosystem.config.js']),
  {
    files: ['src/**/*.ts', 'scripts/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
]);
```

Same versions as the frontend (`eslint ^10.3`, `@eslint/js ^10.0`, `typescript-eslint ^8.59`, `globals ^17.6`). `ecosystem.config.js` is CommonJS and ignored. The `_`-prefix exception matches existing code (`_req`, `_maxAge`, `_next`).

Expected pre-existing findings (from the audit's `as`/`any` inventory): `no-non-null-assertion` is **not** in `recommended` (the `req.userId!` pattern stays); `no-explicit-any` has 0 real hits (the 3 `any` are in comments); likely hits are `no-unused-vars` (`scanner.ts` leftover, the `_` destructures) and `no-empty` on `catch {}` blocks (`commands.ts:50`, `index.ts:48`) — those get a one-line comment inside the block (`// best effort`), which satisfies the rule without changing behaviour.

## 2. TypeScript — `tsconfig.json`

Add `"noUnusedLocals": true, "noUnusedParameters": true`. `scripts/tsconfig.json` extends it and inherits both. Fix `services/scanner.ts:78-79` (delete `lastSetup` / outer `candlesSinceCross`; the inner `buildRow` computes its own).

## 3. Vitest — `backend/vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['src/**/*.test.ts'], environment: 'node' } });
```

Tests sit next to the module (`src/indicators/ema.test.ts`). `tsconfig.json` `include: ["src"]` already covers them; `exclude` gains `"src/**/*.test.ts"` so `tsc` (the production build) does not emit test files into `dist/`. ESLint lints them (they are `src/**/*.ts`); `vitest` globals are not used (explicit `import { describe, it, expect } from 'vitest'`).

## 4. Scripts and engines — `package.json`

```json
"scripts": {
  "dev": "tsx watch src/index.ts",
  "build": "tsc",
  "typecheck": "tsc --noEmit",
  "lint": "eslint .",
  "test": "vitest run",
  "test:watch": "vitest",
  "db:migrate": "prisma migrate deploy",
  "db:generate": "prisma generate",
  "db:studio": "prisma studio"
},
"engines": { "node": ">=20" }
```

`start` is removed: nothing calls it (pm2 uses `ecosystem.config.js`, dev uses `tsx`), and keeping a second way to start the app contradicts spec 005's single definition. `.nvmrc` = `20` (the CI job pins 20; the VPS runs whatever is installed — checked in task 7's verification).

## 5. Tests (AC 4)

Pure modules only; each test file builds its inputs inline.

| File | What it pins |
|---|---|
| `indicators/ema.test.ts` | `calculateEma` on `[1..10]` with period 3: first two `null`, then the hand-computed series (SMA seed then `α = 2/(n+1)`), length preserved. |
| `indicators/ema-cross.test.ts` | A 60-bar series that trends down then up: exactly one `buy` setup after the turn with `activationIndex` at the first bar where fast > slow, `levels.ECC` = that bar's close, `levels.EMA` between the two EMAs; mirrored series → one `sell`. Whatever `detectEmaCrossSetups` returns today is captured as the expectation **after** reading the implementation — these are characterisation tests, not a re-derivation. |
| `services/sizing.test.ts` | `calculateLots`: EURUSD, account USD, 1 % of 10 000, SL 20 pips → 0.5 lots; USDJPY account USD with USDJPY bid 150 → inverse conversion; GBPCHF account EUR with no CHFEUR/EURCHF tick → falls back to base (documents the audit's BE-07 finding as current behaviour); `Math.max(0.01)` floor; rounding to 2 decimals. |
| `services/stats.test.ts` | `computeBrokerStats` depends on `db` → extract the pure core into `services/stats-core.ts` (`computeStats(latest, trades, operations, from, to)`) and keep `computeBrokerStats` as the DB adapter. Test: 3 months, 4 trades, 1 deposit mid-period: `netPnl`, `cashFlow`, `startBalance = anchor − later movements`, `monthly[].returnPct` with the effective start rule, `curve.length` = days in period. This is the only production-code refactor of the spec; `computeBrokerStats` output stays byte-identical (verified with the smoke diff). |
| `middleware/parse.test.ts` | The 35 cases of spec 004 task 3 (ported from the scratch snippet). |
| `middleware/loginLimiter.test.ts` | `now` injection (the functions already accept `now`): 10 failures → not blocked, 11th → blocked, after `WINDOW_MS` → cleared, `clearFailures` resets. |

## 6. CI — `.github/workflows/deploy-backend.yml`

`check` job steps after `Prisma generate`: `npm run lint`, `npm run typecheck`, `npm test`. Build is unchanged (`deploy.ps1` still runs `tsc` on the VPS).

## Files to touch

- new: `backend/eslint.config.js`, `backend/vitest.config.ts`, `backend/.nvmrc`, six `*.test.ts`, `backend/src/services/stats-core.ts`
- `backend/package.json` (+ lockfile), `backend/tsconfig.json`, `backend/src/services/scanner.ts`, `backend/src/services/stats.ts` (adapter), lint-driven touch-ups
- `.github/workflows/deploy-backend.yml`

## Risks

- **`npm install` of ESLint 10 / typescript-eslint 8 on Node 24 locally vs 20 in CI**: both supported; the frontend already runs this stack.
- **`exclude` of test files from `tsc`** must not exclude them from `typecheck`: `tsc --noEmit` uses the same tsconfig → tests are not type-checked by it. Mitigation: Vitest type-checks nothing either; add `"typecheck": "tsc --noEmit && tsc --noEmit -p tsconfig.test.json"` with a tiny `tsconfig.test.json` that includes only tests. Decision: do it — it is two lines and keeps the tests honest.
- **`stats-core` extraction** is a refactor of money-reporting code: covered by the new unit test *and* by the smoke `diff` on `/stats` before deploy.
- **Lint fixes drifting into behaviour changes**: each fix is reviewed in the task-1 commit diff; anything non-mechanical gets a `disable-next-line` with a reason instead.
