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

## Task 3 · [frontend] `fib` drawing kind in `DrawingTools.ts`

- **Mechanism:** `npm run build` + manual on the local stack (Vite 5174 → backend 3001 → production DB through the tunnel).
- **Commands:** `npx tsc --noEmit` → ✓ · `npm run build` → ✓ built.
- **Outcome:** ✅ pass on 2026-11-07. The user drew a Fibonacci on the local chart: levels between the anchors with `pct  price` labels, dashed anchor segment, orange handles when selected, trendline style/colour from Settings applied. Two visual changes agreed on the spot and recorded in requirements/design: no solid style for 50 / 61.8 (every level in the trendline style) and every label in the bright text colour. Drag, duplicate, colour cycle, delete, lock, timeframe switch and reload are re-checked in production (task 6).
- **Est vs Actual:** 2.5 SP · 1.5 SP.

## Task 4 · [frontend] Fibonacci tool exposed in the toolbar

- **Mechanism:** `npm run build` + manual on the local stack.
- **Commands:** `npm run build` → ✓ built.
- **Outcome:** ✅ pass on 2026-11-07. `IconFib` after the rectangle, active state while drawing; the user created a Fibonacci from it. Mobile Draw row and split view re-checked in production (task 6).
- **Est vs Actual:** 0.75 SP · 0.25 SP.

## Task 5 · [frontend] Fibonacci levels in Settings > Display

- **Mechanism:** `npm run build` + manual on the local stack.
- **Commands:** `npm run build` → ✓ built.
- **Outcome:** ✅ pass on 2026-11-07. The user toggled levels in Settings > Display (0 and 100 locked on), saved, and the chart redrew the existing Fibonacci with the new set; the set survives a reload. Layout: six cards per row on desktop, two on mobile (the mockup's grid).
- **Est vs Actual:** 1 SP · 0.5 SP.
