# 035 — Setup levels in mirror mode, level visibility and TP ratio shortcuts · Verification

| Task | Mechanism | Commands | Outcome | Evidence | Est | Actual |
|---|---|---|---|---|---|---|
| 1. [db] `setupLevels` column + migration | prisma generate + build | `npx prisma generate`, `npm run build` (backend) | ✅ pass | Client generated, `tsc` clean. Migration `20261101000000_setup_levels` adds `"setupLevels" TEXT[] NOT NULL DEFAULT ARRAY['ECC','EMA','EVL','MHL']` | 0.25 | 0.1 |
