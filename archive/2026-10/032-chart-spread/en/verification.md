# 032 — Spread on the chart · Verification

| Task | Mechanism | Commands | Outcome | Evidence | Est | Actual |
|---|---|---|---|---|---|---|
| 1. [db] `showSpread` column + migration | prisma generate + build | `npx prisma generate`, `npm run build` (backend) | ✅ pass | Client generated, `tsc` clean. Migration `20261029000000_show_spread` adds `"showSpread" BOOLEAN NOT NULL DEFAULT false` | 0.25 | 0.1 |
| 2. [backend] `/settings` reads and writes `showSpread` | vitest + build | `npx vitest run src/routes/settings.test.ts`, `npm run build` | ✅ pass | 3/3 tests: absent → undefined (stored value kept), boolean accepted, non-boolean → `BadRequest` (400). GET returns `showSpread ?? false`; PUT writes it only when present. Deviation: there was no route test file, so the test covers `parseDisplay` (now exported) instead of a full GET/PUT round-trip against the DB | 0.5 | 0.25 |
| 3. [frontend] Settings › Display spread toggle | build + local check against the mockup | `npm run build`, eslint, local Vite against the production API | ✅ pass | Build and lint clean. User checked the new row under "Rectangle labels" (off by default, survives save + reload) against the mockup | 0.5 | 0.25 |
| 4. [frontend] ASK and BID lines on the chart | build + local check (AC 1–6) | `npm run build`, eslint, local Vite against the production API | ✅ pass | Build and lint clean. User checked locally: ASK and BID lines with axis labels replace the current-price line and move with the ticks; turning the option off restores the single line. Deviation: ASK drawn in the same grey as BID (dashed vs dotted) instead of red, at the user's request; recorded in design.md | 1.5 | 0.75 |
| 5. [infra] Push and validate on production | manual (user validation) | push `fb76b1d..57813bd` (backend, migration applied), push `57813bd..70bc2ca` (frontend) | ✅ pass | User confirmed on production: Settings › Display toggle, ASK and BID lines on the chart moving with the price, single line restored when off, setting shared across devices | 0.5 | 0.25 |
| 6. [specs] Close the spec | manual | `git mv` to `archive/2026-10/` | ✅ pass | Est vs Actual recorded, status closed | 0.25 | 0.1 |

## Est vs Actual

**Total: 3.5 SP estimated · 1.7 SP actual.** Calibration: the `rectLabels` precedent (spec 025) made every layer a copy of a known pattern, so it took about half the estimate. Deviations: ASK drawn grey instead of red (user request); the backend test covers `parseDisplay` instead of a DB round-trip.
