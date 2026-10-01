# 008 · BE-11 — Backend tooling baseline · Tasks

Each task is one conventional commit. The project must build after every task. Backend and infra tasks never share a commit. Deploy order: one push at the end (backend deploy; no runtime change expected).

- [x] 1. [backend] Add devDependencies (`eslint`, `@eslint/js`, `typescript-eslint`, `globals`, `vitest`), `eslint.config.js`, `vitest.config.ts`, `.nvmrc`, `tsconfig.test.json`; `package.json` scripts (`typecheck`, `lint`, `test`, `test:watch`, drop `start`) and `engines`; `tsconfig.json` `noUnusedLocals`/`noUnusedParameters` + test exclude. Fix what lint/typecheck report (scanner leftover, `_` names, `// best effort` in empty catches) (AC 1, 2, 5). · **Verify:** `npm run lint`, `npm run typecheck`, `npm run build` all exit 0; `npm test` runs with "no test files" exit 0 (or `--passWithNoTests`); diff reviewed for behaviour changes · **Est:** 1.5 SP
- [x] 2. [backend] Tests for `indicators/ema.ts` and `indicators/ema-cross.ts` (characterisation) (AC 3, 4). · **Verify:** `npm test` green; the ema expectations are hand-computed in the test comments · **Est:** 1 SP
- [x] 3. [backend] Tests for `services/sizing.ts`, `middleware/parse.ts`, `middleware/loginLimiter.ts` (AC 4). · **Verify:** `npm test` green · **Est:** 1 SP
- [x] 4. [backend] Extract `services/stats-core.ts` (pure `computeStats`), keep `computeBrokerStats` as the DB adapter; test with the 3-month/1-deposit fixture (AC 4, 7). · **Verify:** `npm test` green; `npm run build`; local backend + `smoke.mjs diff` on `/stats?…from…to` identical to the baseline (re-capture the baseline on current `master` first if needed — it is from 2026-09-30) · **Est:** 1 SP
- [ ] 5. [infra] CI `check` job: `npm run lint`, `npm run typecheck`, `npm test` after `prisma generate` (AC 6). · **Verify:** YAML structure check; first real run in task 6 · **Est:** 0.25 SP
- [ ] 6. [infra] Push `master` → `check` (lint + typecheck + test) then `deploy`; VPS: pm2 online, `/health` 200, `/version` bumped; Node version on the VPS recorded (`node -v`) vs `engines`. **Validate on production**: Stats page for one broker with a date range matches the pre-deploy numbers (user) · **Verify:** manual (user validation + operator checks) · **Est:** 0.5 SP
- [ ] 7. [specs] Record Est vs Actual in `verification.md` (both languages), set `Status: closed`, archive under `archive/2026-10/`; fill the `Spec` column of BE-11 in the audit report. · **Verify:** manual · **Est:** 0.25 SP

**Total estimate**: 5.5 SP

Calibration: the audit sized BE-11 at 5 SP with ±50 % ("ESLint config may surface more than expected"); +0.5 for the `stats-core` extraction and its smoke check.
