# 032 — Spread on the chart · Verification

| Task | Mechanism | Commands | Outcome | Evidence | Est | Actual |
|---|---|---|---|---|---|---|
| 1. [db] `showSpread` column + migration | prisma generate + build | `npx prisma generate`, `npm run build` (backend) | ✅ pass | Client generated, `tsc` clean. Migration `20261029000000_show_spread` adds `"showSpread" BOOLEAN NOT NULL DEFAULT false` | 0.25 | 0.1 |
| 2. [backend] `/settings` reads and writes `showSpread` | vitest + build | `npx vitest run src/routes/settings.test.ts`, `npm run build` | ✅ pass | 3/3 tests: absent → undefined (stored value kept), boolean accepted, non-boolean → `BadRequest` (400). GET returns `showSpread ?? false`; PUT writes it only when present. Deviation: there was no route test file, so the test covers `parseDisplay` (now exported) instead of a full GET/PUT round-trip against the DB | 0.5 | 0.25 |
| 3. [frontend] Settings › Display spread toggle | build + local check against the mockup | `npm run build`, eslint, local Vite against the production API | ✅ pass | Build and lint clean. User checked the new row under "Rectangle labels" (off by default, survives save + reload) against the mockup | 0.5 | 0.25 |
