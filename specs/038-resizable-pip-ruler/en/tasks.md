# 038 — Resizable pip ruler · Tasks

Each task is one conventional commit. The project must build after every task. Tasks of different layers never share a commit. Deploy order: frontend only.

- [ ] 1. [frontend] Rework the ruler in `DrawingTools.ts`: single `ruler` two-anchor state, measuring through `drawStart` + `commitSecondAnchor` (touch press-drag-release included), selection with the reserved `'ruler'` id, hit test (handles, diagonal, box), drag of one end or the whole ruler, removal on Delete / Escape / Clear all / `loadPersisted`, lock keeps it, handles painted when selected or previewing; drawing count unchanged · **Verify:** `npm run build` + manual on local dev: measure, resize an end, move, deselect / reselect, Delete, Escape, Clear all, timeframe switch clears it, lock ignores it, never in the `/drawings` payload · **Est:** 1.5 SP
- [ ] 2. [infra] Push `master` (frontend deploy) and **validate on production against the spec**: Chart page, measure a ruler on any symbol, drag each handle and the box (AC 1–2), click away and back, Delete / Escape / Clear all, change timeframe (AC 3), lock (AC 4), mobile press-drag-release and handle drags (AC 5), Delete button with the ruler selected and no rectangle saved in `/drawings` after a reload (AC 6) · **Verify:** manual (user validation) · **Est:** 0.25 SP
- [ ] 3. [specs] Record Est vs Actual in `verification.md` (both languages), mark the spec closed and archive it under `archive/2026-11/` · **Verify:** manual · **Est:** 0.25 SP

**Total estimate**: 2 SP
