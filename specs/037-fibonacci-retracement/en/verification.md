# 037 — Fibonacci retracement tool · Verification

## Task 1 · [db] `fibLevels` column + migration

- **Mechanism:** `prisma generate` + `prisma migrate deploy` on the production DB through the local tunnel (port 5434) + `prisma migrate diff`.
- **Commands:** `npx prisma generate` → ✓ · `npx prisma migrate deploy` → migration `20261106000000_fib_levels` applied, `migrate status` → "Database schema is up to date!" · `npx prisma migrate diff --from-url <db> --to-schema-datamodel prisma/schema.prisma` → "No difference detected." · `npm run build` (backend) → ✓.
- **Outcome:** ✅ pass on 2026-11-06. The column exists in production with its default; the deploy pipeline's `migrate deploy` will find nothing pending.
- **Est vs Actual:** 0.5 SP · 0.25 SP.

## Task 2 · [backend] `fibLevels` in `/settings`

- **Mechanism:** `npm run build` + vitest on `parseDisplay` (replaces the curl checks of `tasks.md`: same cases, repeatable) + a read of the production row through the generated client.
- **Commands:** `npm run build` → ✓ · `npx vitest run src/routes/settings.test.ts` → 16 passed (new: catalogue values deduplicated and ordered; `[61.8]` → `[0, 61.8, 100]`; `[]` → `[0, 100]`; `[33]`, `['50']` and a non-array → `BadRequest`) · Prisma `findFirst` on `settings_display.global` → `fibLevels: [0, 23.6, 38.2, 50, 61.8, 78.6, 100]`.
- **Outcome:** ✅ pass on 2026-11-06.
- **Est vs Actual:** 0.75 SP · 0.5 SP.
