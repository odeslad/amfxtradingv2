# 040 — Chart tool state remembered per chart · Verification

## Task 1 · [frontend] `useChartToolState` + `ChartSlot`

- **Mechanism:** `npm run build` + eslint; the manual check moved to production (task 2) by agreement with the user, the change being frontend-only and visually identical.
- **Commands:** `npm run build` → ✓ built · `npx eslint src/features/chart/useChartToolState.ts src/features/chart/ChartSlot.tsx` → clean.
- **Outcome:** ✅ build and lint on 2026-11-09; behaviour validated in task 2.
- **Est vs Actual:** 1 SP · 0.5 SP.
