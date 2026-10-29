# 032 — Spread on the chart · Verification

| Task | Mechanism | Commands | Outcome | Evidence | Est | Actual |
|---|---|---|---|---|---|---|
| 1. [db] `showSpread` column + migration | prisma generate + build | `npx prisma generate`, `npm run build` (backend) | ✅ pass | Client generated, `tsc` clean. Migration `20261029000000_show_spread` adds `"showSpread" BOOLEAN NOT NULL DEFAULT false` | 0.25 | 0.1 |
