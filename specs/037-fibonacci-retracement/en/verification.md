# 037 — Fibonacci retracement tool · Verification

## Task 1 · [db] `fibLevels` column + migration

- **Mechanism:** `prisma generate` + `prisma migrate deploy` on the production DB through the local tunnel (port 5434) + `prisma migrate diff`.
- **Commands:** `npx prisma generate` → ✓ · `npx prisma migrate deploy` → migration `20261106000000_fib_levels` applied, `migrate status` → "Database schema is up to date!" · `npx prisma migrate diff --from-url <db> --to-schema-datamodel prisma/schema.prisma` → "No difference detected." · `npm run build` (backend) → ✓.
- **Outcome:** ✅ pass on 2026-11-06. The column exists in production with its default; the deploy pipeline's `migrate deploy` will find nothing pending.
- **Est vs Actual:** 0.5 SP · 0.25 SP.
