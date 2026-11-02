# 035 — Setup levels in mirror mode, level visibility and TP ratio shortcuts · Verification

| Task | Mechanism | Commands | Outcome | Evidence | Est | Actual |
|---|---|---|---|---|---|---|
| 1. [db] `setupLevels` column + migration | prisma generate + build | `npx prisma generate`, `npm run build` (backend) | ✅ pass | Client generated, `tsc` clean. Migration `20261101000000_setup_levels` adds `"setupLevels" TEXT[] NOT NULL DEFAULT ARRAY['ECC','EMA','EVL','MHL']` | 0.25 | 0.1 |
| 2. [backend] `/settings` reads and writes `setupLevels` | vitest + build | `npx vitest run src/routes/settings.test.ts`, `npm run build` | ✅ pass | 12/12 tests (4 new): absent → undefined, known keys deduplicated in canonical order, empty list accepted, unknown key / non-array → `BadRequest`. GET returns `setupLevels ?? the four keys`; PUT writes it only when present | 0.5 | 0.25 |
