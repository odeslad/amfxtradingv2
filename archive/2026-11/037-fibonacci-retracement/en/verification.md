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

## Task 3 (follow-up) · [frontend] Touch drag-to-finish for two-anchor drawings

- **Context:** asked by the user during validation (2026-11-07): on mobile the rectangle was placed at the second tap, not where the finger lifted after dragging. AC 6 amended.
- **Mechanism:** `npm run build` + manual in production (task 6) with the rectangle, the trendline and the Fibonacci on a phone.
- **Commands:** `npm run build` → ✓ built.
- **Outcome:** ✅ pass on 2026-11-07 (user validated in production).
- **Est vs Actual:** — · 0.25 SP.

## Task 6 · [infra] Push + production validation

- **Mechanism:** manual (user validation).
- **Commands:** `git push origin b780650:master` (spec + db + backend; "Deploy Backend to VPS" success, `/health` ok, migration already applied) → `git push origin master` (`b780650..8096da5`, frontend) → `git push origin master` (`37ff8df`, touch fix).
- **Outcome:** ✅ pass (user validated on 2026-11-07 at https://v2.amfxtrading.com: AC 1–8, including the mobile drag-to-finish).
- **Est vs Actual:** 0.5 SP · 0.5 SP.

## Task 7 · [specs] Close

- **Mechanism:** manual. `npm run build` (backend) → ✓ · `npm run build` (frontend) → ✓ built.
- **Outcome:** ✅ closed on 2026-11-07, archived under `archive/2026-11/`.
- **Est vs Actual:** 0.25 SP · 0.25 SP.

## Est vs Actual

| Task | Est | Actual |
|---|---|---|
| 1 fibLevels column + migration | 0.5 | 0.25 |
| 2 fibLevels in /settings | 0.75 | 0.5 |
| 3 fib drawing kind (+ touch follow-up) | 2.5 | 1.75 |
| 4 Tool in the toolbar | 0.75 | 0.25 |
| 5 Levels in Settings > Display | 1 | 0.5 |
| 6 Push + production validation | 0.5 | 0.5 |
| 7 Close | 0.25 | 0.25 |
| **Total** | **6.25** | **4** |

Calibration: reusing the trendline's two-anchor code paid off; the canvas painting was the only real work. Deviations agreed with the user during task 3: no solid style for 50 / 61.8 and every label bright (mockup updated in design.md); touch press-drag-release closes two-anchor drawings (AC 6 amended). Follow-up agreed for a new spec (038): the pip ruler stays ephemeral but becomes selectable and resizable. Nothing pending on the user.
