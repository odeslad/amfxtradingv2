# 038 — Resizable pip ruler · Verification

## Task 1 · [frontend] Selectable, resizable ruler in `DrawingTools.ts`

- **Mechanism:** `npm run build` + manual on the local stack (Vite 5174 → backend 3001 → production DB through the tunnel).
- **Commands:** `npm run build` → ✓ built.
- **Outcome:** ✅ pass on 2026-11-07. The user measured a ruler on the local chart: it stays selected with handles, a handle drag resizes and recomputes the badge, a body drag moves it, click away deselects and click back reselects, Delete / Escape / Clear all remove it, a timeframe switch clears it, the lock ignores it. One behaviour added on the user's request during the check: picking any drawing tool also removes the ruler (AC 3 amended, `startDrawing` calls `clearRuler`).
- **Est vs Actual:** 1.5 SP · 1 SP.

## Task 2 · [infra] Push + production validation

- **Mechanism:** manual (user validation).
- **Commands:** `git push origin master` (`59cccfb..23a457a`, frontend deploy only); the served bundle changed after the deploy.
- **Outcome:** ✅ pass (user validated on 2026-11-07 at https://v2.amfxtrading.com: AC 1–6).
- **Est vs Actual:** 0.25 SP · 0.25 SP.

## Task 3 · [specs] Close

- **Mechanism:** manual. `npm run build` (frontend) → ✓ built.
- **Outcome:** ✅ closed on 2026-11-07, archived under `archive/2026-11/`.
- **Est vs Actual:** 0.25 SP · 0.25 SP.

## Est vs Actual

| Task | Est | Actual |
|---|---|---|
| 1 Selectable, resizable ruler | 1.5 | 1 |
| 2 Push + production validation | 0.25 | 0.25 |
| 3 Close | 0.25 | 0.25 |
| **Total** | **2** | **1.5** |

Calibration: the two-anchor paths from spec 037 covered measuring, dragging and touch; the ruler needed only its own state, hit test and clearing rules. Deviation agreed during task 1: picking any drawing tool also removes the ruler (AC 3). Nothing pending on the user.
