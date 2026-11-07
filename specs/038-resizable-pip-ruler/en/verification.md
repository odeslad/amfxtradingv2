# 038 — Resizable pip ruler · Verification

## Task 1 · [frontend] Selectable, resizable ruler in `DrawingTools.ts`

- **Mechanism:** `npm run build` + manual on the local stack (Vite 5174 → backend 3001 → production DB through the tunnel).
- **Commands:** `npm run build` → ✓ built.
- **Outcome:** ✅ pass on 2026-11-07. The user measured a ruler on the local chart: it stays selected with handles, a handle drag resizes and recomputes the badge, a body drag moves it, click away deselects and click back reselects, Delete / Escape / Clear all remove it, a timeframe switch clears it, the lock ignores it. One behaviour added on the user's request during the check: picking any drawing tool also removes the ruler (AC 3 amended, `startDrawing` calls `clearRuler`).
- **Est vs Actual:** 1.5 SP · 1 SP.
